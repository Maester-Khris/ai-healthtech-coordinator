import type { TriageUIState, FacilityCandidate } from '../../../../../shared/types'

export const cnTowerPos: [number, number] = [43.6426, -79.3871]

export const INACTIVE_TRIAGE: TriageUIState = {
  active:                false,
  severity:              null,
  reasoning:             null,
  recommendedFacility:   null,
  nearbyFacilities:      [],
  userCoords:            null,
  routes:                [],
  recommendedFacilityId: null,
  roadGeometry:          null,
}

export function buildTriageCandidates(triage: TriageUIState): FacilityCandidate[] {
  if (!triage.active) return []
  if (triage.recommendedFacility) {
    return [triage.recommendedFacility, ...triage.nearbyFacilities]
  }
  return triage.nearbyFacilities
}
