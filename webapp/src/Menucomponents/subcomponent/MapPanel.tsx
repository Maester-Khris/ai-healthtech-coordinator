import L from 'leaflet'
import 'leaflet/dist/leaflet.css'
import { useEffect } from 'react'
import { MapContainer, TileLayer, Marker, Tooltip, Popup, Polyline, useMap } from 'react-leaflet'
import type { Facility, FacilityCandidate, TriageUIState } from '../../../../shared/types'
import cnTowerSvg from '../../assets/cntower.svg'

interface MapPanelProps {
  facilities: Facility[]
  facilitiesLoading: boolean
  triage?: TriageUIState
}

const cnTowerPos: [number, number] = [43.6426, -79.3871]

const INACTIVE_TRIAGE: TriageUIState = {
  active: false,
  severity: null,
  reasoning: null,
  recommendedFacility: null,
  nearbyFacilities: [],
  userCoords: null,
  routes: [],
  recommendedFacilityId: null,
}

const cnTowerIcon = L.divIcon({
  className: '',
  html: `<div style="width:44px;height:44px;filter:drop-shadow(0 4px 6px rgba(0,0,0,0.2));">
    <img src="${cnTowerSvg}" style="width:100%;height:100%;" />
  </div>`,
  iconSize: [44, 44],
  iconAnchor: [22, 44],
  tooltipAnchor: [0, -44],
})

const userIcon = L.divIcon({
  className: '',
  html: `<svg xmlns="http://www.w3.org/2000/svg"
           viewBox="0 0 24 24" width="32" height="32">
    <ellipse cx="12" cy="22" rx="5" ry="2" fill="rgba(0,0,0,0.15)"/>
    <path d="M12 2C8.13 2 5 5.13 5 9c0 5.25 7 13 7 13s7-7.75 7-13c0-3.87-3.13-7-7-7z"
          fill="#185FA5"/>
    <circle cx="12" cy="8" r="2.2" fill="white"/>
    <path d="M8.5 14.5c0-1.93 1.57-3.5 3.5-3.5s3.5 1.57 3.5 3.5"
          fill="white"/>
  </svg>`,
  iconSize: [32, 32],
  iconAnchor: [16, 32],
  popupAnchor: [0, -32],
})

// H badge marker — used for all facility markers in both default and triage state.
// In triage state: recommended is larger with animated pulse ring, others are muted.
// In default state: recommendedId is null, so all render as the non-recommended variant.
function getFacilityIcon(facilityId: string | undefined, recommendedId: string | null) {
  const isRecommended = !!facilityId && facilityId === recommendedId
  const size = isRecommended ? 38 : 26
  const bg = isRecommended ? "#C0392B" : "#E8877A"
  const textSize = isRecommended ? 16 : 11
  const svgSize = isRecommended ? size + 20 : size + 4

  const pulse = isRecommended
    ? `<circle cx="${svgSize / 2}" cy="${svgSize / 2}" r="${size / 2 + 6}"
         fill="none" stroke="#C0392B" stroke-width="2" opacity="0.3">
         <animate attributeName="r"
           values="${size / 2};${size / 2 + 10}" dur="1.5s"
           repeatCount="indefinite"/>
         <animate attributeName="opacity"
           values="0.4;0" dur="1.5s" repeatCount="indefinite"/>
       </circle>`
    : ""

  return L.divIcon({
    className: "",
    html: `<svg xmlns="http://www.w3.org/2000/svg"
             width="${svgSize}" height="${svgSize}"
             viewBox="0 0 ${svgSize} ${svgSize}">
      ${pulse}
      <rect x="${isRecommended ? 10 : 2}" y="${isRecommended ? 10 : 2}"
            width="${size}" height="${size}" rx="${Math.round(size * 0.25)}"
            fill="${bg}"/>
      <text x="${svgSize / 2}" y="${svgSize / 2 + textSize * 0.35}"
            text-anchor="middle"
            font-family="system-ui, sans-serif"
            font-size="${textSize}"
            font-weight="700"
            fill="white">H</text>
    </svg>`,
    iconSize: [svgSize, svgSize],
    iconAnchor: [svgSize / 2, svgSize / 2],
    popupAnchor: [0, -svgSize / 2],
  })
}

function buildTriageCandidates(triage: TriageUIState): FacilityCandidate[] {
  if (!triage.active) return []
  if (triage.recommendedFacility) {
    return [triage.recommendedFacility, ...triage.nearbyFacilities]
  }
  return triage.nearbyFacilities
}

const SEVERITY_COLORS: Record<string, string> = {
  routine:  '#10B981',
  moderate: '#F59E0B',
  urgent:   '#F97316',
  emergent: '#EF4444',
}

const LEGEND_ITEMS = [
  { label: 'Hospital / Clinic', color: '#E24B4A' },
  { label: 'Community Health Centre', color: '#F59E0B' },
  { label: 'Current location', color: '#2563EB' },
]

// Must be inside MapContainer to call useMap()
function MapFitBounds({ triage }: { triage: TriageUIState }) {
  const map = useMap()

  useEffect(() => {
    if (!triage.active || !triage.userCoords) return
    const candidates = buildTriageCandidates(triage)
    if (candidates.length === 0) return

    const bounds = L.latLngBounds([
      [triage.userCoords.lat, triage.userCoords.lng],
      ...candidates.map(f => [f.lat, f.lng] as [number, number]),
    ])
    map.fitBounds(bounds, { padding: [40, 40] })
  }, [triage.active, triage.routes, map]) // re-fit when routes arrive

  useEffect(() => {
    if (!triage.active) {
      map.setView(cnTowerPos, 13)
    }
  }, [triage.active, map])

  return null
}

export function MapPanel({ facilities, facilitiesLoading, triage }: MapPanelProps) {
  const activeTriage = triage ?? INACTIVE_TRIAGE
  const triageCandidates = buildTriageCandidates(activeTriage)
  const recommendedId = activeTriage.recommendedFacilityId

  // Single recommended route — find the one route that matters
  const recommendedRoute = activeTriage.routes.find(
    r => r.facilityId === recommendedId
  )
  const recommendedFacility = triageCandidates.find(
    f => f.id === recommendedId
  )

  return (
    <div className="relative h-full w-full isolate">
      <MapContainer
        center={cnTowerPos}
        zoom={13}
        scrollWheelZoom={false}
        zoomControl={true}
        className="h-full w-full z-0"
      >
        <TileLayer
          attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>'
          url="https://{s}.basemaps.cartocdn.com/rastertiles/voyager/{z}/{x}/{y}{r}.png"
        />

        <MapFitBounds triage={activeTriage} />

        <Marker position={cnTowerPos} icon={cnTowerIcon}>
          <Tooltip className="text-[13px] font-semibold" direction="top">
            CN Tower Area
          </Tooltip>
        </Marker>

        {/* User location pin */}
        {activeTriage.userCoords && (
          <Marker
            position={[activeTriage.userCoords.lat, activeTriage.userCoords.lng]}
            icon={userIcon}
          >
            <Tooltip direction="top">Your location</Tooltip>
          </Marker>
        )}

        {/* Single route line — recommended facility only */}
        {activeTriage.active && activeTriage.userCoords && recommendedRoute && recommendedFacility && (
          <Polyline
            key="recommended-route"
            positions={[
              [activeTriage.userCoords.lat, activeTriage.userCoords.lng],
              [recommendedFacility.lat, recommendedFacility.lng],
            ]}
            pathOptions={{
              color:     "#185FA5",
              weight:    3,
              dashArray: "10, 7",
              opacity:   0.85,
            }}
          >
            <Tooltip permanent className="eta-tooltip-permanent">
              <span style={{ fontSize: 12, fontWeight: 500 }}>
                {recommendedFacility.name} · {recommendedRoute.etaMinutes} min
              </span>
            </Tooltip>
          </Polyline>
        )}

        {/* Facility markers — triage state */}
        {activeTriage.active
          ? triageCandidates.map(facility => (
              <Marker
                key={facility.id}
                position={[facility.lat, facility.lng]}
                icon={getFacilityIcon(facility.id, recommendedId)}
              >
                <Tooltip sticky>
                  <div style={{ fontSize: 12, lineHeight: 1.5 }}>
                    <strong>{facility.name}</strong><br />
                    {facility.category.charAt(0).toUpperCase() + facility.category.slice(1)}
                  </div>
                </Tooltip>
                <Popup>
                  <div style={{ minWidth: 160 }}>
                    <p style={{ fontWeight: 700, fontSize: 13, marginBottom: 4, color: '#111' }}>
                      {facility.name}
                    </p>
                    <p style={{ fontSize: 11, color: '#666', marginBottom: 8 }}>
                      {facility.address}
                    </p>
                    <p style={{ fontSize: 11, color: '#666' }}>
                      ~{facility.distanceKm} km away
                    </p>
                  </div>
                </Popup>
              </Marker>
            ))
          /* Facility markers — default state (all 393) */
          : facilities.map(facility => (
              <Marker
                key={facility.id ?? facility.name}
                position={[facility.lat, facility.lng]}
                icon={getFacilityIcon(facility.id, null)}
              >
                <Tooltip sticky>
                  <div style={{ fontSize: 12, lineHeight: 1.5 }}>
                    <strong>{facility.name}</strong><br />
                    {facility.category.charAt(0).toUpperCase() + facility.category.slice(1)}<br />
                    <span style={{ color: "#666" }}>{facility.source_facility_type}</span>
                  </div>
                </Tooltip>
                <Popup>
                  <div style={{ minWidth: 160 }}>
                    <p style={{ fontWeight: 700, fontSize: 13, marginBottom: 4, color: '#111' }}>
                      {facility.name}
                    </p>
                    <p style={{ fontSize: 11, color: '#666', marginBottom: 4, textTransform: 'capitalize' }}>
                      {facility.category}
                    </p>
                    <p style={{ fontSize: 11, color: '#666', marginBottom: 8 }}>
                      {facility.address}
                    </p>
                    <div style={{ display: 'flex', flexWrap: 'wrap', gap: 4 }}>
                      {facility.accepted_severity.map(sev => (
                        <span
                          key={sev}
                          style={{
                            fontSize: 10,
                            fontWeight: 600,
                            padding: '2px 6px',
                            borderRadius: 4,
                            backgroundColor: `${SEVERITY_COLORS[sev]}22`,
                            color: SEVERITY_COLORS[sev],
                            border: `1px solid ${SEVERITY_COLORS[sev]}44`,
                          }}
                        >
                          {sev}
                        </span>
                      ))}
                    </div>
                  </div>
                </Popup>
              </Marker>
            ))
        }
      </MapContainer>

      {facilitiesLoading && (
        <div style={{
          position: 'absolute',
          top: 52,
          left: 12,
          zIndex: 15,
          background: 'rgba(255,255,255,0.88)',
          borderRadius: 8,
          padding: '6px 10px',
          fontSize: 12,
          color: '#557',
          display: 'flex',
          alignItems: 'center',
          gap: 6,
        }}>
          <span style={{
            width: 12,
            height: 12,
            borderRadius: '50%',
            border: '2px solid #185FA5',
            borderTopColor: 'transparent',
            display: 'inline-block',
            animation: 'spin 0.8s linear infinite',
          }} />
          Loading facilities…
        </div>
      )}

      {/* Status pill — top right */}
      <div className="absolute top-5 right-5 z-[15] bg-white/95 backdrop-blur-md border border-gray-200/50 rounded-full px-4 py-2.5 text-xs font-bold text-gray-800 shadow-md flex items-center gap-2.5 pointer-events-none">
        <span className="relative flex h-2.5 w-2.5">
          <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
          <span className="relative inline-flex rounded-full h-2.5 w-2.5 bg-emerald-500"></span>
        </span>
        {activeTriage.active
          ? `${triageCandidates.length} FACILITIES SHOWN`
          : `${facilitiesLoading ? '—' : facilities.length} FACILITIES ACTIVE`
        }
      </div>

      {/* Legend — bottom left */}
      <div className="absolute bottom-3 left-3 z-[15] bg-white/95 backdrop-blur-md border border-gray-200/80 rounded-lg px-3 py-2.5 shadow-lg pointer-events-none">
        <p className="text-[10px] font-bold text-gray-800 mb-2 uppercase tracking-wider">Facility Legend</p>
        <div className="flex items-center gap-3">
          {LEGEND_ITEMS.map(({ label, color }) => (
            <div key={label} className="flex items-center gap-1.5">
              <span
                className="w-2.5 h-2.5 rounded-full inline-block flex-none shadow-sm"
                style={{ backgroundColor: color }}
              />
              <span className="text-[11px] font-semibold text-gray-600 leading-none">{label}</span>
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}
