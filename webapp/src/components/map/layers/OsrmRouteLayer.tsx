import { useMap } from 'react-leaflet'
import { useMapContext } from '../context/MapContext'
import { buildTriageCandidates } from '../config/constants'
import { useOsrmRoute } from '../hooks/useOsrmRoute'

export function OsrmRouteLayer() {
  const map = useMap()
  const { activeTriage, recommendedId } = useMapContext()

  const triageCandidates = buildTriageCandidates(activeTriage)
  const recommendedFacility = activeTriage.active
    ? triageCandidates.find(f => f.id === recommendedId)
    : undefined

  const userCoords  = activeTriage.active ? activeTriage.userCoords  : null
  const facilityLat = recommendedFacility ? recommendedFacility.lat  : null
  const facilityLng = recommendedFacility ? recommendedFacility.lng  : null

  useOsrmRoute(map, userCoords, facilityLat, facilityLng)
  return null
}
