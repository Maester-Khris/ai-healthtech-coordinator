export interface ProximityOption {
  value:   string
  label:   string
  radiusM: number
}

export const PROXIMITY_OPTIONS: ProximityOption[] = [
  { value: '10 km',  label: '10 km',  radiusM: 10000 },
  { value: '25 km',  label: '25 km',  radiusM: 25000 },
  { value: '50+ km', label: '50+ km', radiusM: 50000 },
]
