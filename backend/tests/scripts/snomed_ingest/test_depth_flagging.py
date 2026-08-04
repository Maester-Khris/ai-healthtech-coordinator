# backend/tests/scripts/snomed_ingest/test_depth_flagging.py
import inspect
import os
import re
import sys

sys.path.insert(0, os.path.join(os.path.dirname(__file__), "../../.."))

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
# detect_cross_anchor_overlap -- pure IQR check over overlapping-pair sizes,
# synthetic dict, no Neo4j. A first live run of the raw "any shared concept"
# version of this signal flagged a majority of the 154 real anchors, almost
# entirely via single-concept overlaps (ordinary SNOMED polyhierarchy noise);
# it now applies the same IQR fence detect_fanout_outliers uses, but over the
# distribution of overlap-pair *sizes* rather than per-anchor counts.
# --------------------------------------------------------------------------


def test_detect_cross_anchor_overlap_does_not_flag_a_small_overlap_among_larger_ones():
    # Five pairs sharing exactly one concept each (ordinary polyhierarchy
    # noise -- ie. the old bare "any overlap" behavior would have flagged all
    # of these) plus one pair sharing 60 concepts (a genuine large-subtree
    # merge, reproducing the shape of the 68235000 duplicate-anchor bug). The
    # IQR fence over [1, 1, 1, 1, 1, 60] flags only the 60.
    sets = {
        "p1a": {"1a", "x1"}, "p1b": {"1b", "x1"},
        "p2a": {"2a", "x2"}, "p2b": {"2b", "x2"},
        "p3a": {"3a", "x3"}, "p3b": {"3b", "x3"},
        "p4a": {"4a", "x4"}, "p4b": {"4b", "x4"},
        "p5a": {"5a", "x5"}, "p5b": {"5b", "x5"},
        "big_a": {f"big{i}" for i in range(60)} | {"a_only"},
        "big_b": {f"big{i}" for i in range(60)} | {"b_only"},
    }
    overlap = detect_cross_anchor_overlap(sets)
    assert overlap == {"big_a": {"big_b"}, "big_b": {"big_a"}}
    # The five 1-concept-overlap pairs must not appear at all -- not flagged,
    # not flagged-with-a-smaller-reason, just absent.
    for anchor_id in ("p1a", "p1b", "p2a", "p2b", "p3a", "p3b", "p4a", "p4b", "p5a", "p5b"):
        assert anchor_id not in overlap


def test_detect_cross_anchor_overlap_omits_anchors_with_no_shared_concepts():
    sets = {"anchor_a": {"1", "2"}, "anchor_b": {"3", "4"}}
    assert detect_cross_anchor_overlap(sets) == {}


def test_detect_cross_anchor_overlap_returns_empty_dict_with_fewer_than_four_overlapping_pairs():
    # Only 2 overlapping pairs exist here -- too few for a meaningful IQR
    # split (mirrors detect_fanout_outliers' same-shaped guard), so nothing
    # is flagged even though real overlap exists.
    sets = {
        "anchor_a": {"shared1", "1"}, "anchor_b": {"shared1", "2"},
        "anchor_c": {"shared2", "3"}, "anchor_d": {"shared2", "4"},
    }
    assert detect_cross_anchor_overlap(sets) == {}


def test_detect_cross_anchor_overlap_handles_overlap_across_three_or_more_anchors():
    # a, b, c mutually share a large block of concepts (three-way overlap --
    # three equal-sized overlapping pairs). A dozen ordinary 1-concept noise
    # pairs give the IQR fence enough data points to register the three-way
    # block as the outlier and confirm it's still detected as fully symmetric
    # across all three anchors, not just pairwise.
    shared_block = {f"shared{i}" for i in range(50)}
    sets = {
        "a": shared_block | {"a_only"},
        "b": shared_block | {"b_only"},
        "c": shared_block | {"c_only"},
    }
    for i in range(12):
        sets[f"n{i}a"] = {f"n{i}", f"u{i}a"}
        sets[f"n{i}b"] = {f"n{i}", f"u{i}b"}

    overlap = detect_cross_anchor_overlap(sets)
    assert overlap == {
        "a": {"b", "c"},
        "b": {"a", "c"},
        "c": {"a", "b"},
    }
    for i in range(12):
        assert f"n{i}a" not in overlap
        assert f"n{i}b" not in overlap


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
        "a6": {"6"}, "a7": {"7"}, "a8": {"8"},
        "a9": {"9"} | {f"shared{i}" for i in range(60)},
        "outlier": {"10000"},
        "overlap_partner": {f"shared{i}" for i in range(60)} | {"op_only"},
        # Noise pairs sharing exactly 1 concept each -- give the IQR fence
        # enough data points, and confirm they stay below it (unlike a bare
        # "any overlap" check, which would have flagged all of these too).
        "n0a": {"n0", "u0a"}, "n0b": {"n0", "u0b"},
        "n1a": {"n1", "u1a"}, "n1b": {"n1", "u1b"},
        "n2a": {"n2", "u2a"}, "n2b": {"n2", "u2b"},
        "n3a": {"n3", "u3a"}, "n3b": {"n3", "u3b"},
        "n4a": {"n4", "u4a"}, "n4b": {"n4", "u4b"},
    }
    flagged = flag_anchors(depth4_counts, descendant_sets)

    assert flagged["outlier"] == ["fanout_outlier"]
    # Reason string now carries the actual shared-concept count.
    assert flagged["a9"] == ["cross_anchor_overlap:overlap_partner:60"]
    assert flagged["overlap_partner"] == ["cross_anchor_overlap:a9:60"]
    # Anchors flagged by neither signal must not appear at all -- including
    # the small 1-concept noise-overlap pairs, which are below the fence.
    unflagged = ["a1", "a2", "a3", "a4", "a5", "a6", "a7", "a8"]
    for i in range(5):
        unflagged += [f"n{i}a", f"n{i}b"]
    for anchor_id in unflagged:
        assert anchor_id not in flagged


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
