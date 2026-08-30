import json
import os
import sys
from unittest.mock import MagicMock, patch

sys.path.insert(0, os.path.join(os.path.dirname(__file__), "..", "..", ".."))

from scripts.symptom_eval.checklist_extractor import OpenAIChecklistExtractor

FAKE_COMPLETION = {
    "opening_message": "I feel dizzy and almost fainted.",
    "disclosure_items": [
        {
            "feature_id": "syncope",
            "category": "history",
            "first_person_phrasing": "I passed out for a few seconds.",
            "reveal_only_if_asked": True,
        }
    ],
    "update_message": None,
}


class TestOpenAIChecklistExtractor:
    @patch("scripts.symptom_eval.checklist_extractor.OpenAI")
    def test_extract_parses_json_response(self, mock_openai_cls):
        mock_client = MagicMock()
        mock_openai_cls.return_value = mock_client
        mock_client.chat.completions.create.return_value.choices = [
            MagicMock(message=MagicMock(content=json.dumps(FAKE_COMPLETION)))
        ]

        extractor = OpenAIChecklistExtractor()
        result = extractor.extract("A 36 year old with syncope.", case_id="2")

        assert result == FAKE_COMPLETION
        call_kwargs = mock_client.chat.completions.create.call_args.kwargs
        assert "A 36 year old with syncope." in call_kwargs["messages"][0]["content"]
