import { useState, useRef, useCallback } from "react"

export interface Coords {
  lat: number
  lng: number
}

export interface GeoError {
  code: number
  message: string
}

interface UseGeolocationResult {
  coords: Coords | null
  requesting: boolean
  denied: boolean
  lastError: GeoError | null
  requestOnce: () => Promise<Coords | null>
  setCoords: (coords: Coords | null) => void
}

export function useGeolocation(): UseGeolocationResult {
  const [coords, setCoords] = useState<Coords | null>(null)
  const [requesting, setRequesting] = useState(false)
  const [denied, setDenied] = useState(false)
  const [lastError, setLastError] = useState<GeoError | null>(null)
  const resolvedRef = useRef(false)

  const requestOnce = useCallback((): Promise<Coords | null> => {
    if (resolvedRef.current && coords) return Promise.resolve(coords)

    if (!navigator.geolocation) return Promise.resolve(null)

    setRequesting(true)
    return new Promise((resolve) => {
      navigator.geolocation.getCurrentPosition(
        (pos) => {
          const c = { lat: pos.coords.latitude, lng: pos.coords.longitude }
          setCoords(c)
          setDenied(false)
          setLastError(null)
          resolvedRef.current = true
          setRequesting(false)
          resolve(c)
        },
        (error) => {
          const geo: GeoError = { code: error.code, message: error.message }
          console.error("Geolocation error:", geo)
          setLastError(geo)
          setDenied(true)
          setRequesting(false)
          ;(window as any).lastGeoError = error
          resolve(null)
        },
        // enableHighAccuracy causes timeouts/failures on iOS Safari — keep it false
        { enableHighAccuracy: false, timeout: 20000, maximumAge: 120000 }
      )
    })
  }, [coords])

  return { coords, requesting, denied, lastError, requestOnce, setCoords }
}
