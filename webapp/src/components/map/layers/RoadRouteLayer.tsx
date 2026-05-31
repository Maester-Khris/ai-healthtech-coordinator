import L from 'leaflet'
import { useEffect, useRef } from 'react'
import { useMap } from 'react-leaflet'
import { useMapContext } from '../context/MapContext'
import { buildTriageCandidates } from '../config/constants'

export function RoadRouteLayer() {
  const map = useMap()
  const { activeTriage, recommendedId } = useMapContext()
  const layerRef = useRef<L.Layer | null>(null)

  const triageCandidates = buildTriageCandidates(activeTriage)
  const recommendedFacility = activeTriage.active
    ? triageCandidates.find(f => f.id === recommendedId)
    : undefined

  const userCoords  = activeTriage.active ? activeTriage.userCoords  : null
  const roadGeometry = activeTriage.active ? activeTriage.roadGeometry : null

  useEffect(() => {
    if (layerRef.current) {
      layerRef.current.remove()
      layerRef.current = null
    }

    if (!userCoords || !recommendedFacility) return

    const { lat: userLat, lng: userLng } = userCoords
    const { lat: facilityLat, lng: facilityLng } = recommendedFacility

    const polylinePositions: [number, number][] =
      roadGeometry && roadGeometry.length > 1
        ? roadGeometry
        : [[userLat, userLng], [facilityLat, facilityLng]]

    console.log(
      "[MapPanel] polyline mode:",
      roadGeometry ? "road geometry" : "straight line fallback",
      "points:", polylinePositions.length
    )

    if (roadGeometry && roadGeometry.length > 1) {
      const shadow = L.polyline(polylinePositions, { color: '#0f172a', weight: 14, opacity: 0.2, lineJoin: 'round', lineCap: 'round' }).addTo(map)
      const casing = L.polyline(polylinePositions, { color: '#185FA5', weight: 8,  opacity: 0.95, lineJoin: 'round', lineCap: 'round' }).addTo(map)
      const core   = L.polyline(polylinePositions, { color: '#38BDF8', weight: 4,  opacity: 1,    lineJoin: 'round', lineCap: 'round' }).addTo(map)
      const dashes = L.polyline(polylinePositions, { color: '#ffffff', weight: 1.5, opacity: 0.8, dashArray: '6, 8', lineJoin: 'round', lineCap: 'round' }).addTo(map)
      layerRef.current = L.layerGroup([shadow, casing, core, dashes]).addTo(map)
      map.fitBounds(core.getBounds(), { padding: [52, 52], maxZoom: 14 })
    } else {
      const casing = L.polyline(polylinePositions, { color: '#185FA5', weight: 6, dashArray: '8, 12', opacity: 0.8, lineJoin: 'round', lineCap: 'round' }).addTo(map)
      const core   = L.polyline(polylinePositions, { color: '#38BDF8', weight: 3, dashArray: '8, 12', opacity: 1,   lineJoin: 'round', lineCap: 'round' }).addTo(map)
      layerRef.current = L.layerGroup([casing, core]).addTo(map)
      map.fitBounds(casing.getBounds(), { padding: [48, 48], maxZoom: 14 })
    }

    setTimeout(() => map.invalidateSize(), 100)

    return () => {
      if (layerRef.current) {
        layerRef.current.remove()
        layerRef.current = null
      }
    }
  }, [map, userCoords?.lat, userCoords?.lng, recommendedFacility?.lat, recommendedFacility?.lng, roadGeometry])

  return null
}
