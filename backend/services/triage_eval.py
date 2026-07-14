"""
Deterministic (no LLM judge) groundedness check for triage Pass-2 responses.

The facility name is injected into the model's context as a fact before Pass 2
generates its response (see LLMAgent._generate_grounded_response). If the model
followed that fact instead of inventing a different name, the real facility name
appears verbatim in the response. This check confirms that — no LLM call, no
cost, safe to run on every logged session.
"""


def check_facility_groundedness(response_text: str, facility: dict | None) -> dict:
    """
    Returns {"grounded": bool | None, "facility_name": str | None}.

    grounded is None when no facility was provided to the model at all (e.g. no
    location data) — there is nothing to check groundedness against in that case.
    """
    if facility is None:
        return {"grounded": None, "facility_name": None}

    name = facility["name"]
    return {
        "grounded": name.lower() in response_text.lower(),
        "facility_name": name,
    }
