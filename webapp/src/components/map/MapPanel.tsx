import 'leaflet/dist/leaflet.css'
import { useEffect, useState, useRef } from 'react'
import { MapContainer, TileLayer, Marker, Tooltip } from 'react-leaflet'
import type { Facility, TriageUIState } from '../../../../shared/types'
import { useBreakpoint } from '../../hooks/useBreakpoint'
import { cnTowerPos, INACTIVE_TRIAGE, buildTriageCandidates } from './config/constants'
import { cnTowerIcon } from './config/icons'
import { type CategoryFilter, FILTER_OPTIONS } from './config/categories'
import { MapProvider } from './context/MapContext'
import { MapFitBounds } from './layers/MapFitBounds'
import { MapSizeGuard } from './layers/MapSizeGuard'
import { RoadRouteLayer } from './layers/RoadRouteLayer'
import { FacilityMarkerLayer } from './components/FacilityMarkerLayer'
import { FacilityLegend } from './components/FacilityLegend'

interface MapPanelProps {
  facilities: Facility[]
  facilitiesLoading: boolean
  triage?: TriageUIState
  verticalLegend?: boolean
  sizeVersion?: number
  onClear?: () => void
}

// Short labels for filter chips
const CHIP_LABEL: Record<CategoryFilter, string> = {
  all: 'All',
  hospital: 'Hospital',
  ambulatory: 'Walk-in',
  residential: 'Residential',
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
            attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> &copy; <a href="https://carto.com/attributions">CARTO</a>'
            url="https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png"
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

      {/* Filter chips — top-left, hidden when triage is active */}
      {!activeTriage.active && (
        <div style={{ position: 'absolute', top: 12, left: 12, zIndex: 20, display: 'flex', gap: 6, pointerEvents: 'auto' }}>
          {FILTER_OPTIONS.map(opt => {
            const active = categoryFilter === opt.value
            return (
              <button
                key={opt.value}
                onClick={() => setCategoryFilter(opt.value)}
                style={{
                  padding: '5px 12px',
                  borderRadius: 999,
                  fontSize: 11,
                  fontWeight: 700,
                  letterSpacing: '0.02em',
                  border: `1px solid ${active ? opt.color : 'rgba(28,70,89,0.5)'}`,
                  background: active ? `${opt.color}22` : 'rgba(6,18,25,0.82)',
                  color: active ? opt.color : '#7AA0B0',
                  cursor: 'pointer',
                  backdropFilter: 'blur(12px)',
                  WebkitBackdropFilter: 'blur(12px)',
                  whiteSpace: 'nowrap',
                  transition: 'all 0.15s ease',
                }}
              >
                {CHIP_LABEL[opt.value]} ({opt.value === 'all' ? counts.all : counts[opt.value]})
              </button>
            )
          })}
        </div>
      )}

      {/* Loading indicator */}
      {facilitiesLoading && (
        <div style={{
          position: 'absolute', top: 52, left: 12, zIndex: 15,
          background: 'rgba(6, 18, 25, 0.85)',
          backdropFilter: 'blur(12px)',
          WebkitBackdropFilter: 'blur(12px)',
          border: '1px solid rgba(28, 70, 89, 0.6)',
          borderRadius: 8, padding: '6px 10px', fontSize: 12, color: '#7AA0B0',
          display: 'flex', alignItems: 'center', gap: 6,
        }}>
          <span style={{ width: 12, height: 12, borderRadius: '50%', border: '2px solid #48F6C1', borderTopColor: 'transparent', display: 'inline-block', animation: 'spin 0.8s linear infinite' }} />
          Loading facilities…
        </div>
      )}

      {/* Top-right: clear + facilities badge */}
      <div style={{ position: 'absolute', top: 12, right: 12, zIndex: 20, display: 'flex', alignItems: 'center', gap: 8, pointerEvents: 'auto' }}>
        {onClear && activeTriage.active && (
          <button
            onClick={onClear}
            aria-label="Clear map"
            style={{
              display: 'flex', alignItems: 'center', gap: 6,
              padding: '5px 12px',
              fontSize: 11, fontWeight: 700,
              background: 'rgba(176, 58, 58, 0.15)',
              border: '1px solid rgba(224, 85, 85, 0.5)',
              borderRadius: 999,
              color: '#E05555',
              cursor: 'pointer',
              backdropFilter: 'blur(12px)',
              WebkitBackdropFilter: 'blur(12px)',
              transition: 'all 0.15s ease',
            }}
            onMouseEnter={e => {
              ;(e.currentTarget as HTMLElement).style.background = 'rgba(176, 58, 58, 0.28)'
              ;(e.currentTarget as HTMLElement).style.borderColor = 'rgba(224, 85, 85, 0.8)'
            }}
            onMouseLeave={e => {
              ;(e.currentTarget as HTMLElement).style.background = 'rgba(176, 58, 58, 0.15)'
              ;(e.currentTarget as HTMLElement).style.borderColor = 'rgba(224, 85, 85, 0.5)'
            }}
          >
            <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
              <path d="M18 6L6 18M6 6l12 12" />
            </svg>
            Clear map
          </button>
        )}
        <div style={{
          background: 'rgba(6, 18, 25, 0.85)',
          backdropFilter: 'blur(12px)',
          WebkitBackdropFilter: 'blur(12px)',
          border: '1px solid rgba(28, 70, 89, 0.6)',
          borderRadius: 999,
          padding: '6px 14px',
          fontSize: 11, fontWeight: 700,
          color: '#7AA0B0',
          display: 'flex', alignItems: 'center', gap: 8,
          pointerEvents: 'none',
        }}>
          <span style={{ position: 'relative', display: 'inline-flex', width: 8, height: 8 }}>
            <span
              className="animate-ping absolute inline-flex h-full w-full rounded-full"
              style={{ background: '#48F6C1', opacity: 0.75 }}
            />
            <span style={{ position: 'relative', width: 8, height: 8, borderRadius: '50%', background: '#48F6C1' }} />
          </span>
          {activeTriage.active
            ? `${triageCandidates.length} FACILITIES SHOWN`
            : categoryFilter === 'all'
              ? `${facilitiesLoading ? '—' : facilities.length} FACILITIES ACTIVE`
              : `${displayedFacilities.length} OF ${facilities.length} SHOWN`
          }
        </div>
      </div>

      <FacilityLegend verticalLegend={verticalLegend} />
    </div>
  )
}
