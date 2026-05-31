export const CATEGORY_STYLES: Record<string, { color: string; letter: string; label: string }> = {
  hospital:    { color: "#C0392B", letter: "H", label: "Hospital" },
  ambulatory:  { color: "#1A7A8A", letter: "A", label: "Walk-in / Clinic" },
  residential: { color: "#5A7A4A", letter: "R", label: "Residential Care" },
}

export const DEFAULT_STYLE = { color: "#888888", letter: "H", label: "Other" }

export const LEGEND_ITEMS = [
  { color: "#C0392B", letter: "H", label: "Hospital" },
  { color: "#1A7A8A", letter: "A", label: "Walk-in / Clinic" },
  { color: "#5A7A4A", letter: "R", label: "Residential Care" },
  { color: "#185FA5", label: "Current location", isPin: true },
] as const

export type CategoryFilter = "all" | "hospital" | "ambulatory" | "residential"

export const FILTER_OPTIONS: Array<{ value: CategoryFilter; label: string; color: string }> = [
  { value: "all",         label: "All types",        color: "#334455" },
  { value: "hospital",    label: "Hospital",          color: "#C0392B" },
  { value: "ambulatory",  label: "Walk-in / Clinic",  color: "#1A7A8A" },
  { value: "residential", label: "Residential Care",  color: "#5A7A4A" },
]
