import os
import sys

sys.path.insert(0, os.path.join(os.path.dirname(__file__), "..", "..", ".."))

from scripts.symptom_eval.domain import (
    ConversationTurn, DisclosureItem, SEVERITY_RANK, Vignette, VignetteTranscript,
)


class TestDisclosureItem:
    def test_defaults_to_not_disclosed(self):
        item = DisclosureItem(
            feature_id="gcs_6", category="exam",
            first_person_phrasing="My eyes won't open and I can't talk.",
            reveal_only_if_asked=True,
        )
        assert item.disclosed is False


class TestSeverityRank:
    def test_monotonic_order(self):
        assert (
            SEVERITY_RANK["routine"]
            < SEVERITY_RANK["moderate"]
            < SEVERITY_RANK["urgent"]
            < SEVERITY_RANK["emergent"]
        )


class TestVignetteTranscript:
    def test_text_up_to_includes_only_requested_turns(self):
        turns = [
            ConversationTurn(0, "chest pain", "How long has this been going on?", False, [], []),
            ConversationTurn(1, "an hour", "Are you short of breath?", False, [], []),
        ]
        transcript = VignetteTranscript("1", turns, None, None)

        opening_only = transcript.text_up_to(0)
        assert "chest pain" in opening_only
        assert "an hour" not in opening_only

        full = transcript.text_up_to()
        assert "an hour" in full

    def test_vignette_holds_disclosure_items(self):
        vignette = Vignette(
            case_id="1",
            opening_message="I feel dizzy.",
            disclosure_items=[
                DisclosureItem("gcs_3", "exam", "I can't respond.", True),
            ],
            gold_severity="emergent",
            gold_ctas_level=1,
        )
        assert vignette.disclosure_items[0].feature_id == "gcs_3"
        assert vignette.update_message is None
