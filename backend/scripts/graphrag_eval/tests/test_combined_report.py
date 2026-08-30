import json
import os
import sys

sys.path.insert(0, os.path.join(os.path.dirname(__file__), "..", "..", ".."))

from scripts.graphrag_eval import combined_report


def test_build_report_combines_all_three_result_kinds(tmp_path, monkeypatch):
    monkeypatch.setattr(combined_report, "RESULTS_DIR", str(tmp_path))

    (tmp_path / "track_a_results_20260101T000000Z.json").write_text(json.dumps({
        "static": {"summary": {"count": 20, "hits": 20, "accuracy": 1.0}, "details": []},
        "neo4j": {"summary": {"count": 20, "hits": 7, "accuracy": 0.35, "recall_count": 20, "recall_rate": 0.6}, "details": []},
    }))
    (tmp_path / "track_a_lay_results_20260101T000000Z.json").write_text(json.dumps({
        "static": {"summary": {"count": 10, "hits": 8, "accuracy": 0.8}, "details": []},
        "neo4j": {"summary": {"count": 10, "hits": 6, "accuracy": 0.6, "recall_count": 10, "recall_rate": 0.7}, "details": []},
    }))
    (tmp_path / "track_b_results_20260101T000000Z.json").write_text(json.dumps({
        "summary": {"count": 18, "metrics": {"faithfulness": {"mean_score": 0.9, "pass_rate": 0.95}}},
        "results": [],
    }))

    report = combined_report.build_report()

    assert "Track A — original scenario set" in report
    assert "Track A — vocabulary-neutral" in report
    assert "Track B" in report
    assert "faithfulness" in report


def test_build_report_handles_missing_results_gracefully(tmp_path, monkeypatch):
    monkeypatch.setattr(combined_report, "RESULTS_DIR", str(tmp_path))

    report = combined_report.build_report()

    assert "no results found" in report
