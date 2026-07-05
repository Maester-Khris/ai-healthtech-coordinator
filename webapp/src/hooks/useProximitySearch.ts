import { useState, useEffect } from 'react'
import type { NearbyFacility, UserAnchor } from '../../../shared/types'
import { PROXIMITY_OPTIONS } from '../components/map/config/proximity'

const BASE_URL = import.meta.env.VITE_API_BASE_URL ?? 'http://localhost:8000'

interface UseProximitySearchResult {
  results: NearbyFacility[]
  loading: boolean
  error:   string | null
}

export function useProximitySearch(
  anchor:         UserAnchor,
  proximity:      string,
  categoryFilter: string,   // 'all' | 'hospital' | 'ambulatory' | 'residential'
): UseProximitySearchResult {
  const [results, setResults] = useState<NearbyFacility[]>([])
  const [loading, setLoading] = useState(false)
  const [error, setError]     = useState<string | null>(null)

  const radiusM = PROXIMITY_OPTIONS.find(opt => opt.value === proximity)?.radiusM

  useEffect(() => {
    if (radiusM === undefined) {
      setResults([])
      setLoading(false)
      setError(null)
      return
    }

    let cancelled = false
    setLoading(true)
    setError(null)

    const params = new URLSearchParams({
      lat:      String(anchor.lat),
      lng:      String(anchor.lng),
      radius_m: String(radiusM),
    })
    if (categoryFilter !== 'all') params.set('category', categoryFilter)

    const url = `${BASE_URL}/facilities/nearby?${params.toString()}`

    fetch(url)
      .then(res => {
        if (!res.ok) throw new Error(`Proximity search failed (${res.status})`)
        return res.json() as Promise<NearbyFacility[]>
      })
      .then(data => {
        if (!cancelled) {
          setResults(data)
          setLoading(false)
        }
      })
      .catch(err => {
        if (!cancelled) {
          setError(err instanceof Error ? err.message : 'Unknown error')
          setResults([])
          setLoading(false)
        }
      })

    return () => { cancelled = true }
  }, [anchor.lat, anchor.lng, anchor.source, radiusM, categoryFilter])
  // anchor.source: re-query when anchor type changes (GPS → pin at same coords = different intent)
  // categoryFilter: re-query when category chip changes so the DB pre-filters per category

  return { results, loading, error }
}
