from enum import Enum
from uuid import UUID
from datetime import datetime
from pydantic import BaseModel


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
