"""
One-time preprocessing: turns a raw third-person CTAS vignette
(backend/triage/resources/eval_vignettes_ontario_ctas.json) into a
first-person disclosure checklist, following the USMLE/NBME
standardized-patient authoring template (research artifact §1.4, source 9)
— a rubric of concepts disclosed only when asked, never the diagnosis or
CTAS level itself.

extract()'s signature deliberately accepts only scenario_text: str — the
gold CTAS level/rationale is structurally unreachable from this function,
not merely withheld by convention, so the checklist can never leak the
answer into the patient-simulator's own knowledge.

Invocation (Task 12 — run once, review the output, then commit checklists/):
    doppler run --config eval -- python -m scripts.symptom_eval.cli extract-checklists
"""
import json
from abc import ABC, abstractmethod

from openai import OpenAI

CHECKLIST_MODEL = "gpt-4o-mini"

EXTRACTION_PROMPT = """You are authoring a standardized-patient script for a clinical training simulator, following the USMLE Step 2 CS checklist convention: extract discrete clinical findings from the case below into a checklist a scripted patient actor will disclose ONE AT A TIME, ONLY when a question actually asks about it — never volunteered.

Case (third-person clinical narrative):
{scenario}

Speaker selection (check this first, before writing anything): if the case
states the patient is unresponsive, unconscious, has an altered or reduced
level of consciousness (e.g. a low GCS), is pre-verbal (e.g. an infant or
toddler), or is otherwise clinically unable to answer questions themselves,
then BOTH opening_message and every disclosure_item's first_person_phrasing
must be spoken by a bystander, caregiver, or first responder describing the
patient from the outside (e.g. "She's not responding to me," "His pulse
feels really fast") — never the patient's own first-person self-report of
their own consciousness, sensations, or exam findings. A patient who cannot
speak or respond cannot narrate their own unresponsiveness. Only use the
patient's own first-person voice when the case indicates they are awake,
oriented, and able to converse.

Return strict JSON:
{{
  "opening_message": "<first-person chief-complaint sentence, in whichever voice the Speaker selection rule above requires, containing ONLY the presenting complaint, no other detail>",
  "disclosure_items": [
    {{"feature_id": "<short_slug>", "category": "<chief_complaint|history|vitals|exam>", "first_person_phrasing": "<what the speaker (patient or bystander, per the rule above) says when this is asked about>", "reveal_only_if_asked": true}}
  ],
  "update_message": null
}}

Do not include a CTAS level, triage category, or diagnosis anywhere in your output."""


class ChecklistExtractorPort(ABC):
    @abstractmethod
    def extract(self, scenario_text: str, case_id: str) -> dict:
        ...


class OpenAIChecklistExtractor(ChecklistExtractorPort):
    def __init__(self, model: str = CHECKLIST_MODEL):
        self._client = OpenAI()
        self._model = model

    def extract(self, scenario_text: str, case_id: str) -> dict:
        resp = self._client.chat.completions.create(
            model=self._model,
            response_format={"type": "json_object"},
            messages=[
                {"role": "user", "content": EXTRACTION_PROMPT.format(scenario=scenario_text)}
            ],
        )
        return json.loads(resp.choices[0].message.content)
