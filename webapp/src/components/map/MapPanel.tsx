import 'leaflet/dist/leaflet.css'
import { useEffect, useState, useRef } from 'react'
import { MapContainer, TileLayer, Marker, Tooltip } from 'react-leaflet'
import type { Facility, TriageUIState } from '../../../../shared/types'
import { useBreakpoint } from '../../hooks/useBreakpoint'
import { cnTowerPos, INACTIVE_TRIAGE, buildTriageCandidates } from './config/constants'
import { cnTowerIcon } from './config/icons'
import { type CategoryFilter } from './config/categories'
import { MapProvider } from './context/MapContext'
import { MapFitBounds } from './layers/MapFitBounds'
import { MapSizeGuard } from './layers/MapSizeGuard'
import { RoadRouteLayer } from './layers/RoadRouteLayer'
import { FacilityMarkerLayer } from './components/FacilityMarkerLayer'
import { FacilityLegend } from './components/FacilityLegend'
import { CategoryFilterDropdown } from './components/CategoryFilterDropdown'

interface MapPanelProps {
  facilities: Facility[]
  facilitiesLoading: boolean
  triage?: TriageUIState
  verticalLegend?: boolean
  sizeVersion?: number
  onClear?: () => void
}

export function MapPanel({ facilities, facilitiesLoading, triage, verticalLegend = false, sizeVersion = 0, onClear }: MapPanelProps) {
  const isMobile = useBreakpoint()
  const pinnedIdRef = useRef<string | null>(null)

  const activeTriage = triage ?? INACTIVE_TRIAGE
  const triageCandidates = buildTriageCandidates(activeTriage)
  const recommendedId = activeTriage.recommendedFacilityId

  const [categoryFilter, setCategoryFilter] = useState<CategoryFilter>("all")

  useEffect(() => {
    if (activeTriage.active) setCategoryFilter("all")
  }, [activeTriage.active])

  const counts = {
    all: facilities.length,
    hospital: facilities.filter(f => f.category === "hospital").length,
    ambulatory: facilities.filter(f => f.category === "ambulatory").length,
    residential: facilities.filter(f => f.category === "residential").length,
  }

  const displayedFacilities = categoryFilter === "all"
    ? facilities
    : facilities.filter(f => f.category === categoryFilter)

  return (
    <div className="relative h-full w-full isolate">
      <MapContainer center={cnTowerPos} zoom={13} scrollWheelZoom={false} zoomControl={true} className="h-full w-full z-0">
        <MapProvider activeTriage={activeTriage} recommendedId={recommendedId} isMobile={isMobile}>
          <TileLayer
            attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>'
            url="https://{s}.basemaps.cartocdn.com/rastertiles/voyager/{z}/{x}/{y}{r}.png"
            tileSize={512}
            zoomOffset={-1}
            detectRetina={true}
          />
          <MapFitBounds />
          <MapSizeGuard sizeVersion={sizeVersion} />
          <Marker position={cnTowerPos} icon={cnTowerIcon}>
            <Tooltip className="text-[13px] font-semibold" direction="top">CN Tower Area</Tooltip>
          </Marker>
          <RoadRouteLayer />
          <FacilityMarkerLayer
            displayedFacilities={displayedFacilities}
            triageCandidates={triageCandidates}
            pinnedIdRef={pinnedIdRef}
          />
        </MapProvider>
      </MapContainer>

      {facilitiesLoading && (
        <div style={{ position: 'absolute', top: 52, left: 12, zIndex: 15, background: 'rgba(255,255,255,0.88)', borderRadius: 8, padding: '6px 10px', fontSize: 12, color: '#557', display: 'flex', alignItems: 'center', gap: 6 }}>
          <span style={{ width: 12, height: 12, borderRadius: '50%', border: '2px solid #185FA5', borderTopColor: 'transparent', display: 'inline-block', animation: 'spin 0.8s linear infinite' }} />
          Loading facilities…
        </div>
      )}

      <div style={{ position: "absolute", top: 12, right: 12, zIndex: 20, display: "flex", alignItems: "center", gap: 8, pointerEvents: "auto" }}>
        {!activeTriage.active && (
          <CategoryFilterDropdown value={categoryFilter} onChange={setCategoryFilter} counts={counts} />
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

      {onClear && activeTriage.active && (
        <button
          onClick={onClear}
          aria-label="Clear map"
          className="absolute top-[58px] right-3 z-20 group flex items-center gap-2 bg-white/80 hover:bg-rose-50/90 active:bg-rose-100/90 backdrop-blur-md border border-gray-200/60 hover:border-rose-200/80 rounded-full px-4 py-2 text-xs font-bold text-gray-600 hover:text-rose-500 shadow-sm hover:shadow-md transition-all duration-300 ease-in-out cursor-pointer outline-none focus:ring-4 focus:ring-rose-500/10 active:scale-95 whitespace-nowrap"
        >
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true" className="transition-transform group-hover:rotate-90 duration-300">
            <path d="M18 6L6 18M6 6l12 12" />
          </svg>
          <span>Clear map</span>
        </button>
      )}

      <FacilityLegend verticalLegend={verticalLegend} />
    </div>
  )
}
