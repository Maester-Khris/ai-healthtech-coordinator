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

Return strict JSON:
{{
  "opening_message": "<first-person chief-complaint sentence a real patient/caller would say, containing ONLY the presenting complaint, no other detail>",
  "disclosure_items": [
    {{"feature_id": "<short_slug>", "category": "<chief_complaint|history|vitals|exam>", "first_person_phrasing": "<what the patient says when this is asked about>", "reveal_only_if_asked": true}}
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
