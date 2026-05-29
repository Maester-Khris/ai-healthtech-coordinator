import { useState, useEffect } from 'react'
import type { Facility, TriageUIState } from '@shared/types'
import { MapPanel } from '../../Menucomponents/subcomponent/MapPanel'
import { BottomSheet } from './BottomSheet'
import { FacilityCard } from './FacilityCard'
import { SymptomInput } from './SymptomInput'
import { useBottomSheet } from '../../hooks/useBottomSheet'
import { useNextActions } from '../../hooks/useNextActions'

const NAV_H = 44
const TAB_H = 36
const COLLAPSED_MAP_H = 210
const SLIM_BAR_H = 70

interface MapTabProps {
  facilities: Facility[]
  facilitiesLoading: boolean
  triage: TriageUIState
  symptomValue: string
  onSymptomChange: (v: string) => void
  onSymptomSend: () => void
  inputDisabled: boolean
}

export function MapTab({
  facilities,
  facilitiesLoading,
  triage,
  symptomValue,
  onSymptomChange,
  onSymptomSend,
  inputDisabled,
}: MapTabProps) {
  const [availH, setAvailH] = useState(() => window.innerHeight - NAV_H - TAB_H)

  useEffect(() => {
    const onResize = () => setAvailH(window.innerHeight - NAV_H - TAB_H)
    window.addEventListener('resize', onResize)
    return () => window.removeEventListener('resize', onResize)
  }, [])

  const {
    sheetState,
    dragOffset,
    isDragging,
    handleTouchStart,
    handleTouchMove,
    handleTouchEnd,
  } = useBottomSheet()

  const { getDirections } = useNextActions(triage.severity)

  const isExpanded = sheetState === 'expanded'
  const expandedMapH = availH - SLIM_BAR_H
  const baseMapH = isExpanded ? expandedMapH : COLLAPSED_MAP_H
  // dragOffset > 0 = dragged up (finger toward top) → map grows
  // dragOffset < 0 = dragged down (finger toward bottom) → map shrinks
  const liveMapH = Math.max(SLIM_BAR_H, Math.min(expandedMapH, baseMapH + dragOffset))
  const liveSheetH = availH - liveMapH

  const recommended = triage.recommendedFacility
  const route = triage.routes.find(r => r.facilityId === triage.recommendedFacilityId)

  return (
    <div className="flex flex-col overflow-hidden" style={{ height: availH }}>
      {/* Map */}
      <div
        style={{
          height: liveMapH,
          flexShrink: 0,
          transition: isDragging ? 'none' : 'height 0.25s ease',
        }}
      >
        <MapPanel
          facilities={facilities}
          facilitiesLoading={facilitiesLoading}
          triage={triage}
          verticalLegend
        />
      </div>

      {/* Draggable bottom sheet */}
      <BottomSheet
        height={liveSheetH}
        isDragging={isDragging}
        onTouchStart={handleTouchStart}
        onTouchMove={handleTouchMove}
        onTouchEnd={handleTouchEnd}
        showHint={!isExpanded}
      >
        {isExpanded ? (
          // Slim persistent bar — facility summary + Nav + input
          <div className="flex items-center gap-2 px-3 flex-1 min-w-0">
            {recommended && (
              <>
                <div className="flex-1 min-w-0 mr-1">
                  <p className="text-[11px] font-semibold text-gray-900 truncate leading-tight">
                    {recommended.name}
                  </p>
                  {route && (
                    <p className="text-[9px] text-gray-500">
                      {route.etaMinutes} min · {route.distanceKm} km
                    </p>
                  )}
                </div>
                <button
                  onClick={() => getDirections(recommended.name, recommended.lat, recommended.lng)}
                  className="flex-none text-[11px] font-bold text-white rounded-lg px-3"
                  style={{ background: '#1a3a5c', minHeight: 44, minWidth: 44 }}
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
              className="flex-1"
            />
          </div>
        ) : (
          // Collapsed — facility card + symptom input
          <div className="flex flex-col flex-1 overflow-y-auto min-h-0">
            {triage.active ? (
              <FacilityCard triage={triage} />
            ) : (
              <div className="flex flex-1 items-center justify-center px-4 py-4">
                <p className="text-[11px] text-gray-400 text-center">
                  Describe your symptoms to get a recommendation
                </p>
              </div>
            )}
            <div className="flex-none px-3 pb-3 mt-auto">
              <SymptomInput
                value={symptomValue}
                onChange={onSymptomChange}
                onSend={onSymptomSend}
                disabled={inputDisabled}
              />
            </div>
          </div>
        )}
      </BottomSheet>
    </div>
  )
}
