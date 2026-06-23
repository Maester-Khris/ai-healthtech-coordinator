import type { TriageUIState } from '@shared/types'
import { useNextActions } from '../../hooks/useNextActions'

const SEVERITY_COLORS: Record<string, { bg: string }> = {
  emergent: { bg: 'var(--color-severity-emergent)' },
  urgent:   { bg: 'var(--color-severity-urgent)' },
  moderate: { bg: 'var(--color-severity-moderate)' },
  routine:  { bg: 'var(--color-severity-routine)' },
}

interface FacilityCardProps {
  triage: TriageUIState
}

export function FacilityCard({ triage }: FacilityCardProps) {
  const { getDirections, saveRecommendation } = useNextActions(triage.severity)

  if (!triage.active || !triage.severity || !triage.recommendedFacility) return null

  const sev = SEVERITY_COLORS[triage.severity] ?? { bg: '#888' }
  const facility = triage.recommendedFacility
  const route = triage.routes.find(r => r.facilityId === triage.recommendedFacilityId)

  return (
    <div className="flex flex-col">
      {/* Severity banner */}
      <div className="px-2 py-1" style={{ background: sev.bg }}>
        <span className="text-white text-[9px] font-bold tracking-widest uppercase">
          ⚠ {triage.severity.toUpperCase()} — RECOMMENDED
        </span>
      </div>

      {/* Facility info */}
      <div className="px-3 py-1.5">
        <p className="text-[11px] font-semibold text-stratum-text leading-snug">{facility.name}</p>
        <p className="text-[9px] text-stratum-text-muted mt-0.5">{facility.address}</p>
        <div className="flex items-center flex-wrap gap-1.5 mt-1">
          {route && (
            <span className="text-[9px] text-stratum-text-muted">
              🚗 {route.etaMinutes} min · {route.distanceKm} km
            </span>
          )}
          <span className="text-[8px] font-semibold text-stratum-accent-2 border border-stratum-accent-2/40 rounded-full px-1.5 py-0.5">
            Best route
          </span>
        </div>
        {triage.reasoning && (
          <p className="text-[8px] text-stratum-text-muted italic mt-1 leading-tight">{triage.reasoning}</p>
        )}
      </div>

      {/* Action buttons */}
      <div className="flex gap-2 px-3 pb-2">
        <button
          onClick={() => getDirections(facility.name, facility.lat, facility.lng)}
          className="flex-1 rounded-stratum-md text-[11px] font-semibold text-white bg-stratum-accent"
          style={{ minHeight: 44, padding: '8px 0' }}
        >
          Directions
        </button>
        <button
          onClick={saveRecommendation}
          className="flex-1 rounded-stratum-md text-[11px] font-semibold border border-stratum-accent text-stratum-accent"
          style={{ minHeight: 44, padding: '8px 0' }}
        >
          Save
        </button>
      </div>
    </div>
  )
}
