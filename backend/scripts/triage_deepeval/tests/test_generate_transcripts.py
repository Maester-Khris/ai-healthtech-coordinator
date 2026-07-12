import os
import sys

sys.path.insert(0, os.path.join(os.path.dirname(__file__), "..", "..", ".."))

from scripts.triage_deepeval.generate_transcripts import build_transcript_row

SCENARIO = {"message": "chest pain", "lat": 43.6426, "lng": -79.3871}

CHAT_RESPONSE_WITH_TRIAGE = {
    "user_message": {"id": "m1", "role": "user", "content": "chest pain"},
    "assistant_message": {"id": "m2", "role": "assistant", "content": "Please go to Toronto General Hospital immediately."},
    "triage": {
        "severity": "emergent",
        "reasoning": "chest pain radiating to arm",
        "recommended_facility": {
            "id": "fac-001",
            "name": "Toronto General Hospital",
            "category": "hospital",
            "address": "200 Elizabeth St, Toronto",
            "lat": 43.6577,
            "lng": -79.3877,
            "distanceKm": 1.4,
        },
        "nearby_facilities": [],
    },
}

CHAT_RESPONSE_FOLLOWUP = {
    "user_message": {"id": "m3", "role": "user", "content": "not feeling well"},
    "assistant_message": {"id": "m4", "role": "assistant", "content": "Can you tell me more about your symptoms?"},
    "triage": None,
}


class TestBuildTranscriptRow:
    def test_extracts_response_and_facility_when_triage_present(self):
        row = build_transcript_row(SCENARIO, CHAT_RESPONSE_WITH_TRIAGE)
        assert row == {
            "message": "chest pain",
            "response_text": "Please go to Toronto General Hospital immediately.",
            "severity": "emergent",
            "recommended_facility": CHAT_RESPONSE_WITH_TRIAGE["triage"]["recommended_facility"],
        }

    def test_facility_and_severity_none_on_followup_turn(self):
        row = build_transcript_row(SCENARIO, CHAT_RESPONSE_FOLLOWUP)
        assert row["severity"] is None
        assert row["recommended_facility"] is None
        assert row["response_text"] == "Can you tell me more about your symptoms?"
