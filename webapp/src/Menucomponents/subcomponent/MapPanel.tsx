import L from 'leaflet'
import 'leaflet/dist/leaflet.css'
import { MapContainer, TileLayer, Marker, Tooltip } from 'react-leaflet'
import { torontoHealthProviders, cnTowerPos } from '../utils/baseData'

const facilityIcon = L.divIcon({
  className: '',
  html: `<div style="width:20px;height:20px;border-radius:50%;background:white;border:1.5px solid #E24B4A;display:flex;align-items:center;justify-content:center;font-size:12px;color:#E24B4A;font-weight:500;">+</div>`,
  iconSize: [20, 20],
  iconAnchor: [10, 10],
})

const cnTowerIcon = L.divIcon({
  className: '',
  html: `<div style="width:12px;height:12px;border-radius:50%;background:#185FA5;box-shadow:0 0 0 6px rgba(24,95,165,0.15)"></div>`,
  iconSize: [12, 12],
  iconAnchor: [6, 6],
})

const LEGEND_ITEMS = [
  { label: 'Hospital / Clinic', color: '#E24B4A' },
  { label: 'Community Health Centre', color: '#E24B4A' },
  { label: 'Current location', color: '#185FA5' },
]

export function MapPanel() {
  return (
    <div className="relative h-full w-full">
      <MapContainer
        center={cnTowerPos}
        zoom={13}
        scrollWheelZoom={false}
        zoomControl={true}
        className="h-full w-full"
      >
        <TileLayer
          attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>'
          url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
        />

        <Marker position={cnTowerPos} icon={cnTowerIcon}>
          <Tooltip className="text-[13px]">
            <strong>CN Tower</strong>
          </Tooltip>
        </Marker>

        {torontoHealthProviders.map((facility, i) => (
          <Marker key={i} position={facility.position} icon={facilityIcon}>
            <Tooltip className="text-[13px] max-w-[200px]">
              {facility.name}
            </Tooltip>
          </Marker>
        ))}
      </MapContainer>

      {/* Status pill — top right */}
      <div className="absolute top-3 right-3 z-[1000] bg-white border border-gray-200 rounded-full px-3 py-1 text-[12px] font-medium text-gray-700 shadow-sm flex items-center gap-1.5 pointer-events-none">
        <span className="w-2 h-2 rounded-full inline-block" style={{ backgroundColor: '#1D9E75' }} />
        43 facilities active
      </div>

      {/* Legend — bottom left */}
      <div className="absolute bottom-6 left-3 z-[1000] bg-white border border-gray-200 rounded-md px-3 py-2 shadow-sm pointer-events-none">
        <p className="text-[11px] font-medium text-gray-700 mb-1">Facility types</p>
        {LEGEND_ITEMS.map(({ label, color }) => (
          <div key={label} className="flex items-center gap-1.5 mb-0.5">
            <span
              className="w-2 h-2 rounded-full inline-block flex-none"
              style={{ backgroundColor: color }}
            />
            <span className="text-[11px] text-gray-600">{label}</span>
          </div>
        ))}
      </div>
    </div>
  )
}
