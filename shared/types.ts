export type Severity         = "routine" | "moderate" | "urgent" | "emergent";
export type FacilityCategory = "hospital" | "ambulatory" | "residential";

export interface Facility {
  name:                 string;
  category:             FacilityCategory;
  source_facility_type: string;
  accepted_severity:    Severity[];
  address:              string;
  lat:                  number;
  lng:                  number;
  id?:                  string;
  source?:              string;
  created_at?:          string;
  updated_at?:          string;
}

export interface TriageRequest {
  message: string;
  lat:     number;
  lng:     number;
}

export interface ToolTrace {
  tool:        string;
  status:      "pending" | "done" | "error";
  durationMs?: number;
}

export interface TriageResult {
  severity:      Severity;
  reasoning:     string;
  facility:      Facility;
  travelMinutes: number;
  distanceKm:    number;
  toolTrace:     ToolTrace[];
}
