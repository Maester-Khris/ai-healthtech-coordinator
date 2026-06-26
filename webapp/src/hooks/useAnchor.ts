import { useState, useCallback } from 'react'
import type { UserAnchor } from '../../../shared/types'
import type { Coords } from './useGeolocation'

const CN_TOWER = { lat: 43.6426, lng: -79.3871 }

export function resolveAnchor(
  gps:       Coords | null,
  manualPin: { lat: number; lng: number } | null,
): UserAnchor {
  if (manualPin) return { ...manualPin, source: 'manual_pin' }
  if (gps)       return { lat: gps.lat, lng: gps.lng, source: 'gps' }
  return { ...CN_TOWER, source: 'default' }
}

export function useAnchor(gps: Coords | null) {
  const [manualPin, setManualPin] = useState<{ lat: number; lng: number } | null>(null)

  const placePin = useCallback((lat: number, lng: number) => {
    setManualPin({ lat, lng })
  }, [])

  const clearPin = useCallback(() => {
    setManualPin(null)
  }, [])

  return { anchor: resolveAnchor(gps, manualPin), manualPin, placePin, clearPin }
}
