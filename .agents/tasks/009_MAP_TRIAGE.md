# Task: Triage UI — Map Route Display + Chat Triage Result + Next-Action Buttons Shell

**ID:** 010
**Scope:** `frontend`
**Branch:** `feat/triage-mvp`
**Tests required:** no

---

## Context

Task 009 delivered a working backend triage loop. This task wires the frontend
to display the triage result: filtered map markers, ETA-based route display,
triage result in the chat panel, and next-action button shells.

Backend is not modified in this task.

---

## New Environment Variable

Add to `.env.example` and Vercel environment variables UI:

```bash
# Geoapify — frontend routing (Vite exposes VITE_ prefix vars to browser bundle automatically)
VITE_GEOAPIFY_API_KEY=
```

In Doppler: add `VITE_GEOAPIFY_API_KEY` to the frontend config.
In Vercel: add `VITE_GEOAPIFY_API_KEY` under Settings → Environment Variables.
Local dev: already works via `doppler run -- npm run dev` — Vite reads it at build time.

---

## State Design

The triage result drives two distinct UI state transitions:

```
Default state (page load / new conversation):
  Map: all 393 facility markers visible, CN Tower landmark, no user pin
  Chat: empty state / conversation

Triage state (after LLM returns triage result with facility):
  Map: filtered to returned facilities only, user pin, ETA polylines
  Chat: assistant message + reasoning hint + triage card + next-action buttons

Reset (new conversation click):
  Map: returns to default state
  Chat: clears to empty state
```

---

## New Types — update `shared/types.ts`

```typescript
export interface RouteResult {
  facilityId: string
  etaMinutes: number
  distanceKm: number
}

export interface TriageUIState {
  active: boolean
  severity: Severity | null
  reasoning: string | null
  recommendedFacility: FacilityCandidate | null
  nearbyFacilities: FacilityCandidate[]
  userCoords: { lat: number; lng: number } | null
  routes: RouteResult[]              // populated after Geoapify call
  recommendedFacilityId: string | null  // lowest ETA — may differ from backend recommendation
}
```

---

## New Hook: `webapp/src/hooks/useTriageState.ts`

Manages the triage UI state for the current session.
Reset on new conversation. Updated on each triage response.

```typescript
import { useState, useCallback } from "react"
import { TriageUIState, TriageResult, RouteResult } from "../../shared/types"

const GEOAPIFY_KEY = import.meta.env.VITE_GEOAPIFY_API_KEY

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
      // No facility — partial triage state (severity only, no routing)
      setTriage({
        ...DEFAULT_STATE,
        active: true,
        severity: result.severity,
        reasoning: result.reasoning,
        recommendedFacility: null,
        nearbyFacilities: result.nearby_facilities,
        userCoords,
        routes: [],
        recommendedFacilityId: null,
      })
      return
    }

    const allFacilities = [
      result.recommended_facility,
      ...result.nearby_facilities,
    ]

    // Set initial state immediately — map filters while ETA loads
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

    // Fetch ETA from Geoapify if coordinates available
    if (userCoords && GEOAPIFY_KEY) {
      const routes = await fetchRouteMatrix(userCoords, allFacilities)
      if (routes.length > 0) {
        // Re-rank by ETA — lowest ETA is the true recommendation
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
  facilities: Array<{ id: string; lat: number; lng: number }>,
): Promise<RouteResult[]> {
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
    if (!resp.ok) return []
    const data = await resp.json()

    return (data.sources_to_targets?.[0] ?? []).map(
      (entry: { time: number; distance: number }, idx: number) => ({
        facilityId: facilities[idx].id,
        etaMinutes: Math.round((entry.time ?? 0) / 60),
        distanceKm: Math.round((entry.distance ?? 0) / 100) / 10,
      })
    )
  } catch {
    return []
  }
}
```

---

## New Hook: `webapp/src/hooks/useNextActions.ts`

Shell hook for next-action button behaviours.
All handlers are stubbed with console logs — full implementation is a separate task.

```typescript
import { useCallback } from "react"
import { Severity } from "../../shared/types"

export interface NextActionHandlers {
  call911: () => void
  messageEmergencyContact: (contactPhone: string | null) => void
  getDirections: (facilityName: string, lat: number, lng: number) => void
  saveRecommendation: () => void
}

export function useNextActions(severity: Severity | null): NextActionHandlers {
  const call911 = useCallback(() => {
    // LEGAL NOTE: This action is always user-initiated via a tap/click.
    // The app never dials autonomously. This opens the native phone dialer only.
    // TODO (separate task): implement tel:911 deep link
    console.log("[NextAction] call911 triggered — severity:", severity)
  }, [severity])

  const messageEmergencyContact = useCallback((contactPhone: string | null) => {
    // LEGAL NOTE: This opens the native SMS composer pre-filled with a template.
    // No server-side message sending. User must tap Send in their SMS app.
    // TODO (separate task): implement sms: deep link with pre-filled body
    console.log("[NextAction] messageEmergencyContact — phone:", contactPhone)
  }, [])

  const getDirections = useCallback((
    facilityName: string,
    lat: number,
    lng: number,
  ) => {
    // TODO (separate task): open Google Maps deep link
    // https://www.google.com/maps/dir/?api=1&destination={lat},{lng}
    console.log("[NextAction] getDirections —", facilityName, lat, lng)
  }, [])

  const saveRecommendation = useCallback(() => {
    // TODO (separate task): persist recommendation to user profile or clipboard
    console.log("[NextAction] saveRecommendation — severity:", severity)
  }, [severity])

  return { call911, messageEmergencyContact, getDirections, saveRecommendation }
}
```

---

## New Component: `webapp/src/components/triage/TriageCard.tsx`

Displayed below the assistant message when triage is complete.
Shows severity badge, facility info, ETA, and next-action buttons.

```typescript
import { TriageUIState, RouteResult } from "../../../shared/types"
import { useNextActions } from "../../hooks/useNextActions"

interface TriageCardProps {
  triage: TriageUIState
  emergencyContactPhone: string | null   // from user profile
}

export function TriageCard({ triage, emergencyContactPhone }: TriageCardProps) {
  const { call911, messageEmergencyContact, getDirections, saveRecommendation } =
    useNextActions(triage.severity)

  if (!triage.active || !triage.severity) return null

  const recommended = triage.recommendedFacilityId
    ? [triage.recommendedFacility, ...triage.nearbyFacilities]
        .find(f => f?.id === triage.recommendedFacilityId)
    : triage.recommendedFacility

  const recommendedRoute = triage.routes.find(
    r => r.facilityId === triage.recommendedFacilityId
  )

  const SEVERITY_COLORS: Record<string, string> = {
    emergent: "#E24B4A",
    urgent:   "#E8813A",
    moderate: "#D4A017",
    routine:  "#1D9E75",
  }

  const badgeColor = SEVERITY_COLORS[triage.severity] ?? "#888"

  return (
    <div style={{
      marginTop: 12,
      border: "0.5px solid var(--color-border-tertiary)",
      borderRadius: 10,
      padding: "12px 14px",
      background: "var(--color-background-secondary)",
      fontSize: 13,
    }}>
      {/* Severity badge */}
      <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 10 }}>
        <span style={{
          background: badgeColor,
          color: "#fff",
          fontSize: 11,
          fontWeight: 600,
          padding: "2px 8px",
          borderRadius: 20,
          textTransform: "uppercase",
          letterSpacing: "0.05em",
        }}>
          {triage.severity}
        </span>
        {triage.reasoning && (
          <span style={{ fontSize: 11, color: "var(--color-text-tertiary)", fontStyle: "italic" }}>
            {triage.reasoning}
          </span>
        )}
      </div>

      {/* Facility info */}
      {recommended && (
        <div style={{ marginBottom: 12 }}>
          <div style={{ fontWeight: 500, color: "var(--color-text-primary)", marginBottom: 2 }}>
            {recommended.name}
          </div>
          <div style={{ fontSize: 12, color: "var(--color-text-secondary)" }}>
            {recommended.address}
          </div>
          {recommendedRoute && (
            <div style={{ fontSize: 12, color: "var(--color-text-tertiary)", marginTop: 4 }}>
              {recommendedRoute.etaMinutes} min drive · {recommendedRoute.distanceKm} km
            </div>
          )}
          {!recommendedRoute && recommended.distanceKm && (
            <div style={{ fontSize: 12, color: "var(--color-text-tertiary)", marginTop: 4 }}>
              ~{recommended.distanceKm} km away
            </div>
          )}
        </div>
      )}

      {/* Next-action buttons */}
      {/* LEGAL NOTE: All buttons below are user-initiated only.
          No action is triggered automatically or autonomously.
          Each button opens a native OS dialog (phone dialer, SMS composer, Maps).
          The user must confirm the action in their OS. */}
      <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
        {triage.severity === "emergent" && (
          <>
            <button
              onClick={call911}
              style={buttonStyle("#E24B4A", "#fff")}
            >
              🚨 Call 911
            </button>
            {emergencyContactPhone && (
              <button
                onClick={() => messageEmergencyContact(emergencyContactPhone)}
                style={buttonStyle("var(--color-background-primary)", "var(--color-text-primary)", true)}
              >
                💬 Message emergency contact
              </button>
            )}
          </>
        )}

        {triage.severity === "urgent" && (
          <>
            {emergencyContactPhone && (
              <button
                onClick={() => messageEmergencyContact(emergencyContactPhone)}
                style={buttonStyle("#E8813A", "#fff")}
              >
                💬 Message emergency contact
              </button>
            )}
            {recommended && (
              <button
                onClick={() => getDirections(recommended.name, recommended.lat, recommended.lng)}
                style={buttonStyle("var(--color-background-primary)", "var(--color-text-primary)", true)}
              >
                🗺 Get directions
              </button>
            )}
          </>
        )}

        {(triage.severity === "moderate" || triage.severity === "routine") && (
          <>
            {recommended && (
              <button
                onClick={() => getDirections(recommended.name, recommended.lat, recommended.lng)}
                style={buttonStyle("#185FA5", "#fff")}
              >
                🗺 Get directions
              </button>
            )}
            <button
              onClick={saveRecommendation}
              style={buttonStyle("var(--color-background-primary)", "var(--color-text-primary)", true)}
            >
              💾 Save this recommendation
            </button>
          </>
        )}
      </div>
    </div>
  )
}

function buttonStyle(bg: string, color: string, outlined = false): React.CSSProperties {
  return {
    width: "100%",
    padding: "8px 12px",
    borderRadius: 8,
    border: outlined ? "0.5px solid var(--color-border-secondary)" : "none",
    background: bg,
    color,
    fontSize: 13,
    fontWeight: 500,
    cursor: "pointer",
    textAlign: "left",
  }
}
```

---

## New Component: `webapp/src/components/triage/ToolCallProgress.tsx`

Client-side progress trace shown during message processing.
No streaming — state driven by the send lifecycle.

```typescript
interface ToolCallProgressProps {
  stage: "idle" | "analyzing" | "locating" | "complete"
}

const STAGES = {
  analyzing: "Analyzing symptoms…",
  locating:  "Locating nearby facilities…",
  complete:  "Route calculated",
}

export function ToolCallProgress({ stage }: ToolCallProgressProps) {
  if (stage === "idle" || stage === "complete") return null

  return (
    <div style={{
      display: "flex",
      alignItems: "center",
      gap: 8,
      padding: "8px 12px",
      fontSize: 12,
      color: "var(--color-text-tertiary)",
      fontStyle: "italic",
    }}>
      <span style={{
        width: 10, height: 10,
        borderRadius: "50%",
        border: "1.5px solid #185FA5",
        borderTopColor: "transparent",
        display: "inline-block",
        animation: "spin 0.8s linear infinite",
        flexShrink: 0,
      }} />
      {STAGES[stage]}
    </div>
  )
}
```

---

## Map Panel Changes

### Files to modify: map panel component (wherever MapPanel.tsx lives)

Accept new props:
```typescript
interface MapPanelProps {
  facilities: Facility[]
  facilitiesLoading: boolean
  triage: TriageUIState          // NEW
}
```

**Triage state rendering logic:**

```typescript
// Determine which facilities to show
const visibleFacilities = triage.active && triage.recommendedFacility
  ? [triage.recommendedFacility, ...triage.nearbyFacilities].filter(Boolean)
  : facilities   // all 393 when no triage active

// Determine which facility is recommended (lowest ETA after Geoapify)
const recommendedId = triage.recommendedFacilityId
```

**User location pin** — shown when `triage.userCoords` is set:

```typescript
const userIcon = L.divIcon({
  className: "",
  html: `<div style="
    width: 14px; height: 14px; border-radius: 50%;
    background: #185FA5;
    box-shadow: 0 0 0 4px rgba(24,95,165,0.2), 0 0 0 8px rgba(24,95,165,0.1);
  "></div>`,
  iconSize: [14, 14],
  iconAnchor: [7, 7],
})
```

**Facility markers in triage state:**

When triage is active, render each visible facility with two variants:
- Recommended (lowest ETA): enlarged cross icon (36px), red fill, drop shadow
- Other candidates: standard cross icon (24px), muted red (`#e8a0a0`), lighter

```typescript
const getMarkerIcon = (facilityId: string) => {
  const isRecommended = facilityId === recommendedId
  const size = isRecommended ? 36 : 24
  const color = isRecommended ? "#E24B4A" : "#e8a0a0"
  return L.divIcon({
    className: "",
    html: `<svg xmlns="http://www.w3.org/2000/svg"
             viewBox="0 0 512 512" width="${size}" height="${size}"
             style="filter: ${isRecommended ? "drop-shadow(0 2px 4px rgba(0,0,0,0.3))" : "none"}">
      <path fill="${color}" d="M452.6,178.1h-96.1c-12.5,0-22.6-10.1-22.6-22.6V59.4
        c0-12.5-10.1-22.6-22.6-22.6H200.7c-12.5,0-22.6,10.1-22.6,22.6v96.1
        c0,12.5-10.1,22.6-22.6,22.6H59.4c-12.5,0-22.6,10.1-22.6,22.6v110.6
        c0,12.5,10.1,22.6,22.6,22.6h96.1c12.5,0,22.6,10.1,22.6,22.6v96.1
        c0,12.5,10.1,22.6,22.6,22.6h110.6c12.5,0,22.6-10.1,22.6-22.6v-96.1
        c0-12.5,10.1-22.6,22.6-22.6h96.1c12.5,0,22.6-10.1,22.6-22.6V200.7
        C475.2,188.2,465.1,178.1,452.6,178.1z"/>
    </svg>`,
    iconSize: [size, size],
    iconAnchor: [size / 2, size / 2],
    popupAnchor: [0, -size / 2],
  })
}
```

**ETA polylines** — one per facility in triage state:

```typescript
// For each facility with a route result, draw a polyline
triage.routes.forEach(route => {
  const facility = visibleFacilities.find(f => f.id === route.facilityId)
  if (!facility || !triage.userCoords) return

  const isRecommended = route.facilityId === recommendedId
  const polyline = L.polyline(
    [
      [triage.userCoords.lat, triage.userCoords.lng],
      [facility.lat, facility.lng],
    ],
    {
      color: isRecommended ? "#185FA5" : "#94a3b8",
      weight: isRecommended ? 3 : 1.5,
      dashArray: isRecommended ? "8, 6" : "4, 6",
      opacity: isRecommended ? 0.9 : 0.5,
    }
  )
  polyline.addTo(map)
  // Show ETA on hover for all routes
  polyline.bindTooltip(
    `${facility.name} · ${route.etaMinutes} min`,
    { sticky: true, className: "eta-tooltip" }
  )
  // Show ETA permanently for recommended route
  if (isRecommended) {
    polyline.bindTooltip(
      `${facility.name} · ${route.etaMinutes} min`,
      { permanent: true, className: "eta-tooltip-permanent" }
    )
  }
})
```

**Add CSS to global stylesheet:**
```css
.eta-tooltip, .eta-tooltip-permanent {
  background: rgba(255,255,255,0.92);
  border: 0.5px solid #cbd5e1;
  border-radius: 6px;
  padding: 3px 8px;
  font-size: 12px;
  color: #334;
  box-shadow: none;
}
.eta-tooltip-permanent {
  font-weight: 500;
}
```

**Map state reset:**
When `triage.active` becomes false (new conversation), clear all polylines,
user pin, and restore all 393 facility markers. Use a `useEffect` that watches
`triage.active` and cleans up Leaflet layers.

**Map auto-fit on triage:**
When triage becomes active and routes are calculated, fit the map bounds
to include the user pin and all visible facilities:
```typescript
if (triage.active && triage.userCoords && visibleFacilities.length > 0) {
  const bounds = L.latLngBounds([
    [triage.userCoords.lat, triage.userCoords.lng],
    ...visibleFacilities.map(f => [f.lat, f.lng] as [number, number]),
  ])
  map.fitBounds(bounds, { padding: [40, 40] })
}
```

---

## Chat Panel Changes

### Update `ChatPanel.tsx`

Add progress state:
```typescript
type ProgressStage = "idle" | "analyzing" | "locating" | "complete"
const [progressStage, setProgressStage] = useState<ProgressStage>("idle")
```

Update `handleSend` to drive progress stages:
```typescript
const handleSend = async () => {
  // ... existing validation and session creation ...

  setProgressStage("analyzing")

  const assistantMsg = await sendMessage(sid, text, coords)

  // Brief locating flash before complete
  setProgressStage("locating")
  await new Promise(r => setTimeout(r, 500))
  setProgressStage("complete")

  if (assistantMsg) {
    setLocalMessages(prev => [...prev, assistantMsg])
  }

  // Reset progress after display
  setTimeout(() => setProgressStage("idle"), 800)
}
```

Render `<ToolCallProgress stage={progressStage} />` between the message
list and the input area — visible during processing, hidden otherwise.

Render `<TriageCard>` below the last assistant message when triage is active:
```typescript
{localMessages.length > 0 &&
 localMessages[localMessages.length - 1].role === "assistant" &&
 triage.active && (
  <TriageCard
    triage={triage}
    emergencyContactPhone={profile?.emergency_contact_phone ?? null}
  />
)}
```

### New conversation reset

On "New conversation" click, call both `reset()` from `useTriageState`
and clear `coordsRef` in the geo hook (so `ask` preference re-prompts
on the next session's first message):

```typescript
const handleNewConversation = () => {
  setActiveSessionId(null)
  setLocalMessages([])
  triageReset()                     // clears triage state → map resets
  // do NOT reset geo.coords — position stays valid for the browser session
}
```

---

## Wire Everything in `App.tsx`

```typescript
const triageState = useTriageState()

// After sendMessage resolves and triage result is in the response:
// call triageState.applyTriageResult(response.triage, geo.coords)
// This should happen inside useConversations.sendMessage or a callback
// passed from App.tsx to ChatPanel

// Pass to MapPanel:
<MapPanel
  facilities={facilities}
  facilitiesLoading={facilitiesLoading}
  triage={triageState.triage}
/>

// Pass to ChatPanel:
<ChatPanel
  ...
  triage={triageState.triage}
  onTriageResult={triageState.applyTriageResult}
  onNewConversation={triageState.reset}
  geo={geo}
  profile={profile}
/>
```

The `onTriageResult` callback is called inside `ChatPanel.handleSend`
after receiving the response from `sendMessage`, passing the `triage`
field from the response and the current `geo.coords`.

---

## Commits (max 4)

```bash
# Commit 1 — new types and hooks
git add shared/types.ts \
        webapp/src/hooks/useTriageState.ts \
        webapp/src/hooks/useNextActions.ts
git commit -m "feat(frontend): triage state hook, route matrix ETA, next-action button hooks (stubbed)"

# Commit 2 — triage components
git add webapp/src/components/triage/TriageCard.tsx \
        webapp/src/components/triage/ToolCallProgress.tsx
git commit -m "feat(frontend): TriageCard component with severity badge, facility info, ETA, next-action buttons"

# Commit 3 — map panel triage rendering
git add webapp/src/<MapPanel file> \
        webapp/src/index.css
git commit -m "feat(frontend): map triage state — filtered markers, user pin, ETA polylines, recommended route highlight, auto-fit bounds"

# Commit 4 — chat panel + App.tsx wiring
git add webapp/src/components/chat/ChatPanel.tsx \
        webapp/src/App.tsx \
        .env.example
git commit -m "feat(frontend): wire triage result to map and chat — progress trace, TriageCard display, new conversation reset"
```

---

## Verification Checklist

- [ ] `npx tsc --noEmit` passes
- [ ] `doppler run -- npm run dev` starts without console errors
- [ ] Send a message → progress trace shows "Analyzing symptoms…" then "Locating…"
- [ ] On triage response: map filters to 2-3 facilities only (393 markers disappear)
- [ ] User location pin appears on map (blue dot with pulse ring)
- [ ] Polylines drawn from user to each facility — recommended is bold blue dashed
- [ ] ETA tooltip shown permanently on recommended route
- [ ] ETA shown on hover for other routes
- [ ] Recommended marker is larger and brighter than candidates
- [ ] Map auto-fits to include user pin and all visible facilities
- [ ] TriageCard renders below last assistant message with correct severity color
- [ ] Reasoning shown as italic subtitle in TriageCard
- [ ] Next-action buttons render correct set for each severity level
- [ ] All buttons log to console (stubs — no real action yet)
- [ ] "New conversation" click resets map to all 393 markers
- [ ] "New conversation" click clears TriageCard and progress
- [ ] `VITE_GEOAPIFY_API_KEY` present in `.env.example`
- [ ] Vercel preview deploys without build errors

---

## Out of Scope

- Actual next-action button implementations (tel:, sms:, Google Maps) — separate task
- Reasoning streaming / SSE — Sprint 9
- Sentry LLM call tracing — Sprint 9
- `main` branch promotion — end of sprint after all tasks verified