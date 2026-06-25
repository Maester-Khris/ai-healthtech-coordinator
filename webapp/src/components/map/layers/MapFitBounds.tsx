import L from 'leaflet'
import { useEffect } from 'react'
import { useMap } from 'react-leaflet'
import { useMapContext } from '../context/MapContext'
import { cnTowerPos, buildTriageCandidates } from '../config/constants'

export function MapFitBounds() {
  const map = useMap()
  const { activeTriage } = useMapContext()

  useEffect(() => {
    if (!activeTriage.active || !activeTriage.userCoords) return
    const candidates = buildTriageCandidates(activeTriage)
    if (candidates.length === 0) return

    const bounds = L.latLngBounds([
      [activeTriage.userCoords.lat, activeTriage.userCoords.lng],
      ...candidates.map(f => [f.lat, f.lng] as [number, number]),
    ])
    map.fitBounds(bounds, { paddingTopLeft: [60, 80], paddingBottomRight: [100, 60], maxZoom: 14 })
  }, [activeTriage.active, map])

  useEffect(() => {
    if (!activeTriage.active) {
      map.setView(cnTowerPos, 12)
    }
  }, [activeTriage.active, map])

  return null
}
