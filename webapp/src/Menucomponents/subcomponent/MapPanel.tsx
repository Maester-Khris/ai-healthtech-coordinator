import L from 'leaflet'
import 'leaflet/dist/leaflet.css'
import { MapContainer, TileLayer, Marker, Tooltip } from 'react-leaflet'
import { torontoHealthProviders, cnTowerPos } from '../utils/baseData'
import cnTowerSvg from '../../assets/cntower.svg'
import hospitalSvg from '../../assets/hospital.svg'

const facilityIconHtml = `
  <div style="width: 36px; height: 36px; filter: drop-shadow(0 4px 6px rgba(0,0,0,0.2));">
    <img src="${hospitalSvg}" style="width: 100%; height: 100%; object-fit: contain;" />
  </div>
`;

const facilityIcon = L.divIcon({
  className: '',
  html: facilityIconHtml,
  iconSize: [20, 20],
  iconAnchor: [16, 16],
  tooltipAnchor: [0, -16],
})

const cnTowerIconHtml = `
  <div style="width: 44px; height: 44px; filter: drop-shadow(0 4px 6px rgba(0,0,0,0.2));">
    <img src="${cnTowerSvg}" style="width: 100%; height: 100%;" />
  </div>
`;

const cnTowerIcon = L.divIcon({
  className: '',
  html: cnTowerIconHtml,
  iconSize: [44, 44],
  iconAnchor: [22, 44],
  tooltipAnchor: [0, -44],
})

const LEGEND_ITEMS = [
  { label: 'Hospital / Clinic', color: '#EF4444' },
  { label: 'Community Health Centre', color: '#F59E0B' },
  { label: 'Current location', color: '#2563EB' },
]

export function MapPanel() {
  return (
    <div className="relative h-full w-full">
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

        {torontoHealthProviders.map((facility, i) => (
          <Marker key={i} position={facility.position} icon={facilityIcon}>
            <Tooltip className="text-[13px] font-medium max-w-[200px]" direction="top">
              {facility.name}
            </Tooltip>
          </Marker>
        ))}
      </MapContainer>

      {/* Status pill — top right */}
      <div className="absolute top-5 right-5 z-[400] bg-white/95 backdrop-blur-md border border-gray-200/50 rounded-full px-4 py-2.5 text-xs font-bold text-gray-800 shadow-md flex items-center gap-2.5 pointer-events-none">
        <span className="relative flex h-2.5 w-2.5">
          <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
          <span className="relative inline-flex rounded-full h-2.5 w-2.5 bg-emerald-500"></span>
        </span>
        43 FACILITIES ACTIVE
      </div>

      {/* Legend — bottom left */}
      <div className="absolute bottom-3 left-3 z-[400] bg-white/95 backdrop-blur-md border border-gray-200/80 rounded-lg px-3 py-2.5 shadow-lg pointer-events-none">
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
