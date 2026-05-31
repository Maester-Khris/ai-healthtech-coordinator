import L from 'leaflet'
import { useEffect, useRef } from 'react'

export function useOsrmRoute(
  map: L.Map,
  userCoords: { lat: number; lng: number } | null,
  facilityLat: number | null,
  facilityLng: number | null,
): void {
  const layerRef = useRef<L.Layer | null>(null)

  useEffect(() => {
    if (layerRef.current) {
      layerRef.current.remove()
      layerRef.current = null
    }

    if (!userCoords || facilityLat === null || facilityLng === null) return

    const { lat: userLat, lng: userLng } = userCoords
    let cancelled = false

    const drawFallback = () => {
      const lineCasing = L.polyline(
        [[userLat, userLng], [facilityLat, facilityLng]],
        { color: '#185FA5', weight: 6, dashArray: '8, 12', opacity: 0.8, lineJoin: 'round', lineCap: 'round' }
      ).addTo(map)
      const lineCore = L.polyline(
        [[userLat, userLng], [facilityLat, facilityLng]],
        { color: '#38BDF8', weight: 3, dashArray: '8, 12', opacity: 1, lineJoin: 'round', lineCap: 'round' }
      ).addTo(map)

      const fallbackLayer = L.layerGroup([lineCasing, lineCore]).addTo(map)
      layerRef.current = fallbackLayer
      map.fitBounds(lineCasing.getBounds(), { padding: [48, 48], maxZoom: 14 })
    }

    const url =
      `https://router.project-osrm.org/route/v1/driving/` +
      `${userLng},${userLat};${facilityLng},${facilityLat}` +
      `?overview=full&geometries=geojson`

    fetch(url)
      .then(res => res.json())
      .then(data => {
        if (cancelled) return
        if (!data.routes || data.routes.length === 0) {
          drawFallback()
          return
        }
        const routeGeometry = data.routes[0].geometry

        // Layer 1: Ambient Drop Shadow for depth
        const routeShadow = L.geoJSON(routeGeometry, {
          style: { color: '#0f172a', weight: 14, opacity: 0.2, lineJoin: 'round', lineCap: 'round' },
        }).addTo(map)

        // Layer 2: High Contrast Casing / Border matching app theme
        const routeCasing = L.geoJSON(routeGeometry, {
          style: { color: '#185FA5', weight: 8, opacity: 0.95, lineJoin: 'round', lineCap: 'round' },
        }).addTo(map)

        // Layer 3: Vibrant Active Core
        const routeCore = L.geoJSON(routeGeometry, {
          style: { color: '#38BDF8', weight: 4, opacity: 1, lineJoin: 'round', lineCap: 'round' },
        }).addTo(map)

        // Layer 4: Inner Navigation Dashes
        const routeDashes = L.geoJSON(routeGeometry, {
          style: { color: '#ffffff', weight: 1.5, opacity: 0.8, dashArray: '6, 8', lineJoin: 'round', lineCap: 'round' },
        }).addTo(map)

        const routeLayer = L.layerGroup([routeShadow, routeCasing, routeCore, routeDashes]).addTo(map)
        layerRef.current = routeLayer

        map.fitBounds(routeCore.getBounds(), { padding: [52, 52], maxZoom: 14 })
        setTimeout(() => map.invalidateSize(), 100)
      })
      .catch(() => {
        if (cancelled) return
        drawFallback()
      })

    return () => {
      cancelled = true
      if (layerRef.current) {
        layerRef.current.remove()
        layerRef.current = null
      }
    }
  }, [map, userCoords?.lat, userCoords?.lng, facilityLat, facilityLng])
}
