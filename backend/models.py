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


class CreateSessionRequest(BaseModel):
    first_message: str = Field(..., min_length=1, max_length=4000)


class SessionWithMessages(BaseModel):
    session:  SessionBase
    messages: list[MessageBase]


class PastConversationsResponse(BaseModel):
    sessions: list[SessionWithMessages]
    etag:     str
