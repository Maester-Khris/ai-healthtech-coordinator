# backend/tests/graph/test_entity_linking_precision.py
import inspect
import os
import re
import sys

sys.path.insert(0, os.path.join(os.path.dirname(__file__), "../.."))

from scripts.snomed_ingest import depth_flagging
from scripts.snomed_ingest.depth_flagging import (
    build_descendant_count_query,
    build_descendant_ids_query,
    detect_cross_anchor_overlap,
    detect_fanout_outliers,
    flag_anchors,
)


# --------------------------------------------------------------------------
# build_descendant_count_query / build_descendant_ids_query
# --------------------------------------------------------------------------


def test_build_descendant_count_query_binds_anchor_id_as_param_not_literal():
    query, params = build_descendant_count_query("21522001", 4)
    assert params == {"anchor_id": "21522001"}
    assert "21522001" not in query
    assert "$anchor_id" in query


def test_build_descendant_count_query_interpolates_depth_and_uses_is_a_direction():
    query, _ = build_descendant_count_query("21522001", 3)
    # Descendants reach the anchor via -[:IS_A*1..N]-> per the schema direction
    # (descendant:SnomedConcept)-[:IS_A]->(ancestor:SnomedConcept).
    assert "[:IS_A*1..3]->" in query
    assert "count(DISTINCT d)" in query


def test_build_descendant_count_query_rejects_non_positive_depth():
    for bad_depth in (0, -1):
        try:
            build_descendant_count_query("21522001", bad_depth)
            assert False, f"expected ValueError for depth={bad_depth}"
        except ValueError:
            pass


def test_build_descendant_ids_query_returns_distinct_ids_at_given_depth():
    query, params = build_descendant_ids_query("21522001", 4)
    assert params == {"anchor_id": "21522001"}
    assert "[:IS_A*1..4]->" in query
    assert "DISTINCT d.id" in query


def test_build_descendant_ids_query_rejects_non_positive_depth():
    try:
        build_descendant_ids_query("21522001", 0)
        assert False, "expected ValueError for depth=0"
    except ValueError:
        pass


# --------------------------------------------------------------------------
# detect_fanout_outliers -- pure IQR check, synthetic dict, no Neo4j
# --------------------------------------------------------------------------


def test_detect_fanout_outliers_flags_count_above_q3_plus_1_5_iqr():
    # A tight cluster of ordinary anchors plus one clear fan-out outlier.
    counts = {
        "a1": 10, "a2": 12, "a3": 11, "a4": 9, "a5": 13,
        "a6": 10, "a7": 14, "a8": 8, "a9": 12, "a10": 3000,
    }
    flagged = detect_fanout_outliers(counts)
    assert flagged == ["a10"]


def test_detect_fanout_outliers_flags_nothing_when_distribution_is_uniform():
    counts = {f"a{i}": 10 for i in range(10)}
    assert detect_fanout_outliers(counts) == []


def test_detect_fanout_outliers_returns_empty_list_with_fewer_than_four_anchors():
    counts = {"a1": 5, "a2": 5000}
    assert detect_fanout_outliers(counts) == []


def test_detect_fanout_outliers_result_is_sorted_and_deterministic():
    counts = {"z9": 3000, "a1": 10, "m5": 11, "b2": 9, "c3": 12, "d4": 3500}
    first_run = detect_fanout_outliers(counts)
    second_run = detect_fanout_outliers(counts)
    assert first_run == second_run
    assert first_run == sorted(first_run)


# --------------------------------------------------------------------------
# detect_cross_anchor_overlap -- pure set-intersection check, synthetic dict
# --------------------------------------------------------------------------


def test_detect_cross_anchor_overlap_finds_shared_concept_between_two_anchors():
    # Reproduces the shape of the 68235000 duplicate-anchor bug: two anchors'
    # descendant sets share a concept.
    sets = {
        "anchor_a": {"100", "101", "68235000"},
        "anchor_b": {"200", "68235000"},
        "anchor_c": {"300", "301"},
    }
    overlap = detect_cross_anchor_overlap(sets)
    assert overlap == {"anchor_a": {"anchor_b"}, "anchor_b": {"anchor_a"}}


def test_detect_cross_anchor_overlap_omits_anchors_with_no_shared_concepts():
    sets = {"anchor_a": {"1", "2"}, "anchor_b": {"3", "4"}}
    assert detect_cross_anchor_overlap(sets) == {}


def test_detect_cross_anchor_overlap_handles_overlap_across_three_or_more_anchors():
    sets = {
        "anchor_a": {"shared", "1"},
        "anchor_b": {"shared", "2"},
        "anchor_c": {"shared", "3"},
    }
    overlap = detect_cross_anchor_overlap(sets)
    assert overlap == {
        "anchor_a": {"anchor_b", "anchor_c"},
        "anchor_b": {"anchor_a", "anchor_c"},
        "anchor_c": {"anchor_a", "anchor_b"},
    }


# --------------------------------------------------------------------------
# flag_anchors -- combines both signals
# --------------------------------------------------------------------------


def test_flag_anchors_unions_both_signals_with_reasons():
    depth4_counts = {
        "a1": 10, "a2": 12, "a3": 11, "a4": 9, "a5": 13,
        "a6": 10, "a7": 14, "a8": 8, "a9": 12, "outlier": 3000,
    }
    descendant_sets = {
        "a1": {"1"}, "a2": {"2"}, "a3": {"3"}, "a4": {"4"}, "a5": {"5"},
        "a6": {"6"}, "a7": {"7"}, "a8": {"8"}, "a9": {"9", "shared"},
        "outlier": {"10000"},
        "overlap_partner": {"shared"},
    }
    flagged = flag_anchors(depth4_counts, descendant_sets)

    assert flagged["outlier"] == ["fanout_outlier"]
    assert flagged["a9"] == ["cross_anchor_overlap:overlap_partner"]
    assert flagged["overlap_partner"] == ["cross_anchor_overlap:a9"]
    # Anchors flagged by neither signal must not appear at all.
    for unflagged in ("a1", "a2", "a3", "a4", "a5", "a6", "a7", "a8"):
        assert unflagged not in flagged


def test_flag_anchors_returns_empty_dict_when_nothing_flagged():
    depth4_counts = {f"a{i}": 10 for i in range(10)}
    descendant_sets = {f"a{i}": {str(i)} for i in range(10)}
    assert flag_anchors(depth4_counts, descendant_sets) == {}


# --------------------------------------------------------------------------
# Structural isolation check: depth_flagging.py must never write anything.
# Same pattern as test_seed_red_flags.py::test_seed_red_flags_never_writes_layer_1_labels.
# --------------------------------------------------------------------------


def test_depth_flagging_never_writes():
    source = inspect.getsource(depth_flagging)

    # Patterns require an actual Cypher node-pattern shape (paren, optional var,
    # colon, label) or property-assignment shape, not just the bare keyword --
    # this module's own docstring prose says "MERGE/SET/CREATE" in plain
    # English, which would false-positive on a naive bare-keyword search.
    forbidden_patterns = [
        r"\bMERGE\s*\(\s*\w*\s*:\w",
        r"\bCREATE\s*\(\s*\w*\s*:\w",
        r"\bSET\s+\w+\.\w+\s*=",
        r"\bDELETE\s+\w",
        r"\bDETACH\s+DELETE\b",
        r"\bREMOVE\s+\w+\.\w+",
    ]
    for pattern in forbidden_patterns:
        assert not re.search(pattern, source), (
            f"depth_flagging.py must be read-only -- every Cypher statement here "
            f"must be MATCH-only, never a write (matched pattern: {pattern!r})"
        )

    # Positive control: the module must still genuinely reference SnomedConcept
    # via a real MATCH, otherwise the assertions above would pass vacuously by
    # the label simply never being mentioned.
    assert "SnomedConcept" in source
    assert re.search(r"MATCH\s*\([^)]*:SnomedConcept", source), (
        "positive control failed -- depth_flagging.py should MATCH :SnomedConcept "
        "to walk IS_A from each anchor"
    )
