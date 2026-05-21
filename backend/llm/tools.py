from .base import ToolDefinition

TRIAGE_RESPONSE = ToolDefinition(
    name="triage_response",
    description=(
        "Call this when you have sufficient information to classify the patient's "
        "symptom severity. Do NOT include a patient-facing response — "
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
    },
    required=["severity", "reasoning"],
)

ALL_TOOLS = [TRIAGE_RESPONSE]
