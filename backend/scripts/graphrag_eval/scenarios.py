"""
Shared scenario set + ground truth for the v1 (StaticLookupProvider) vs v2
(Neo4jSnomedProvider) retrieval comparison — Phase 6 Step 3's Track A
(retrieval hit-rate, run for real) and Track B (DeepEval faithfulness /
contextual precision / contextual recall, harness built but not run — see
run_track_b_deepeval.py's module docstring).

Both providers key GraphContext.complaint_name to the same identity space:
- StaticLookupProvider (backend/graph/static_provider.py) returns
  entry["name"] from backend/triage/resources/symptom_triage_data.json.
- Neo4jSnomedProvider (backend/graph/snomed_neo4j/provider.py) returns
  mapping.ctas_alias from backend/scripts/snomed_ingest/anchor_mapping.py's
  ANCHOR_MAPPINGS — and anchor_mapping.py's own module docstring states
  ctas_alias values are drawn directly from symptom_triage_data.json's
  `name` field.

So a scenario's expected ground truth is a single string that must appear
as both an entry's `name` in symptom_triage_data.json AND some
ANCHOR_MAPPINGS entry's ctas_alias. verified_intersection() below computes
that intersection programmatically (don't hand-pick and hope — see
tests/test_scenarios.py, which asserts every SCENARIOS entry's
expected_complaint is a member of it). At the time this module was written,
154 of 165 symptom_triage_data.json complaints are in the intersection
(matches anchor_mapping.py's own "154 of 165 complaints resolved" note —
the 11 excluded complaints have no SNOMED anchor and are v1-only).

Each scenario is a natural, full-sentence symptom message a patient might
actually say — not a bare alias string — containing the complaint's
alias/keyword so v1's substring matcher (StaticLookupProvider._match_entry)
can realistically find it, following triage_deepeval/symptom_scenarios.py's
convention (e.g. that file's "crushing chest pain radiating to my left arm"
example). All positive scenarios below were verified to hit against the
real StaticLookupProvider before being committed.

A couple of scenarios are deliberately novel/off-topic
(expected_complaint=None) to check that both providers correctly report
matched=False rather than only testing the happy path.
"""
import json
from functools import lru_cache
from pathlib import Path

from scripts.snomed_ingest.anchor_mapping import ANCHOR_MAPPINGS

_DATA_PATH = (
    Path(__file__).resolve().parent.parent.parent
    / "triage" / "resources" / "symptom_triage_data.json"
)

SCENARIOS: list[dict] = [
    {
        "message": "I am having cardiac chest pain and it feels like an elephant sitting on my chest.",
        "expected_complaint": "Chest pain (cardiac features)",
    },
    {
        "message": "I passed out for a few seconds while standing up at work today.",
        "expected_complaint": "Syncope / Pre-syncope",
    },
    {
        "message": "I have had severe throat pain for three days and can barely swallow.",
        "expected_complaint": "Sore throat",
    },
    {
        "message": "I have a nosebleed that will not stop after twenty minutes of pressure.",
        "expected_complaint": "Epistaxis",
    },
    {
        "message": "I was stuck outside in the cold and now I have a low body temperature and cannot stop shivering.",
        "expected_complaint": "Hypothermia",
    },
    {
        "message": "My son almost drowned in the pool and is coughing up water.",
        "expected_complaint": "Near Drowning",
    },
    {
        "message": "I have severe stomach pain that started suddenly this morning.",
        "expected_complaint": "Abdominal pain",
    },
    {
        "message": "I have had loose stools for two days and I am getting dehydrated.",
        "expected_complaint": "Diarrhea",
    },
    {
        "message": "I think I have a bowel blockage, I have not been able to go to the bathroom in five days.",
        "expected_complaint": "Constipation",
    },
    {
        "message": "I noticed blood in urine when I went to the bathroom this morning.",
        "expected_complaint": "Hematuria",
    },
    {
        "message": "I think I am having a panic attack, my heart is racing and I cannot breathe.",
        "expected_complaint": "Anxiety / Situational crisis",
    },
    {
        "message": "I have been having suicidal thoughts and do not know what to do.",
        "expected_complaint": "Depression / Suicidal / Deliberate self harm",
    },
    {
        "message": "I have been hearing voices that are not there for the past two days.",
        "expected_complaint": "Hallucinations / Delusions",
    },
    {
        "message": "I have been unable to pee for the past 12 hours and my bladder feels full and painful.",
        "expected_complaint": "Urinary retention",
    },
    {
        "message": "I have burning with urination and it hurts every time I go.",
        "expected_complaint": "UTI complaints",
    },
    {
        "message": "I have been throwing up all night and cannot keep any fluids down.",
        "expected_complaint": "Vomiting and/or nausea",
    },
    {
        "message": "My eyes and skin look yellow and I think I have jaundice.",
        "expected_complaint": "Jaundice",
    },
    {
        "message": "I have a neck injury from a car accident and it hurts to move my head.",
        "expected_complaint": "Neck trauma",
    },
    # Deliberately novel/off-topic — both providers should report matched=False.
    {
        "message": "What insurance plans does this clinic accept for outpatient visits?",
        "expected_complaint": None,
    },
    {
        "message": "Can you tell me the visiting hours for the maternity ward on weekends?",
        "expected_complaint": None,
    },
]


@lru_cache(maxsize=1)
def _entries_by_name() -> dict:
    raw = json.loads(_DATA_PATH.read_text())
    return {entry["name"]: entry for entry in raw}


def verified_intersection() -> set[str]:
    """Complaint names present as both an entry's `name` in
    symptom_triage_data.json AND some ANCHOR_MAPPINGS entry's ctas_alias.
    No Neo4j connection needed — anchor_mapping.py is pure data and
    symptom_triage_data.json is a static file read.
    """
    names = set(_entries_by_name().keys())
    aliases = {mapping.ctas_alias for mapping in ANCHOR_MAPPINGS}
    return names & aliases


def expected_red_flag_indicators(complaint_name: str) -> list[str]:
    """Ground-truth red-flag indicator strings for a complaint, looked up
    directly from symptom_triage_data.json — the same identity space as
    ANCHOR_MAPPINGS.ctas_alias (see module docstring). Used by Track B to
    build the ContextualPrecisionMetric/ContextualRecallMetric expected
    context, since FaithfulnessMetric alone doesn't measure retrieval
    completeness. Returns [] for an unknown complaint name.
    """
    entry = _entries_by_name().get(complaint_name)
    if entry is None:
        return []
    return [rf["indicator"] for rf in entry.get("red_flags", [])]
