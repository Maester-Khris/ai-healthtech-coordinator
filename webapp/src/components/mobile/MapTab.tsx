import { useState, useEffect, useRef, useLayoutEffect } from 'react'
import type { Facility, TriageUIState } from '@shared/types'
import { MapPanel } from '../map'
import { BottomSheet } from './BottomSheet'
import { FacilityCard } from './FacilityCard'
import { SymptomInput } from './SymptomInput'
/* DRAG DISABLED — revisit later */
// import { useBottomSheet } from '../../hooks/useBottomSheet'
/* DRAG DISABLED — revisit later */
import { useNextActions } from '../../hooks/useNextActions'

const NAV_H = 56
const DOCK_H = 64
const MIN_SHEET_H = 70
const INPUT_BAR_H = 72  // height of the slim input-only sheet when triage is inactive

interface MapTabProps {
  facilities: Facility[]
  facilitiesLoading: boolean
  triage: TriageUIState
  symptomValue: string
  onSymptomChange: (v: string) => void
  onSymptomSend: () => void
  inputDisabled: boolean
  visible: boolean
  onClear: () => void
}

export function MapTab({
  facilities,
  facilitiesLoading,
  triage,
  symptomValue,
  onSymptomChange,
  onSymptomSend,
  inputDisabled,
  visible,
  onClear,
}: MapTabProps) {
  const [availH, setAvailH] = useState(() => window.innerHeight - NAV_H - DOCK_H)
  const [mapExpanded, setMapExpanded] = useState(false)
  const [sizeVersion, setSizeVersion] = useState(0)

  useEffect(() => {
    let timer: ReturnType<typeof setTimeout>
    const onResize = () => {
      clearTimeout(timer)
      timer = setTimeout(() => setAvailH(window.innerHeight - NAV_H - DOCK_H), 100)
    }
    window.addEventListener('resize', onResize)
    return () => {
      window.removeEventListener('resize', onResize)
      clearTimeout(timer)
    }
  }, [])

  const mapRef = useRef<HTMLDivElement>(null)
  const sheetRef = useRef<HTMLDivElement>(null)
  const mapExpandedRef = useRef(false)
  const isFirstVisibleRender = useRef(true)
  const prevTriageActiveRef = useRef(triage.active)

  const getTargetMapH = (h: number, expanded: boolean, active: boolean) => {
    if (expanded) return h - MIN_SHEET_H
    return active ? Math.round(h * 0.70) : h - INPUT_BAR_H
  }

  // Fix C — invalidate Leaflet size when this tab becomes visible after a tab switch.
  // Skip the very first render (initial mount handled by MapSizeGuard inside MapPanel).
  useEffect(() => {
    if (isFirstVisibleRender.current) {
      isFirstVisibleRender.current = false
      return
    }
    if (visible) {
      setTimeout(() => setSizeVersion(v => v + 1), 150)
    }
  }, [visible])

  /* DRAG DISABLED — revisit later
  const { sheetState, handleTouchStart, handleTouchMove, handleTouchEnd } = useBottomSheet({
    mapRef,
    sheetRef,
    availH,
    initialMapH,
  })
  DRAG DISABLED — revisit later */

  // Set heights synchronously before paint on window resize
  useLayoutEffect(() => {
    const mapEl = mapRef.current
    const sheetEl = sheetRef.current
    if (!mapEl || !sheetEl) return
    const mapH = getTargetMapH(availH, mapExpandedRef.current, triage.active)
    mapEl.style.height = mapH + 'px'
    sheetEl.style.height = (availH - mapH) + 'px'
  }, [availH]) // eslint-disable-line react-hooks/exhaustive-deps

  // Animate map/sheet resize when triage becomes active or is cleared
  useEffect(() => {
    if (prevTriageActiveRef.current === triage.active) return
    prevTriageActiveRef.current = triage.active
    const mapEl = mapRef.current
    const sheetEl = sheetRef.current
    if (!mapEl || !sheetEl || mapExpandedRef.current) return
    const targetMapH = getTargetMapH(availH, false, triage.active)
    mapEl.style.transition = 'height 0.35s ease'
    sheetEl.style.transition = 'height 0.35s ease'
    mapEl.style.height = targetMapH + 'px'
    sheetEl.style.height = (availH - targetMapH) + 'px'
    setTimeout(() => {
      if (mapRef.current) mapRef.current.style.transition = ''
      if (sheetRef.current) sheetRef.current.style.transition = ''
    }, 380)
    setTimeout(() => setSizeVersion(v => v + 1), 150)
  }, [triage.active]) // eslint-disable-line react-hooks/exhaustive-deps

  const toggleExpand = () => {
    const mapEl = mapRef.current
    const sheetEl = sheetRef.current
    if (!mapEl || !sheetEl) return
    const next = !mapExpanded
    mapExpandedRef.current = next
    mapEl.style.transition = 'height 0.3s ease'
    sheetEl.style.transition = 'height 0.3s ease'
    const targetMapH = getTargetMapH(availH, next, triage.active)
    mapEl.style.height = targetMapH + 'px'
    sheetEl.style.height = (availH - targetMapH) + 'px'
    setTimeout(() => {
      if (mapRef.current) mapRef.current.style.transition = ''
      if (sheetRef.current) sheetRef.current.style.transition = ''
    }, 320)
    setMapExpanded(next)
    // Fix C — tell Leaflet the container has resized after the height transition starts
    setTimeout(() => setSizeVersion(v => v + 1), 150)
  }

  const { getDirections } = useNextActions(triage.severity)

  const isExpanded = mapExpanded
  const recommended = triage.recommendedFacility
  const route = triage.routes.find(r => r.facilityId === triage.recommendedFacilityId)

  return (
    <div className="flex flex-col overflow-hidden" style={{ height: availH }}>
      {/* Map — overflow:visible so the toggle button can protrude */}
      <div
        ref={mapRef}
        style={{
          flexShrink: 0,
          position: 'relative',
          overflow: 'visible',
        }}
      >
        <MapPanel
          facilities={facilities}
          facilitiesLoading={facilitiesLoading}
          triage={triage}
          verticalLegend
          sizeVersion={sizeVersion}
          onClear={onClear}
        />
        {/* Expand/collapse button — right side of map, vertically centered */}
        <button
          onClick={toggleExpand}
          aria-label={isExpanded ? 'Collapse map' : 'Expand map'}
          style={{
            position: 'absolute',
            right: 8,
            top: '50%',
            transform: 'translateY(-50%)',
            width: 32,
            height: 32,
            borderRadius: '50%',
            background: 'white',
            boxShadow: '0 2px 6px rgba(0,0,0,0.15)',
            border: 'none',
            cursor: 'pointer',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            fontSize: 20,
            fontWeight: 'bold',
            lineHeight: 1,
            color: 'var(--color-stratum-accent)',
            zIndex: 1000,
          }}
        >
          {isExpanded ? '−' : '+'}
        </button>
      </div>

      {/* Bottom sheet — height managed imperatively via sheetRef */}
      <BottomSheet ref={sheetRef}>
        {isExpanded ? (
          // Slim persistent bar — facility summary + Nav + input
          <div className="flex items-center gap-2 px-3 flex-1 min-w-0">
            {recommended && (
              <>
                <div className="flex-1 min-w-0 mr-1">
                  <p className="text-[11px] font-semibold text-stratum-text truncate leading-tight">
                    {recommended.name}
                  </p>
                  {route && (
                    <p className="text-[9px] text-stratum-text-muted">
                      {route.etaMinutes} min · {route.distanceKm} km
                    </p>
                  )}
                </div>
                <button
                  onClick={() => getDirections(recommended.name, recommended.lat, recommended.lng)}
                  className="flex-none text-[11px] font-bold text-white rounded-stratum-md px-3"
                  style={{ background: 'var(--color-stratum-accent)', minHeight: 44, minWidth: 44 }}
                >
                  Nav
                </button>
              </>
            )}
            <SymptomInput
              value={symptomValue}
              onChange={onSymptomChange}
              onSend={onSymptomSend}
              disabled={inputDisabled}
              className="flex-1 bg-white"
            />
          </div>
        ) : (
          // Collapsed — facility card (when active) + symptom input
          <div className="flex flex-col flex-1 overflow-y-auto min-h-0">
            {triage.active && <FacilityCard triage={triage} />}
            <div className="flex-none px-3 py-2 mt-auto">
              <SymptomInput
                value={symptomValue}
                onChange={onSymptomChange}
                onSend={onSymptomSend}
                disabled={inputDisabled}
                className="bg-white"
              />
            </div>
          </div>
        )}
      </BottomSheet>
    </div>
  )
}
