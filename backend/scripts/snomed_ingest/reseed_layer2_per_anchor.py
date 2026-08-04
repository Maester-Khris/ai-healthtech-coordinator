# backend/scripts/snomed_ingest/reseed_layer2_per_anchor.py
"""
One-time migration: wipes the live Layer 2 overlay (RedFlag, FollowupQuestion,
RedFlagCluster nodes and their HAS_RED_FLAG/ASKS/PART_OF edges) and reseeds it
under the per-anchor RedFlag identity fix (I-1/I-2, docs/superpowers/plans/
2026-08-03-branch-review-followup-fixes.md, Task 4 Step 12).

Why this exists: the live graph was seeded before that fix, so it still has
RedFlag nodes keyed by indicator text ALONE, shared across every anchor using
that text -- the exact bug the code fix resolves for future writes, but
existing live data isn't retroactively correct until this runs.

NEVER touches Layer 1 (:SnomedConcept, :Description, :IS_A) -- every write in
this script targets only :RedFlag/:FollowupQuestion/:RedFlagCluster and their
own relationship types, same structural isolation seed_red_flags.py already
enforces (see its own module docstring and
test_seed_red_flags_never_writes_layer_1_labels).

Reads NEO4J_URI / NEO4J_USERNAME / NEO4J_PASSWORD from the environment
(inject via Doppler -- never pass credentials as CLI args, unlike
seed_red_flags.py's existing --neo4j-password, which is a known, separate,
not-fixed-here exposure).

Safety: destructive (DETACH DELETE) by design, so it never deletes anything
without --confirm. Run --dry-run first.

Invocation:
    cd backend
    doppler run -- python -m scripts.snomed_ingest.reseed_layer2_per_anchor --dry-run
    doppler run -- python -m scripts.snomed_ingest.reseed_layer2_per_anchor --confirm
"""
import argparse
import os
from pathlib import Path

from neo4j import GraphDatabase, Session

from scripts.snomed_ingest.seed_red_flags import (
    DEFAULT_COMPLAINTS_PATH,
    _count_layer_2,
    seed,
)

REQUIRED_ENV_VARS = ("NEO4J_URI", "NEO4J_USERNAME", "NEO4J_PASSWORD")


def _read_credentials() -> tuple[str, tuple[str, str]]:
    missing = [v for v in REQUIRED_ENV_VARS if not os.environ.get(v)]
    if missing:
        raise SystemExit(
            f"Missing required env vars: {', '.join(missing)}. "
            "Run this script via `doppler run --`, not with raw env vars."
        )
    return (
        os.environ["NEO4J_URI"],
        (os.environ["NEO4J_USERNAME"], os.environ["NEO4J_PASSWORD"]),
    )


def _max_anchors_per_red_flag(session: Session) -> tuple[int, str | None]:
    """Diagnostic: the worst-case fan-out of one RedFlag NODE across distinct
    anchors — grouped by the node itself (`rf`), not by rf.indicator text.
    Grouping by text alone is a different, unrelated fact (how many anchors
    legitimately share an indicator's wording, which stays high — e.g. 58 —
    both before AND after the fix, since it's just how many complaints use
    that clinical concept) and produces a false failure here even when the
    per-anchor identity fix worked correctly. Pre-migration this is >1 for
    shared nodes; post-migration it must be exactly 1 for every node, since
    the (anchor_id, indicator) MERGE key means a node can only ever be
    reached from the one anchor whose id it was created with."""
    result = session.run(
        "MATCH (anchor:SnomedConcept)-[:HAS_RED_FLAG]->(rf:RedFlag) "
        "WITH rf, count(DISTINCT anchor) AS anchor_count "
        "RETURN rf.indicator AS indicator, anchor_count ORDER BY anchor_count DESC LIMIT 1"
    ).single()
    if result is None:
        return 0, None
    return result["anchor_count"], result["indicator"]


def _find_legacy_indicator_constraint_name(session: Session) -> str | None:
    """Looks up the old single-property RedFlag.indicator uniqueness
    constraint by its actual properties, not a hardcoded/assumed name --
    Neo4j auto-generates constraint names, and the pre-fix
    'CREATE CONSTRAINT IF NOT EXISTS FOR (rf:RedFlag) REQUIRE rf.indicator
    IS UNIQUE' could have landed under any name."""
    for row in session.run("SHOW CONSTRAINTS YIELD name, labelsOrTypes, properties"):
        if row["labelsOrTypes"] == ["RedFlag"] and row["properties"] == ["indicator"]:
            return row["name"]
    return None


def print_step(step: int, total: int, description: str) -> None:
    pct = round(100 * step / total)
    print(f"[Step {step}/{total}] ({pct}%) {description}")


def run_dry_run(session: Session) -> None:
    print("=== DRY RUN — no writes will be made ===\n")
    counts = _count_layer_2(session)
    print(
        "Current Layer 2 counts -- "
        f"RedFlag: {counts['RedFlag']}, FollowupQuestion: {counts['FollowupQuestion']}, "
        f"HAS_RED_FLAG: {counts['HAS_RED_FLAG']}, ASKS: {counts['ASKS']}"
    )
    cluster_count = session.run("MATCH (c:RedFlagCluster) RETURN count(c) AS n").single()["n"]
    print(f"RedFlagCluster: {cluster_count}")

    max_fanout, worst_indicator = _max_anchors_per_red_flag(session)
    print(
        f"\nWorst-case RedFlag sharing: indicator {worst_indicator!r} is attached "
        f"to {max_fanout} distinct anchor(s) today (should be 1 after migration)."
    )

    constraint_name = _find_legacy_indicator_constraint_name(session)
    if constraint_name:
        print(f"\nLegacy constraint found and would be dropped: {constraint_name!r}")
    else:
        print("\nNo legacy RedFlag.indicator uniqueness constraint found (already clean).")

    print(
        "\nRe-run with --confirm to DETACH DELETE all RedFlag/FollowupQuestion/"
        "RedFlagCluster nodes and reseed under the per-anchor identity model."
    )


def run_migration(
    neo4j_uri: str,
    neo4j_auth: tuple[str, str],
    complaints_path: Path = DEFAULT_COMPLAINTS_PATH,
) -> None:
    total_steps = 6
    driver = GraphDatabase.driver(neo4j_uri, auth=neo4j_auth)
    try:
        with driver.session() as session:
            print_step(1, total_steps, "Reading pre-migration counts")
            before = _count_layer_2(session)
            before_max_fanout, before_indicator = _max_anchors_per_red_flag(session)
            print(
                f"  Before: RedFlag={before['RedFlag']}, FollowupQuestion={before['FollowupQuestion']}, "
                f"HAS_RED_FLAG={before['HAS_RED_FLAG']}, ASKS={before['ASKS']}, "
                f"worst-case fan-out={before_max_fanout} ({before_indicator!r})"
            )

            print_step(2, total_steps, "Dropping legacy RedFlag.indicator uniqueness constraint (if present)")
            constraint_name = _find_legacy_indicator_constraint_name(session)
            if constraint_name:
                session.run(f"DROP CONSTRAINT `{constraint_name}` IF EXISTS")
                print(f"  Dropped constraint {constraint_name!r}")
            else:
                print("  No legacy constraint found — nothing to drop")

            print_step(3, total_steps, "Deleting old Layer 2 data (RedFlagCluster, RedFlag, FollowupQuestion)")
            for label in ("RedFlagCluster", "RedFlag", "FollowupQuestion"):
                deleted = session.run(
                    f"MATCH (n:{label}) WITH n LIMIT 100000 DETACH DELETE n RETURN count(n) AS n"
                ).single()["n"]
                print(f"  Deleted {deleted} :{label} node(s)")
    finally:
        driver.close()

    # seed() opens/closes its own driver per call (self-contained, matches
    # its existing signature) -- reused as-is rather than duplicating its
    # batching/progress-printing logic here.
    print_step(4, total_steps, "Reseeding red flags under per-anchor RedFlag identity")
    seed(neo4j_uri, neo4j_auth, complaints_path, do_seed_pilot_clusters=False)

    print_step(5, total_steps, "Reseeding pilot RedFlagCluster")
    seed(neo4j_uri, neo4j_auth, complaints_path, do_seed_pilot_clusters=True)

    driver = GraphDatabase.driver(neo4j_uri, auth=neo4j_auth)
    try:
        with driver.session() as session:
            print_step(6, total_steps, "Verifying migration")
            after = _count_layer_2(session)
            after_max_fanout, after_indicator = _max_anchors_per_red_flag(session)
            print(
                f"  After: RedFlag={after['RedFlag']}, FollowupQuestion={after['FollowupQuestion']}, "
                f"HAS_RED_FLAG={after['HAS_RED_FLAG']}, ASKS={after['ASKS']}, "
                f"worst-case fan-out={after_max_fanout} ({after_indicator!r})"
            )
            if after_max_fanout > 1:
                raise SystemExit(
                    f"Migration verification FAILED: {after_indicator!r} is still "
                    f"attached to {after_max_fanout} distinct anchors — expected 1. "
                    "Do not treat this run as successful; investigate before relying "
                    "on the graph."
                )
            print("\n  Verification passed: every RedFlag node now belongs to exactly one anchor.")
    finally:
        driver.close()

    print("\nDone.")


def main() -> None:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument(
        "--dry-run", action="store_true",
        help="Show current state and what would change, without writing anything.",
    )
    parser.add_argument(
        "--confirm", action="store_true",
        help="Actually perform the destructive delete + reseed. Required to write.",
    )
    parser.add_argument("--complaints-path", type=Path, default=DEFAULT_COMPLAINTS_PATH)
    args = parser.parse_args()

    if args.dry_run == args.confirm:
        raise SystemExit(
            "Pass exactly one of --dry-run or --confirm. "
            "Run --dry-run first to see what this would do."
        )

    neo4j_uri, neo4j_auth = _read_credentials()

    if args.dry_run:
        driver = GraphDatabase.driver(neo4j_uri, auth=neo4j_auth)
        try:
            with driver.session() as session:
                run_dry_run(session)
        finally:
            driver.close()
        return

    run_migration(neo4j_uri, neo4j_auth, args.complaints_path)


if __name__ == "__main__":
    main()
