from .base import ToolDefinition

TRIAGE_RESPONSE = ToolDefinition(
    name="triage_response",
    description=(
        "Call this when you have sufficient information to classify the patient's "
        "symptom severity. Do NOT include a patient-facing response in this call — "
        "the conversational response is generated separately after the nearest "
        "facility is identified from the system's data. "
        "Never invent or guess facility names."
    ),
    parameters={
        "severity": {
            "type": "string",
            "enum": ["routine", "moderate", "urgent", "emergent"],
            "description": "Symptom severity classification",
        },
        "reasoning": {
            "type": "string",
            "description": (
                "Brief clinical reasoning for the classification — "
                "1-2 sentences, internal use only, not shown to the patient"
            ),
        },
        "needs_location": {
            "type": "boolean",
            "description": (
                "True if patient location is needed to find a nearby facility. "
                "Set to false only if location is clearly irrelevant."
            ),
        },
    },
    required=["severity", "reasoning", "needs_location"],
)

ALL_TOOLS = [TRIAGE_RESPONSE]
