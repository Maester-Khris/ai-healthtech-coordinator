import { useState, useCallback } from "react"
import type { TriageUIState, TriageResult, RouteResult, FacilityCandidate } from "../../../shared/types"

const GEOAPIFY_KEY = import.meta.env.VITE_GEOAPIFY_API_KEY as string | undefined
console.log("[RouteMatrix] API key present:", !!GEOAPIFY_KEY)
const DEFAULT_STATE: TriageUIState = {
  active: false,
  severity: null,
  reasoning: null,
  recommendedFacility: null,
  nearbyFacilities: [],
  userCoords: null,
  routes: [],
  recommendedFacilityId: null,
}

export function useTriageState() {
  const [triage, setTriage] = useState<TriageUIState>(DEFAULT_STATE)

  const reset = useCallback(() => setTriage(DEFAULT_STATE), [])

  const applyTriageResult = useCallback(async (
    result: TriageResult,
    userCoords: { lat: number; lng: number } | null,
  ) => {
    if (!result.recommended_facility) {
      setTriage({
        ...DEFAULT_STATE,
        active: true,
        severity: result.severity,
        reasoning: result.reasoning,
        nearbyFacilities: result.nearby_facilities,
        userCoords,
      })
      return
    }

    const allFacilities: FacilityCandidate[] = [
      result.recommended_facility,
      ...result.nearby_facilities,
    ]

    setTriage({
      active: true,
      severity: result.severity,
      reasoning: result.reasoning,
      recommendedFacility: result.recommended_facility,
      nearbyFacilities: result.nearby_facilities,
      userCoords,
      routes: [],
      recommendedFacilityId: result.recommended_facility.id,
    })

    if (userCoords && GEOAPIFY_KEY) {
      const routes = await fetchRouteMatrix(userCoords, allFacilities)
      if (routes.length > 0) {
        const sorted = [...routes].sort((a, b) => a.etaMinutes - b.etaMinutes)
        setTriage(prev => ({
          ...prev,
          routes,
          recommendedFacilityId: sorted[0].facilityId,
        }))
      }
    }
  }, [])

  return { triage, applyTriageResult, reset }
}

async function fetchRouteMatrix(
  userCoords: { lat: number; lng: number },
  facilities: FacilityCandidate[],
): Promise<RouteResult[]> {
  console.log("[RouteMatrix] calling Geoapify with", facilities.length, "targets")
  console.log("[RouteMatrix] API key present:", !!GEOAPIFY_KEY)

  if (!GEOAPIFY_KEY) {
    console.error("[RouteMatrix] VITE_GEOAPIFY_API_KEY is not set — check Doppler config and restart with doppler run -- npm run dev")
    return []
  }

  const sources = [{ location: [userCoords.lng, userCoords.lat] }]
  const targets = facilities.map(f => ({ location: [f.lng, f.lat] }))

  try {
    const resp = await fetch(
      `https://api.geoapify.com/v1/routematrix?apiKey=${GEOAPIFY_KEY}`,
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ mode: "drive", sources, targets }),
      }
    )
    console.log("[RouteMatrix] response status:", resp.status)
    if (!resp.ok) return []
    const data = await resp.json()
    console.log("[RouteMatrix] raw response:", data)

    return (data.sources_to_targets?.[0] ?? []).map(
      (entry: { time: number; distance: number }, idx: number) => ({
        facilityId: facilities[idx].id,
        etaMinutes: Math.round((entry.time ?? 0) / 60),
        distanceKm: Math.round((entry.distance ?? 0) / 100) / 10,
      })
    )
  } catch (err) {
    console.error("[RouteMatrix] fetch failed:", err)
    return []
  }
}
