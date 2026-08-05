import os
import sys
from unittest.mock import MagicMock

sys.path.insert(0, os.path.join(os.path.dirname(__file__), "..", "..", ".."))

from scripts.graphrag_eval.generate_track_b_transcripts import (
    build_transcript_row,
    generate_transcripts,
)
from scripts.symptom_eval.system_under_test import SystemTurnResult


class TestBuildTranscriptRow:
    def test_maps_adapter_result_into_track_b_row_shape(self):
        scenario = {"message": "chest pain", "expected_complaint": "Chest pain (cardiac features)"}
        adapter = MagicMock()
        adapter.respond.return_value = SystemTurnResult(
            response_text="Please go to the ER.", severity="emergent", reasoning="why",
            graph_context_matched=True,
            surfaced_red_flag_indicators=["Shock"],
            surfaced_followup_questions=["Are you feeling faint?"],
        )

        row = build_transcript_row(scenario, adapter)

        assert row == {
            "message": "chest pain",
            "response_text": "Please go to the ER.",
            "severity": "emergent",
            "expected_complaint": "Chest pain (cardiac features)",
            "surfaced_red_flags": ["Shock"],
            "surfaced_followup_questions": ["Are you feeling faint?"],
        }
        adapter.respond.assert_called_once_with("chest pain", [])


class TestGenerateTranscripts:
    def test_calls_build_row_once_per_scenario(self, monkeypatch):
        scenarios = [
            {"message": "a", "expected_complaint": "X"},
            {"message": "b", "expected_complaint": None},
        ]
        fake_adapter = MagicMock()
        fake_adapter.respond.return_value = SystemTurnResult(
            response_text="r", severity=None, reasoning=None, graph_context_matched=False,
        )
        monkeypatch.setattr(
            "scripts.graphrag_eval.generate_track_b_transcripts.LiveLLMAgentAdapter",
            lambda graph_rag_provider: fake_adapter,
        )

        transcripts = generate_transcripts(scenarios)

        assert len(transcripts) == 2
        assert fake_adapter.respond.call_count == 2
