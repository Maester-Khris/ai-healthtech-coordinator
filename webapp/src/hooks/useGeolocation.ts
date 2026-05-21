import { useState, useRef, useCallback } from "react"

export interface Coords {
  lat: number
  lng: number
}

interface UseGeolocationResult {
  coords: Coords | null
  requesting: boolean
  denied: boolean
  requestOnce: () => Promise<Coords | null>
  setCoords: (coords: Coords | null) => void
}

export function useGeolocation(): UseGeolocationResult {
  const [coords, setCoords] = useState<Coords | null>(null)
  const [requesting, setRequesting] = useState(false)
  const [denied, setDenied] = useState(false)
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
          resolvedRef.current = true
          setRequesting(false)
          resolve(c)
        },
        () => {
          setDenied(true)
          setRequesting(false)
          resolve(null)
        },
        { timeout: 8000, maximumAge: 120000 }
      )
    })
  }, [coords])

  return { coords, requesting, denied, requestOnce, setCoords }
}
