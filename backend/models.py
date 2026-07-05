from enum import Enum
from uuid import UUID
from datetime import datetime
from pydantic import BaseModel, Field


class Severity(str, Enum):
    routine  = "routine"
    moderate = "moderate"
    urgent   = "urgent"
    emergent = "emergent"


class FacilityCategory(str, Enum):
    hospital    = "hospital"
    ambulatory  = "ambulatory"
    residential = "residential"


class Facility(BaseModel):
    name:                 str
    category:             FacilityCategory
    source_facility_type: str
    accepted_severity:    list[Severity]
    address:              str
    lat:                  float
    lng:                  float
    id:                   UUID | None = None
    source:               str | None = None
    created_at:           datetime | None = None
    updated_at:           datetime | None = None
    phone:                str | None = None
    business_status:      str | None = None
    weekday_hours:        list[str] | None = None
    wait_minutes:         int | None = None


class SessionBase(BaseModel):
    id:         UUID
    user_id:    UUID
    title:      str
    created_at: datetime
    updated_at: datetime


class MessageBase(BaseModel):
    id:         UUID
    session_id: UUID
    user_id:    UUID
    role:       str
    content:    str
    created_at: datetime


class SendMessageRequest(BaseModel):
    session_id: UUID
    content:    str = Field(..., min_length=1, max_length=4000)
    lat:        float | None = None
    lng:        float | None = None


class FacilityCandidate(BaseModel):
    id:          str
    name:        str
    category:    FacilityCategory
    address:     str
    lat:         float
    lng:         float
    distanceKm:  float


class TriageResult(BaseModel):
    severity:             Severity
    reasoning:            str
    recommended_facility: FacilityCandidate | None = None
    nearby_facilities:    list[FacilityCandidate] = []


class CreateSessionRequest(BaseModel):
    first_message: str = Field(..., min_length=1, max_length=4000)


class SessionWithMessages(BaseModel):
    session:  SessionBase
    messages: list[MessageBase]


class PastConversationsResponse(BaseModel):
    sessions: list[SessionWithMessages]
    etag:     str


class NearbyFacilityResult(BaseModel):
    facility_id:     str
    facility_name:   str
    category:        str
    address:         str
    phone:           str | None
    is_operational:  bool
    distance_m:      int
    eta_walk_min:    int
    eta_transit_min: int
    eta_drive_min:   int
    wait_minutes:    int | None = None

