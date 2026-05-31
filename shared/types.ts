// ── Chat ────────────────────────────────────────────────────────────────────

export interface Message {
  id:         string
  session_id: string
  user_id:    string
  role:       "user" | "assistant"
  content:    string
  created_at: string
}

export interface Session {
  id:         string
  user_id:    string
  title:      string
  created_at: string
  updated_at: string
}

export interface ConversationsCache {
  sessions: Session[]
  messages: Record<string, Message[]>
}

// ── Triage ───────────────────────────────────────────────────────────────────

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

export interface FacilityCandidate {
  id:          string
  name:        string
  category:    FacilityCategory
  address:     string
  lat:         number
  lng:         number
  distanceKm:  number
}

export interface TriageResult {
  severity:             Severity
  reasoning:            string
  recommended_facility: FacilityCandidate | null
  nearby_facilities:    FacilityCandidate[]
}

export interface ChatMessageResponse {
  user_message:      Message
  assistant_message: Message
  triage:            TriageResult | null
}

// ── Triage UI ─────────────────────────────────────────────────────────────────

export interface RouteResult {
  facilityId:  string
  etaMinutes:  number
  distanceKm:  number
}

export interface TriageUIState {
  active:                boolean
  severity:              Severity | null
  reasoning:             string | null
  recommendedFacility:   FacilityCandidate | null
  nearbyFacilities:      FacilityCandidate[]
  userCoords:            { lat: number; lng: number } | null
  routes:                RouteResult[]
  recommendedFacilityId: string | null
  roadGeometry:          [number, number][] | null
}
