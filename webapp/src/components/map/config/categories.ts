export const CATEGORY_STYLES: Record<string, { color: string; letter: string; label: string }> = {
  hospital:    { color: "#E05555", letter: "H", label: "Hospital" },
  ambulatory:  { color: "#3BC9D4", letter: "A", label: "Walk-in / Clinic" },
  residential: { color: "#74C69D", letter: "R", label: "Residential Care" },
}

export const DEFAULT_STYLE = { color: "#94A3B8", letter: "?", label: "Other" }

export const LEGEND_ITEMS = [
  { color: "#E05555", letter: "H", label: "Hospital" },
  { color: "#3BC9D4", letter: "A", label: "Walk-in / Clinic" },
  { color: "#74C69D", letter: "R", label: "Residential Care" },
  { color: "#48F6C1", label: "Your location", isPin: true },
] as const

export type CategoryFilter = "all" | "hospital" | "ambulatory" | "residential"

export const FILTER_OPTIONS: Array<{ value: CategoryFilter; label: string; color: string }> = [
  { value: "all",         label: "All types",        color: "#7AA0B0" },
  { value: "hospital",    label: "Hospital",          color: "#E05555" },
  { value: "ambulatory",  label: "Walk-in / Clinic",  color: "#3BC9D4" },
  { value: "residential", label: "Residential Care",  color: "#74C69D" },
]
