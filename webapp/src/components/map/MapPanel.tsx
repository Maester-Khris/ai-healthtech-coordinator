import 'leaflet/dist/leaflet.css'
import { useEffect, useState, useRef } from 'react'
import { MapContainer, TileLayer, Marker, Tooltip } from 'react-leaflet'
import type { Facility, TriageUIState } from '../../../../shared/types'
import { useBreakpoint } from '../../hooks/useBreakpoint'
import { cnTowerPos, INACTIVE_TRIAGE, buildTriageCandidates } from './config/constants'
import { cnTowerIcon, userIcon } from './config/icons'
import { useGeolocation } from '../../hooks/useGeolocation'
import { useMap } from 'react-leaflet'
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
  const [travelMode, setTravelMode] = useState<'car' | 'bike' | 'bus'>('car')

  const geo = useGeolocation()

  const [openNow, setOpenNow] = useState(false)
  const [waitTime, setWaitTime] = useState<string>('all')
  const [proximity, setProximity] = useState<string>('all')

  const [waitDropdownOpen, setWaitDropdownOpen] = useState(false)
  const [proxDropdownOpen, setProxDropdownOpen] = useState(false)

  const waitRef = useRef<HTMLDivElement>(null)
  const proxRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    function handleClickOutside(e: MouseEvent) {
      if (waitRef.current && !waitRef.current.contains(e.target as Node)) {
        setWaitDropdownOpen(false)
      }
      if (proxRef.current && !proxRef.current.contains(e.target as Node)) {
        setProxDropdownOpen(false)
      }
    }
    document.addEventListener('mousedown', handleClickOutside)
    return () => document.removeEventListener('mousedown', handleClickOutside)
  }, [])

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
      <MapContainer center={cnTowerPos} zoom={12} scrollWheelZoom={false} zoomControl={true} className="h-full w-full z-0">
        <MapProvider activeTriage={activeTriage} recommendedId={recommendedId} isMobile={isMobile}>
          <TileLayer
            attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> &copy; <a href="https://carto.com/attributions">CARTO</a>'
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
          <RoadRouteLayer travelMode={travelMode} />
          <FacilityMarkerLayer
            displayedFacilities={displayedFacilities}
            triageCandidates={triageCandidates}
            pinnedIdRef={pinnedIdRef}
          />
          {/* User Location marker */}
          {(activeTriage.userCoords || geo.coords) && (
            <Marker position={[activeTriage.userCoords?.lat ?? geo.coords!.lat, activeTriage.userCoords?.lng ?? geo.coords!.lng]} icon={userIcon}>
              <Tooltip className="text-[13px] font-semibold" direction="top">Your Location</Tooltip>
            </Marker>
          )}
          {/* Focus User Location button */}
          <FocusUserButton geo={geo} />
        </MapProvider>
      </MapContainer>

      {/* Travel mode selector when triage is active */}
      {activeTriage.active && (
        <div style={{
          position: 'absolute',
          top: 12,
          left: 54,
          zIndex: 20,
          background: 'rgba(10, 29, 39, 0.8)',
          backdropFilter: 'blur(12px)',
          border: '1px solid rgba(28, 70, 89, 0.6)',
          borderRadius: 10,
          padding: '3px',
          display: 'flex',
          gap: 3,
          pointerEvents: 'auto'
        }}>
          {(['car', 'bike', 'bus'] as const).map(mode => {
            const isActive = travelMode === mode
            const icons = { car: 'ti ti-car', bike: 'ti ti-bike', bus: 'ti ti-bus' }
            const labels = { car: 'Drive', bike: 'Cycle', bus: 'Transit' }
            return (
              <button
                key={mode}
                onClick={() => setTravelMode(mode)}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: 5,
                  padding: '5px 12px',
                  borderRadius: 7,
                  border: 'none',
                  background: isActive ? '#48F6C1' : 'transparent',
                  color: isActive ? '#061219' : '#A0B8C4',
                  fontSize: 11,
                  fontWeight: 600,
                  cursor: 'pointer',
                  transition: 'all 0.2s',
                }}
                onMouseEnter={e => {
                  if (!isActive) {
                    ;(e.currentTarget as HTMLElement).style.background = 'rgba(72,246,193,0.08)'
                    ;(e.currentTarget as HTMLElement).style.color = '#E2F1F5'
                  }
                }}
                onMouseLeave={e => {
                  if (!isActive) {
                    ;(e.currentTarget as HTMLElement).style.background = 'transparent'
                    ;(e.currentTarget as HTMLElement).style.color = '#A0B8C4'
                  }
                }}
              >
                <i className={icons[mode]} style={{ fontSize: 13 }} />
                <span>{labels[mode]}</span>
              </button>
            )
          })}
        </div>
      )}

      {/* Filter chips — top-left, hidden when triage is active */}
      {!activeTriage.active && (
        <div style={{ position: 'absolute', top: 12, left: 54, zIndex: 20, display: 'flex', flexDirection: 'column', gap: 8, pointerEvents: 'auto' }}>
          {/* Category Filter Chips */}
          <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
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

          {/* Static/Interactive Sub-filters */}
          <div style={{ display: 'flex', gap: 6, alignItems: 'center' }}>
            {/* Open Now toggle */}
            <button
              onClick={() => setOpenNow(!openNow)}
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: 5,
                padding: '5px 12px',
                borderRadius: 999,
                fontSize: 11,
                fontWeight: 700,
                letterSpacing: '0.02em',
                border: `1px solid ${openNow ? '#48F6C1' : 'rgba(28,70,89,0.5)'}`,
                background: openNow ? 'rgba(72,246,193,0.15)' : 'rgba(6,18,25,0.82)',
                color: openNow ? '#48F6C1' : '#7AA0B0',
                cursor: 'pointer',
                backdropFilter: 'blur(12px)',
                WebkitBackdropFilter: 'blur(12px)',
                transition: 'all 0.15s ease',
              }}
            >
              <i className="ti ti-clock" style={{ fontSize: 12 }} />
              Open Now
            </button>

            {/* Wait Time Dropdown */}
            <div ref={waitRef} style={{ position: 'relative' }}>
              <button
                onClick={() => setWaitDropdownOpen(!waitDropdownOpen)}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: 5,
                  padding: '5px 12px',
                  borderRadius: 999,
                  fontSize: 11,
                  fontWeight: 700,
                  letterSpacing: '0.02em',
                  border: `1px solid ${waitTime !== 'all' ? '#48F6C1' : 'rgba(28,70,89,0.5)'}`,
                  background: waitTime !== 'all' ? 'rgba(72,246,193,0.15)' : 'rgba(6,18,25,0.82)',
                  color: waitTime !== 'all' ? '#48F6C1' : '#7AA0B0',
                  cursor: 'pointer',
                  backdropFilter: 'blur(12px)',
                  WebkitBackdropFilter: 'blur(12px)',
                  transition: 'all 0.15s ease',
                }}
              >
                <i className="ti ti-hourglass-high" style={{ fontSize: 12 }} />
                {waitTime === 'all' ? 'Wait Time: All' : `Wait: ${waitTime}`}
                <svg width="10" height="10" viewBox="0 0 12 12" fill="none" style={{ transform: waitDropdownOpen ? 'rotate(180deg)' : 'none', transition: 'transform 0.15s ease', display: 'inline-block', verticalAlign: 'middle', marginLeft: 2 }}>
                  <path d="M2 4l4 4 4-4" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
                </svg>
              </button>

              {waitDropdownOpen && (
                <div style={{
                  position: 'absolute',
                  top: 'calc(100% + 6px)',
                  left: 0,
                  zIndex: 30,
                  background: 'rgba(6, 18, 25, 0.95)',
                  backdropFilter: 'blur(12px)',
                  WebkitBackdropFilter: 'blur(12px)',
                  border: '1px solid rgba(28, 70, 89, 0.6)',
                  borderRadius: 8,
                  padding: '4px 0',
                  minWidth: 140,
                  boxShadow: '0 8px 24px rgba(0,0,0,0.3)',
                }}>
                  {[
                    { value: 'all', label: 'All wait times' },
                    { value: '> 10 min', label: '> 10 min' },
                    { value: '> 25 min', label: '> 25 min' },
                    { value: '30 min+', label: '30 min+' },
                  ].map(opt => (
                    <button
                      key={opt.value}
                      onClick={() => {
                        setWaitTime(opt.value)
                        setWaitDropdownOpen(false)
                      }}
                      style={{
                        width: '100%',
                        padding: '7px 14px',
                        background: 'none',
                        border: 'none',
                        textAlign: 'left',
                        fontSize: 11,
                        fontWeight: 600,
                        color: waitTime === opt.value ? '#48F6C1' : '#A0B8C4',
                        cursor: 'pointer',
                        display: 'block',
                      }}
                      onMouseEnter={e => e.currentTarget.style.background = 'rgba(28, 70, 89, 0.3)'}
                      onMouseLeave={e => e.currentTarget.style.background = 'none'}
                    >
                      {opt.label}
                    </button>
                  ))}
                </div>
              )}
            </div>

            {/* Proximity Dropdown */}
            <div ref={proxRef} style={{ position: 'relative' }}>
              <button
                onClick={() => setProxDropdownOpen(!proxDropdownOpen)}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: 5,
                  padding: '5px 12px',
                  borderRadius: 999,
                  fontSize: 11,
                  fontWeight: 700,
                  letterSpacing: '0.02em',
                  border: `1px solid ${proximity !== 'all' ? '#48F6C1' : 'rgba(28,70,89,0.5)'}`,
                  background: proximity !== 'all' ? 'rgba(72,246,193,0.15)' : 'rgba(6,18,25,0.82)',
                  color: proximity !== 'all' ? '#48F6C1' : '#7AA0B0',
                  cursor: 'pointer',
                  backdropFilter: 'blur(12px)',
                  WebkitBackdropFilter: 'blur(12px)',
                  transition: 'all 0.15s ease',
                }}
              >
                <i className="ti ti-map-pin" style={{ fontSize: 12 }} />
                {proximity === 'all' ? 'Proximity: All' : `Dist: ${proximity}`}
                <svg width="10" height="10" viewBox="0 0 12 12" fill="none" style={{ transform: proxDropdownOpen ? 'rotate(180deg)' : 'none', transition: 'transform 0.15s ease', display: 'inline-block', verticalAlign: 'middle', marginLeft: 2 }}>
                  <path d="M2 4l4 4 4-4" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
                </svg>
              </button>

              {proxDropdownOpen && (
                <div style={{
                  position: 'absolute',
                  top: 'calc(100% + 6px)',
                  left: 0,
                  zIndex: 30,
                  background: 'rgba(6, 18, 25, 0.95)',
                  backdropFilter: 'blur(12px)',
                  WebkitBackdropFilter: 'blur(12px)',
                  border: '1px solid rgba(28, 70, 89, 0.6)',
                  borderRadius: 8,
                  padding: '4px 0',
                  minWidth: 140,
                  boxShadow: '0 8px 24px rgba(0,0,0,0.3)',
                }}>
                  {[
                    { value: 'all', label: 'All distances' },
                    { value: '10 km', label: '10 km' },
                    { value: '25 km', label: '25 km' },
                    { value: '50 km', label: '50 km' },
                    { value: '50 km+', label: '50 km+' },
                  ].map(opt => (
                    <button
                      key={opt.value}
                      onClick={() => {
                        setProximity(opt.value)
                        setProxDropdownOpen(false)
                      }}
                      style={{
                        width: '100%',
                        padding: '7px 14px',
                        background: 'none',
                        border: 'none',
                        textAlign: 'left',
                        fontSize: 11,
                        fontWeight: 600,
                        color: proximity === opt.value ? '#48F6C1' : '#A0B8C4',
                        cursor: 'pointer',
                        display: 'block',
                      }}
                      onMouseEnter={e => e.currentTarget.style.background = 'rgba(28, 70, 89, 0.3)'}
                      onMouseLeave={e => e.currentTarget.style.background = 'none'}
                    >
                      {opt.label}
                    </button>
                  ))}
                </div>
              )}
            </div>
          </div>
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

function FocusUserButton({ geo }: { geo: any }) {
  const map = useMap()

  const handleFocus = async () => {
    const coords = await geo.requestOnce()
    if (coords) {
      map.setView([coords.lat, coords.lng], 15, { animate: true })
    }
  }

  return (
    <button
      onClick={handleFocus}
      title="Focus on my location"
      style={{
        position: 'absolute',
        bottom: 16,
        right: 16,
        zIndex: 1000,
        width: 38,
        height: 38,
        borderRadius: '50%',
        background: 'rgba(6, 18, 25, 0.85)',
        backdropFilter: 'blur(12px)',
        WebkitBackdropFilter: 'blur(12px)',
        border: '1px solid rgba(28, 70, 89, 0.6)',
        color: '#48F6C1',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        cursor: 'pointer',
        boxShadow: '0 4px 12px rgba(0, 0, 0, 0.3)',
        transition: 'all 0.2s ease',
      }}
      onMouseEnter={e => {
        e.currentTarget.style.background = 'rgba(6, 18, 25, 0.95)'
        e.currentTarget.style.borderColor = '#48F6C1'
        e.currentTarget.style.transform = 'scale(1.05)'
      }}
      onMouseLeave={e => {
        e.currentTarget.style.background = 'rgba(6, 18, 25, 0.85)'
        e.currentTarget.style.borderColor = 'rgba(28, 70, 89, 0.6)'
        e.currentTarget.style.transform = 'scale(1)'
      }}
    >
      {geo.requesting ? (
        <span style={{
          width: 14,
          height: 14,
          borderRadius: '50%',
          border: '2px solid #48F6C1',
          borderTopColor: 'transparent',
          animation: 'spin 0.8s linear infinite',
          display: 'inline-block',
        }} />
      ) : (
        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
          <circle cx="12" cy="12" r="10" />
          <circle cx="12" cy="12" r="3" fill="currentColor" />
          <line x1="12" y1="1" x2="12" y2="3" />
          <line x1="12" y1="21" x2="12" y2="23" />
          <line x1="1" y1="12" x2="3" y2="12" />
          <line x1="21" y1="12" x2="23" y2="12" />
        </svg>
      )}
    </button>
  )
}
