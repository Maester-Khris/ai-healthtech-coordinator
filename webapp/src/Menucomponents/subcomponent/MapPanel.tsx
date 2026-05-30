import L from 'leaflet'
import 'leaflet/dist/leaflet.css'
import { useEffect, useState, useRef } from 'react'
import { MapContainer, TileLayer, Marker, Tooltip, Popup, Polyline, useMap } from 'react-leaflet'
import type { Facility, FacilityCandidate, TriageUIState } from '../../../../shared/types'
import cnTowerSvg from '../../assets/cntower.svg'
import { useBreakpoint } from '../../hooks/useBreakpoint'

interface MapPanelProps {
  facilities: Facility[]
  facilitiesLoading: boolean
  triage?: TriageUIState
  verticalLegend?: boolean
  sizeVersion?: number
  onClear?: () => void
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

const CATEGORY_STYLES: Record<string, { color: string; letter: string; label: string }> = {
  hospital: { color: "#C0392B", letter: "H", label: "Hospital" },
  ambulatory: { color: "#1A7A8A", letter: "A", label: "Walk-in / Clinic" },
  residential: { color: "#5A7A4A", letter: "R", label: "Residential Care" },
}

const DEFAULT_STYLE = { color: "#888888", letter: "H", label: "Other" }

function getFacilityIcon(
  facility: { id?: string; category: string },
  recommendedId: string | null,
  triageActive: boolean,
): L.DivIcon {
  const style = CATEGORY_STYLES[facility.category] ?? DEFAULT_STYLE
  const isRecommended = triageActive && !!facility.id && facility.id === recommendedId
  const isCandidate = triageActive && !isRecommended

  const size = isRecommended ? 40 : 28
  const svgSize = isRecommended ? 60 : 36
  const textSize = isRecommended ? 17 : 12
  const opacity = isCandidate ? 0.55 : 1
  const bg = style.color

  const pulse = isRecommended
    ? `<circle
         cx="${svgSize / 2}" cy="${svgSize / 2}"
         r="${size / 2 + 4}"
         fill="none"
         stroke="${bg}"
         stroke-width="2"
         opacity="0.4">
         <animate attributeName="r"
           values="${size / 2 + 4};${size / 2 + 12}"
           dur="1.5s" repeatCount="indefinite"/>
         <animate attributeName="opacity"
           values="0.4;0" dur="1.5s" repeatCount="indefinite"/>
       </circle>`
    : ""

  const offset = (svgSize - size) / 2

  return L.divIcon({
    className: "",
    html: `<svg
             xmlns="http://www.w3.org/2000/svg"
             width="${svgSize}" height="${svgSize}"
             viewBox="0 0 ${svgSize} ${svgSize}"
             style="opacity:${opacity}">
      ${pulse}
      <rect
        x="${offset}" y="${offset}"
        width="${size}" height="${size}"
        rx="${size * 0.22}"
        fill="${bg}"
        filter="${isRecommended ? "drop-shadow(0 2px 5px rgba(0,0,0,0.35))" : "none"}"/>
      <text
        x="${svgSize / 2}" y="${svgSize / 2 + textSize * 0.38}"
        text-anchor="middle"
        font-family="system-ui, -apple-system, sans-serif"
        font-size="${textSize}"
        font-weight="700"
        fill="white">
        ${style.letter}
      </text>
    </svg>`,
    iconSize: [svgSize, svgSize],
    iconAnchor: [svgSize / 2, svgSize / 2],
    popupAnchor: [0, -(svgSize / 2 + 4)],
  })
}

function buildTriageCandidates(triage: TriageUIState): FacilityCandidate[] {
  if (!triage.active) return []
  if (triage.recommendedFacility) {
    return [triage.recommendedFacility, ...triage.nearbyFacilities]
  }
  return triage.nearbyFacilities
}


const LEGEND_ITEMS = [
  { color: "#C0392B", letter: "H", label: "Hospital" },
  { color: "#1A7A8A", letter: "A", label: "Walk-in / Clinic" },
  { color: "#5A7A4A", letter: "R", label: "Residential Care" },
  { color: "#185FA5", label: "Current location", isPin: true },
] as const

type CategoryFilter = "all" | "hospital" | "ambulatory" | "residential"

const FILTER_OPTIONS: Array<{ value: CategoryFilter; label: string; color: string }> = [
  { value: "all", label: "All types", color: "#334455" },
  { value: "hospital", label: "Hospital", color: "#C0392B" },
  { value: "ambulatory", label: "Walk-in / Clinic", color: "#1A7A8A" },
  { value: "residential", label: "Residential Care", color: "#5A7A4A" },
]

function CategoryFilterDropdown({
  value,
  onChange,
  counts,
}: {
  value: CategoryFilter
  onChange: (v: CategoryFilter) => void
  counts: Record<CategoryFilter, number>
}) {
  const selected = FILTER_OPTIONS.find(o => o.value === value)!
  const [isOpen, setIsOpen] = useState(false)
  const dropdownRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setIsOpen(false)
      }
    }
    document.addEventListener("mousedown", handleClickOutside)
    return () => document.removeEventListener("mousedown", handleClickOutside)
  }, [])

  return (
    <div className="relative group flex items-center" ref={dropdownRef}>
      <button
        onClick={() => setIsOpen(!isOpen)}
        className='map-category-filter appearance-none bg-white/80 hover:bg-white/95 backdrop-blur-md border border-gray-200/60 hover:border-gray-300/80 rounded-full py-2.5 pl-10 pr-11 text-xs font-bold text-gray-800 shadow-sm hover:shadow-md transition-all duration-300 ease-in-out cursor-pointer outline-none focus:ring-4 focus:ring-blue-500/10 focus:border-blue-500/30 flex items-center justify-between min-w-[180px] relative'
      >
        <div 
          className="absolute left-4 w-2.5 h-2.5 rounded-full shadow-sm transition-colors duration-300 pointer-events-none" 
          style={{ backgroundColor: selected.color }}
        />
        <span className="truncate flex-1 text-left">
          {selected.value === "all"
            ? `All types (${counts.all})`
            : `${selected.label} (${counts[selected.value]})`}
        </span>
        <div className="absolute right-4 pointer-events-none text-gray-400 group-hover:text-gray-600 transition-transform duration-300" style={{ transform: isOpen ? 'rotate(180deg)' : 'none' }}>
          <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
            <polyline points="6 9 12 15 18 9"></polyline>
          </svg>
        </div>
      </button>

      {isOpen && (
        <div className="absolute top-[calc(100%+8px)] right-0 min-w-[220px] bg-white/95 backdrop-blur-xl border border-gray-200/80 shadow-xl rounded-2xl overflow-hidden z-50 flex flex-col py-2">
          {FILTER_OPTIONS.map(opt => (
            <button
              key={opt.value}
              onClick={() => {
                onChange(opt.value)
                setIsOpen(false)
              }}
              className="flex items-center gap-3.5 px-5 py-3 hover:bg-gray-100/80 text-left transition-colors w-full"
            >
              <div 
                className="w-2.5 h-2.5 rounded-full shadow-sm flex-shrink-0" 
                style={{ backgroundColor: opt.color }}
              />
              <span className="text-xs font-bold text-gray-800">
                {opt.value === "all"
                  ? `All types (${counts.all})`
                  : `${opt.label} (${counts[opt.value]})`}
              </span>
            </button>
          ))}
        </div>
      )}
    </div>
  )
}

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

// Must be inside MapContainer to call useMap()
function MapSizeGuard({ sizeVersion }: { sizeVersion: number }) {
  const map = useMap()
  const isFirstRef = useRef(true)

  useEffect(() => {
    if (isFirstRef.current) {
      // Fix B: initial mount — give the DOM 100ms to paint at its real height
      isFirstRef.current = false
      const t = setTimeout(() => map.invalidateSize(), 100)
      return () => clearTimeout(t)
    }
    // Fix C: triggered by sizeVersion increment after tab-switch / expand-collapse.
    // The 150ms delay is already held by the caller; call immediately here.
    map.invalidateSize()
  }, [map, sizeVersion])

  return null
}

function UnifiedFacilityPopup({ name, category, address, distanceKm }: {
  name: string
  category: string
  address: string
  distanceKm?: number
}) {
  const style = CATEGORY_STYLES[category] ?? DEFAULT_STYLE
  return (
    <div style={{ minWidth: 160 }}>
      <p style={{ fontWeight: 700, fontSize: 13, marginBottom: 4, color: '#111' }}>
        {name}
      </p>
      <span style={{
        display: 'inline-block',
        background: style.color,
        color: 'white',
        fontSize: 10,
        fontWeight: 600,
        padding: '1px 6px',
        borderRadius: 4,
        marginBottom: 4,
        textTransform: 'uppercase',
        letterSpacing: '0.04em',
      }}>
        {style.label}
      </span>
      <p style={{ fontSize: 11, color: '#666', marginBottom: distanceKm != null ? 2 : 0 }}>
        {address}
      </p>
      {distanceKm != null && (
        <p style={{ fontSize: 11, color: '#666' }}>~{distanceKm} km away</p>
      )}
    </div>
  )
}

export function MapPanel({ facilities, facilitiesLoading, triage, verticalLegend = false, sizeVersion = 0, onClear }: MapPanelProps) {
  const isMobile = useBreakpoint()
  const pinnedIdRef = useRef<string | null>(null)

  const facilityHandlers = (id: string) => ({
    mouseover(e: L.LeafletMouseEvent) {
      if (!isMobile) {
        pinnedIdRef.current = null
        e.target.openPopup()
      }
    },
    mouseout(e: L.LeafletMouseEvent) {
      if (!isMobile && pinnedIdRef.current !== id) e.target.closePopup()
    },
    click() {
      pinnedIdRef.current = id
    },
    popupclose() {
      if (pinnedIdRef.current === id) pinnedIdRef.current = null
    },
  })

  const activeTriage = triage ?? INACTIVE_TRIAGE
  const triageCandidates = buildTriageCandidates(activeTriage)
  const recommendedId = activeTriage.recommendedFacilityId

  const [categoryFilter, setCategoryFilter] = useState<CategoryFilter>("all")

  useEffect(() => {
    if (activeTriage.active) setCategoryFilter("all")
  }, [activeTriage.active])

  const counts: Record<CategoryFilter, number> = {
    all: facilities.length,
    hospital: facilities.filter(f => f.category === "hospital").length,
    ambulatory: facilities.filter(f => f.category === "ambulatory").length,
    residential: facilities.filter(f => f.category === "residential").length,
  }

  const displayedFacilities = categoryFilter === "all"
    ? facilities
    : facilities.filter(f => f.category === categoryFilter)

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
          tileSize={512}
          zoomOffset={-1}
          detectRetina={true}
        />

        <MapFitBounds triage={activeTriage} />
        <MapSizeGuard sizeVersion={sizeVersion} />

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
              color: "#185FA5",
              weight: 3,
              dashArray: "10, 7",
              opacity: 0.85,
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
              icon={getFacilityIcon(facility, recommendedId, activeTriage.active)}
              eventHandlers={facilityHandlers(facility.id)}
            >
              <Popup>
                <UnifiedFacilityPopup
                  name={facility.name}
                  category={facility.category}
                  address={facility.address}
                  distanceKm={facility.distanceKm}
                />
              </Popup>
            </Marker>
          ))
          /* Facility markers — default state, filtered */
          : displayedFacilities.map(facility => (
            <Marker
              key={facility.id ?? facility.name}
              position={[facility.lat, facility.lng]}
              icon={getFacilityIcon(facility, null, false)}
              eventHandlers={facilityHandlers(facility.id ?? facility.name)}
            >
              <Popup>
                <UnifiedFacilityPopup
                  name={facility.name}
                  category={facility.category}
                  address={facility.address}
                />
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

      {/* Filter + status pill — top right, shared container */}
      <div style={{
        position: "absolute",
        top: 12,
        right: 12,
        zIndex: 20,
        display: "flex",
        alignItems: "center",
        gap: 8,
        pointerEvents: "auto",
      }}>
        {!activeTriage.active && (
          <CategoryFilterDropdown
            value={categoryFilter}
            onChange={setCategoryFilter}
            counts={counts}
          />
        )}
        <div className="bg-white/95 backdrop-blur-md border border-gray-200/50 rounded-full px-4 py-2.5 text-xs font-bold text-gray-800 shadow-md flex items-center gap-2.5 pointer-events-none">
          <span className="relative flex h-2.5 w-2.5">
            <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
            <span className="relative inline-flex rounded-full h-2.5 w-2.5 bg-emerald-500"></span>
          </span>
          {activeTriage.active
            ? `${triageCandidates.length} FACILITIES SHOWN`
            : categoryFilter === "all"
              ? `${facilitiesLoading ? '—' : facilities.length} FACILITIES ACTIVE`
              : `${displayedFacilities.length} OF ${facilities.length} SHOWN`
          }
        </div>
      </div>

      {/* Clear map — pill, top-right below the facilities badge, only when triage is active */}
      {onClear && activeTriage.active && (
        <button
          onClick={onClear}
          aria-label="Clear map"
          style={{
            position: 'absolute',
            top: 58,
            right: 12,
            zIndex: 20,
            display: 'flex',
            alignItems: 'center',
            gap: 5,
            background: 'white',
            border: '0.5px solid rgba(0,0,0,0.15)',
            borderRadius: 20,
            padding: '0 12px',
            height: 36,
            fontSize: 11,
            fontWeight: 500,
            color: '#1a3a5c',
            boxShadow: '0 1px 4px rgba(0,0,0,0.12)',
            cursor: 'pointer',
            whiteSpace: 'nowrap',
          }}
        >
          <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
            <circle cx="12" cy="12" r="10" />
            <path d="M15 9l-6 6M9 9l6 6" />
          </svg>
          Clear map
        </button>
      )}

      {/* Legend — bottom left */}
      <div className="absolute bottom-3 left-3 z-[15] bg-white/95 backdrop-blur-md border border-gray-200/80 rounded-lg px-3 py-2.5 shadow-lg pointer-events-none">
        <p className="text-[10px] font-bold text-gray-800 mb-2 uppercase tracking-wider">Facility Legend</p>
        <div className={verticalLegend ? "flex flex-col gap-1.5" : "flex items-center gap-3"}>
          {LEGEND_ITEMS.map(item => (
            <div key={item.label} className="flex items-center gap-1.5">
              {'isPin' in item ? (
                <span
                  className="w-2.5 h-2.5 rounded-full inline-block flex-none shadow-sm"
                  style={{ backgroundColor: item.color }}
                />
              ) : (
                <span
                  className="inline-flex items-center justify-center flex-none rounded shadow-sm"
                  style={{
                    width: 18, height: 18,
                    background: item.color,
                    fontSize: 10, fontWeight: 700, color: 'white',
                    borderRadius: 4,
                  }}
                >
                  {'letter' in item ? item.letter : ''}
                </span>
              )}
              <span className="text-[11px] font-semibold text-gray-600 leading-none">{item.label}</span>
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}
