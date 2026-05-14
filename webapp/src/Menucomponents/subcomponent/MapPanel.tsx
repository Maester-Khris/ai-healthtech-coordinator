import L from 'leaflet'
import 'leaflet/dist/leaflet.css'
import { MapContainer, TileLayer, Marker, Tooltip, Popup } from 'react-leaflet'
import type { Facility } from '../../../../shared/types'
import cnTowerSvg from '../../assets/cntower.svg'

interface MapPanelProps {
  facilities: Facility[]
  facilitiesLoading: boolean
}

const cnTowerPos: [number, number] = [43.6426, -79.3871]

const facilityIcon = L.divIcon({
  className: '',
  html: `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 512 512" width="28" height="28">
    <path fill="#E24B4A" d="M452.6,178.1h-96.1c-12.5,0-22.6-10.1-22.6-22.6V59.4
      c0-12.5-10.1-22.6-22.6-22.6H200.7c-12.5,0-22.6,10.1-22.6,22.6v96.1
      c0,12.5-10.1,22.6-22.6,22.6H59.4c-12.5,0-22.6,10.1-22.6,22.6v110.6
      c0,12.5,10.1,22.6,22.6,22.6h96.1c12.5,0,22.6,10.1,22.6,22.6v96.1
      c0,12.5,10.1,22.6,22.6,22.6h110.6c12.5,0,22.6-10.1,22.6-22.6v-96.1
      c0-12.5,10.1-22.6,22.6-22.6h96.1c12.5,0,22.6-10.1,22.6-22.6V200.7
      C475.2,188.2,465.1,178.1,452.6,178.1z"/>
  </svg>`,
  iconSize: [28, 28],
  iconAnchor: [14, 14],
  popupAnchor: [0, -16],
})

const cnTowerIcon = L.divIcon({
  className: '',
  html: `<div style="width:44px;height:44px;filter:drop-shadow(0 4px 6px rgba(0,0,0,0.2));">
    <img src="${cnTowerSvg}" style="width:100%;height:100%;" />
  </div>`,
  iconSize: [44, 44],
  iconAnchor: [22, 44],
  tooltipAnchor: [0, -44],
})

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

export function MapPanel({ facilities, facilitiesLoading }: MapPanelProps) {
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

        <Marker position={cnTowerPos} icon={cnTowerIcon}>
          <Tooltip className="text-[13px] font-semibold" direction="top">
            CN Tower Area
          </Tooltip>
        </Marker>

        {facilities.map((facility) => (
          <Marker
            key={facility.id ?? facility.name}
            position={[facility.lat, facility.lng]}
            icon={facilityIcon}
          >
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
                  {facility.accepted_severity.map((sev) => (
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
        ))}
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
        {facilitiesLoading ? '—' : facilities.length} FACILITIES ACTIVE
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
