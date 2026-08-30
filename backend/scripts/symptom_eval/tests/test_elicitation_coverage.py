import os
import sys

sys.path.insert(0, os.path.join(os.path.dirname(__file__), "..", "..", ".."))

from scripts.symptom_eval.domain import ConversationTurn, DisclosureItem, Vignette, VignetteTranscript
from scripts.symptom_eval.elicitation_coverage import score_vignette

VIGNETTE = Vignette(
    case_id="2", opening_message="I feel dizzy.",
    disclosure_items=[
        DisclosureItem("volunteered_fact", "chief_complaint", "I feel dizzy.", False),
        DisclosureItem("elicited_fact", "history", "It lasted a few seconds.", True),
        DisclosureItem("never_surfaced_fact", "exam", "My skin is pale.", True),
    ],
    gold_severity="emergent", gold_ctas_level=1,
)

TRANSCRIPT = VignetteTranscript(
    "2",
    [
        ConversationTurn(0, "I feel dizzy.", "How long did it last?", False, [], []),
        ConversationTurn(1, "It lasted a few seconds.", "Go to the ER.", False, [], []),
    ],
    "emergent", "reasoning",
)


class _ScriptedJudge:
    """Returns True for exactly the features present verbatim in the given text."""

    def was_surfaced(self, feature, transcript_text):
        return feature.first_person_phrasing in transcript_text


class TestScoreVignette:
    def test_classifies_volunteered_elicited_and_absent(self):
        result = score_vignette(VIGNETTE, TRANSCRIPT, _ScriptedJudge())

        assert result.total_features == 3
        assert result.surfaced_count == 2      # volunteered + elicited, not the absent one
        assert result.elicited_count == 1       # only the one absent from turn 0's text
        assert result.coverage == 1 / 3
        assert result.fraction == 1 / 2
