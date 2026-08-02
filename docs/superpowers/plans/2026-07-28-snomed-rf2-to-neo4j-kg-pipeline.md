# SNOMED CT RF2 → Neo4j KG — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.
>
> **Format note:** this is a data/infrastructure pipeline, not a pure application-code feature — several steps are data-profiling or one-time provisioning work that doesn't reduce to a red/green unit test. Where a step *is* ordinary application code (the `Neo4jSnomedProvider` adapter, the switch in `factory.py`), it follows the skill's TDD step format. Where a step is a batch script or infra action (ingestion, precision sweep), it specifies the exact command and the exact verification query instead of a unit test — same rigor, different shape.

**Goal:** Take the two verified, extracted SNOMED CT RF2 releases at `/databank` (symlinked at `assets/snomedct`) from raw text files to a deployed, queryable Neo4j knowledge graph that `Neo4jSnomedProvider` can serve behind the existing `GraphContextProvider` interface, per `artifacts/2026-07-25-symptom-understanding-v2-graphrag-design.md`.

**Architecture:** Two structurally-separate layers in one graph — Layer 1 is SNOMED CT loaded as-is (Concept/Description/`IS_A` Relationship, MERGE-only, never touched by curation logic); Layer 2 is the hand-curated CTAS-sourced red-flag overlay, migrated from `static_provider.py`'s alias JSON via a documented anchor-selection process. `load_rf2.py` builds Layer 1 at build time only, never on the request path; `seed_red_flags.py` builds Layer 2. `Neo4jSnomedProvider` (Interface Adapter) is the only place `neo4j.Record` objects are ever touched.

**Tech Stack:** Neo4j AuraDB Free, `neo4j` Python driver, RF2 flat files (no new parsing library — stdlib `csv` with `delimiter="\t"` is sufficient for RF2's simple TSV shape), pytest for the precision/injection suites.

## Global Constraints (from the design doc — every task inherits these)

- Severity classification is the LLM's job, unconditionally — nothing in this pipeline ever produces or influences a severity value directly.
- `load_rf2.py`, `anchor_mapping.py`, `seed_red_flags.py` live under `backend/scripts/snomed_ingest/` and are **never imported by the request path** (`backend/services/llm_agent.py`, `backend/graph/*`).
- `LLMAgent` and `prompts.py` import only `graph.base.GraphContextProvider`/`GraphContext` — never `graph.snomed_neo4j.provider` directly.
- All Layer 1 writes are `MERGE`-on-`id`, idempotent, safe to re-run.
- No live/scheduled RF2 refresh pipeline this sprint (explicit design decision, §6/§13 of the design doc) — this is a one-time pinned load.

---

## Phase 0 — Decisive finding: ingest the Canadian Edition only, not both

**This resolves the "load_rf2 can't load both editions" problem by making the question moot, rather than by making the loader smarter about two formats.**

Verified against the actual extracted data (not assumed):

| Check | Result |
|---|---|
| CA Concept Snapshot row count | 591,380 |
| International Concept Snapshot row count | 534,402 |
| CA Concept moduleId breakdown | `900000000000207008` (SNOMED CT core/International module) = 530,044 rows · `20621000087109` (Canadian extension module) = 59,391 rows · `900000000000012004` (SNOMED CT model component module) = 1,945 rows |
| Sample of 5 arbitrary International concept IDs, checked for presence in the CA file | 5/5 present |

The Canadian Edition RF2 release is a **combined/merged package**: the National Release Center (Canada Health Infoway) ships International Edition content and the Canadian extension pre-merged into single Concept/Description/Relationship files, distinguished internally by `moduleId`, not by separate files. This is a documented, standard SNOMED national-release pattern — NHS's UK Edition ships the same "combined view" option, built by merging "separate snapshots" and "post-processed to resolve duplicates and conflicts" ([NHS TRUD SNOMED CT UK Edition](https://isd.digital.nhs.uk/trud/users/guest/filters/0/categories/26)). The ~4,600-row gap between CA's International-module count (530,044) and standalone International's own count (534,402) is expected release-date drift — CA is pinned to 2026-05-31, standalone International to 2026-07-01, five weeks of upstream churn apart.

**Decision:** `load_rf2.py` targets the Canadian Edition exclusively. The standalone International Edition at `/databank/snomed` is kept on disk (cheap, 3.6G) as a fallback/diff reference only — it is not a second ingestion target, and no code should try to merge the two. This is also the direct fix for "can't process both at the same time": there is only ever one edition to process.

**Concrete `load_rf2.py` fix needed:** the file-discovery glob must match the Canadian filename pattern, not just International's. Observed naming difference:

| Component | International Edition | Canadian Edition |
|---|---|---|
| Concept (Snapshot) | `sct2_Concept_Snapshot_INT_20260701.txt` | `sct2_Concept_Snapshot_CanadianEdition_20260531.txt` |
| Description (Snapshot) | `sct2_Description_Snapshot-en_INT_20260701.txt` (English-only, separate file) | `sct2_Description_Snapshot_CanadianEdition_20260531.txt` (bilingual, one file, `languageCode` column distinguishes `en`/`fr`) |
| Relationship (Snapshot) | `sct2_Relationship_Snapshot_INT_20260701.txt` | `sct2_Relationship_Snapshot_CanadianEdition_20260531.txt` |

Two consequences for the loader, not one: (1) the glob pattern needs a second edition tag (`CanadianEdition` alongside `INT`), and (2) the Description loader cannot assume "one file = one language" — it must branch on the `languageCode` column, and downstream FSN/synonym selection must additionally filter by the *language reference set* to know which term is preferred-in-English vs preferred-in-French (see Phase 1, step 3).

- [ ] **Step 1: Confirm this finding is still true at ingestion time (data can't have silently changed between verification and build)**

```bash
find /databank/snomed_ct_ca -name "sct2_Concept_Snapshot_CanadianEdition_*.txt" -exec wc -l {} \;
find /databank/snomed -name "sct2_Concept_Snapshot_INT_*.txt" -exec wc -l {} \;
```
Expected: 591,381 / 534,403 (header included). If these drift from the table above, stop and re-verify the moduleId breakdown before proceeding — don't assume the combined-package property still holds without re-checking.

---

## Phase 1 — `load_rf2.py`: Layer 1 ingestion (Concept, Description, `IS_A` Relationship)

**Files:**
- Create: `backend/scripts/snomed_ingest/__init__.py`
- Create: `backend/scripts/snomed_ingest/rf2_reader.py` — pure RF2 parsing, no Neo4j/driver import, independently testable
- Create: `backend/scripts/snomed_ingest/load_rf2.py` — orchestrates read → subset → write; the only file in this package that imports `neo4j`
- Create: `backend/scripts/snomed_ingest/constants.py` — named SNOMED IDs (no magic numbers per clean-code)
- Test: `backend/tests/scripts/snomed_ingest/test_rf2_reader.py`

**Interfaces:**
- Consumes: nothing from other tasks (first task in the pipeline)
- Produces: `rf2_reader.read_concepts(path) -> Iterator[ConceptRow]`, `rf2_reader.read_descriptions(path) -> Iterator[DescriptionRow]`, `rf2_reader.read_relationships(path) -> Iterator[RelationshipRow]` — plain `NamedTuple`s, consumed by `load_rf2.py` and by Phase 2's `anchor_mapping.py` (FSN lookups)

### Verified constants (checked against the actual downloaded release, not assumed)

```python
# backend/scripts/snomed_ingest/constants.py

# Root of the subset this pipeline loads — verified present, active, FSN "Clinical finding (finding)"
CLINICAL_FINDING_ROOT = "404684003"

# RF2 relationship typeId for the IS_A hierarchy edge (verified: 1,332,194 rows carry this
# typeId in the CA Relationship Snapshot, out of 4,032,857 total relationship rows)
IS_A_TYPE_ID = "116680003"

# RF2 descriptionType (col 7 of the Description file) for the Fully Specified Name —
# the disambiguator the anchor-selection process (Phase 2) must match on, per the design doc
FSN_TYPE_ID = "900000000000003001"

# moduleId values actually observed in the CA Concept Snapshot — used only for provenance
# tagging (source_release), never for filtering: this pipeline loads International-module
# and Canadian-module concepts identically once both pass the Clinical Finding subset filter
MODULE_INTERNATIONAL_CORE = "900000000000207008"
MODULE_CANADIAN_EXTENSION = "20621000087109"

# Language reference sets — verified by reading the Canadian Edition's own
# RefsetDescriptor + Description metadata (der2_cciRefset_RefsetDescriptorSnapshot,
# cross-referenced against the concepts' own FSNs), not assumed from convention:
#   19491000087109 -> "Canada English language reference set (foundation metadata concept)"
#   20581000087109 -> "Canada French language reference set (foundation metadata concept)"
LANGUAGE_REFSET_CA_EN = "19491000087109"
LANGUAGE_REFSET_CA_FR = "20581000087109"
```

- [ ] **Step 1: Write the failing test for RF2 TSV parsing**

```python
# backend/tests/scripts/snomed_ingest/test_rf2_reader.py
from backend.scripts.snomed_ingest.rf2_reader import read_concepts

def test_read_concepts_parses_tab_separated_rf2_row(tmp_path):
    rf2_file = tmp_path / "sct2_Concept_Snapshot_CanadianEdition_20260531.txt"
    rf2_file.write_text(
        "id\teffectiveTime\tactive\tmoduleId\tdefinitionStatusId\n"
        "404684003\t20170731\t1\t900000000000207008\t900000000000074008\n"
    )
    rows = list(read_concepts(rf2_file))
    assert len(rows) == 1
    assert rows[0].id == "404684003"
    assert rows[0].active is True
    assert rows[0].module_id == "900000000000207008"
    assert rows[0].effective_time == "20170731"
```

- [ ] **Step 2: Run it, confirm it fails with `ModuleNotFoundError` / `ImportError`**

Run: `pytest backend/tests/scripts/snomed_ingest/test_rf2_reader.py -v`
Expected: FAIL — `read_concepts` doesn't exist yet.

- [ ] **Step 3: Implement `rf2_reader.py`**

```python
# backend/scripts/snomed_ingest/rf2_reader.py
import csv
from pathlib import Path
from typing import Iterator, NamedTuple


class ConceptRow(NamedTuple):
    id: str
    effective_time: str
    active: bool
    module_id: str
    definition_status_id: str


class DescriptionRow(NamedTuple):
    id: str
    effective_time: str
    active: bool
    module_id: str
    concept_id: str
    language_code: str
    type_id: str
    term: str
    case_significance_id: str


class RelationshipRow(NamedTuple):
    id: str
    effective_time: str
    active: bool
    module_id: str
    source_id: str
    destination_id: str
    relationship_group: str
    type_id: str
    characteristic_type_id: str
    modifier_id: str


def _rows(path: Path) -> Iterator[dict]:
    with open(path, encoding="utf-8", newline="") as f:
        yield from csv.DictReader(f, delimiter="\t")


def read_concepts(path: Path) -> Iterator[ConceptRow]:
    for row in _rows(path):
        yield ConceptRow(
            id=row["id"],
            effective_time=row["effectiveTime"],
            active=row["active"] == "1",
            module_id=row["moduleId"],
            definition_status_id=row["definitionStatusId"],
        )


def read_descriptions(path: Path) -> Iterator[DescriptionRow]:
    for row in _rows(path):
        yield DescriptionRow(
            id=row["id"],
            effective_time=row["effectiveTime"],
            active=row["active"] == "1",
            module_id=row["moduleId"],
            concept_id=row["conceptId"],
            language_code=row["languageCode"],
            type_id=row["typeId"],
            term=row["term"],
            case_significance_id=row["caseSignificanceId"],
        )


def read_relationships(path: Path) -> Iterator[RelationshipRow]:
    for row in _rows(path):
        yield RelationshipRow(
            id=row["id"],
            effective_time=row["effectiveTime"],
            active=row["active"] == "1",
            module_id=row["moduleId"],
            source_id=row["sourceId"],
            destination_id=row["destinationId"],
            relationship_group=row["relationshipGroup"],
            type_id=row["typeId"],
            characteristic_type_id=row["characteristicTypeId"],
            modifier_id=row["modifierId"],
        )
```

- [ ] **Step 4: Run the test again, confirm it passes**

Run: `pytest backend/tests/scripts/snomed_ingest/test_rf2_reader.py -v`
Expected: PASS

- [ ] **Step 5: Write the failing test for Clinical Finding subsetting (the actual business rule — everything above was plumbing)**

```python
def test_subset_keeps_only_clinical_finding_descendants_and_root():
    # concept 404684003 = root; 22253000 = "Pain" is a real, verified descendant;
    # 71388002 = "Procedure" is NOT a descendant and must be excluded
    from backend.scripts.snomed_ingest.load_rf2 import concept_ids_in_subset
    relationships = [
        # 22253000 --IS_A--> 404684003 (Pain is a Clinical finding)
        RelationshipRow("1", "20170731", True, "900000000000207008",
                         "22253000", "404684003", "0", "116680003",
                         "900000000000011006", "900000000000451002"),
    ]
    result = concept_ids_in_subset(relationships, root="404684003")
    assert "22253000" in result
    assert "404684003" in result
    assert "71388002" not in result
```

- [ ] **Step 6: Run, confirm fail**

Run: `pytest backend/tests/scripts/snomed_ingest/test_rf2_reader.py::test_subset_keeps_only_clinical_finding_descendants_and_root -v`
Expected: FAIL — `load_rf2` module/function doesn't exist.

- [ ] **Step 7: Implement `load_rf2.py`'s subsetting + Neo4j write**

```python
# backend/scripts/snomed_ingest/load_rf2.py
import argparse
from pathlib import Path
from neo4j import GraphDatabase

from backend.scripts.snomed_ingest.constants import (
    CLINICAL_FINDING_ROOT, IS_A_TYPE_ID, FSN_TYPE_ID,
)
from backend.scripts.snomed_ingest.rf2_reader import (
    read_concepts, read_descriptions, read_relationships,
)


def concept_ids_in_subset(relationships, root: str) -> set[str]:
    """Every concept reachable from `root` by walking IS_A edges upward
    (i.e. every concept whose IS_A ancestry includes root), plus root itself."""
    children_of = {}
    for r in relationships:
        if r.type_id == IS_A_TYPE_ID and r.active:
            children_of.setdefault(r.destination_id, []).append(r.source_id)

    subset = {root}
    frontier = [root]
    while frontier:
        next_frontier = []
        for parent in frontier:
            for child in children_of.get(parent, []):
                if child not in subset:
                    subset.add(child)
                    next_frontier.append(child)
        frontier = next_frontier
    return subset


def load(rf2_snapshot_dir: Path, source_release: str, neo4j_uri: str, neo4j_auth: tuple[str, str]):
    terminology = rf2_snapshot_dir / "Terminology"
    concept_file = next(terminology.glob("sct2_Concept_Snapshot_*.txt"))
    description_file = next(terminology.glob("sct2_Description_Snapshot_*.txt"))
    relationship_file = next(terminology.glob("sct2_Relationship_Snapshot_*.txt"))

    relationships = list(read_relationships(relationship_file))
    subset_ids = concept_ids_in_subset(relationships, CLINICAL_FINDING_ROOT)

    driver = GraphDatabase.driver(neo4j_uri, auth=neo4j_auth)
    with driver.session() as session:
        for concept in read_concepts(concept_file):
            if concept.id not in subset_ids or not concept.active:
                continue
            session.run(
                "MERGE (c:SnomedConcept {id: $id}) "
                "SET c.source_release = $source_release, c.effective_time = $effective_time",
                id=concept.id, source_release=source_release,
                effective_time=concept.effective_time,
            )

        for description in read_descriptions(description_file):
            if description.concept_id not in subset_ids or not description.active:
                continue
            is_fsn = description.type_id == FSN_TYPE_ID
            session.run(
                "MATCH (c:SnomedConcept {id: $concept_id}) "
                "MERGE (d:Description {id: $id}) "
                "SET d.term = $term, d.language_code = $language_code, "
                "    d.is_fsn = $is_fsn, d.source_release = $source_release, "
                "    d.effective_time = $effective_time "
                "MERGE (c)-[:HAS_DESCRIPTION]->(d)",
                concept_id=description.concept_id, id=description.id,
                term=description.term, language_code=description.language_code,
                is_fsn=is_fsn, source_release=source_release,
                effective_time=description.effective_time,
            )
            if is_fsn:
                session.run(
                    "MATCH (c:SnomedConcept {id: $id}) SET c.fsn = $term",
                    id=description.concept_id, term=description.term,
                )

        for rel in relationships:
            if (rel.type_id != IS_A_TYPE_ID or not rel.active
                    or rel.source_id not in subset_ids or rel.destination_id not in subset_ids):
                continue
            session.run(
                "MATCH (child:SnomedConcept {id: $source_id}) "
                "MATCH (parent:SnomedConcept {id: $destination_id}) "
                "MERGE (child)-[:IS_A]->(parent)",
                source_id=rel.source_id, destination_id=rel.destination_id,
            )
    driver.close()


if __name__ == "__main__":
    parser = argparse.ArgumentParser()
    parser.add_argument("--rf2-snapshot-dir", type=Path, required=True)
    parser.add_argument("--source-release", required=True)
    parser.add_argument("--neo4j-uri", required=True)
    parser.add_argument("--neo4j-user", required=True)
    parser.add_argument("--neo4j-password", required=True)
    args = parser.parse_args()
    load(args.rf2_snapshot_dir, args.source_release, args.neo4j_uri,
         (args.neo4j_user, args.neo4j_password))
```

- [ ] **Step 8: Run the subsetting test, confirm it passes**

Run: `pytest backend/tests/scripts/snomed_ingest/test_rf2_reader.py -v`
Expected: PASS (both tests)

- [ ] **Step 9: Tracer bullet — load a tiny real subset before the full Clinical Finding hierarchy (Pragmatic Programmer: prove the end-to-end path before scaling)**

```bash
# Point rf2-snapshot-dir at the real CA Snapshot, but verify against a small,
# known-good query before trusting the full ~subset load
python -m backend.scripts.snomed_ingest.load_rf2 \
  --rf2-snapshot-dir /databank/snomed_ct_ca/SnomedCT_Canadian_EditionRelease_PRODUCTION_20260531T120000Z/Snapshot \
  --source-release SnomedCT_Canadian_20260531 \
  --neo4j-uri <aura-uri> --neo4j-user neo4j --neo4j-password <password>
```

Verify in Neo4j Browser / cypher-shell:
```cypher
MATCH (c:SnomedConcept {id: "404684003"}) RETURN c.fsn, c.source_release;
// Expected: c.fsn = "Clinical finding (finding)", c.source_release = "SnomedCT_Canadian_20260531"

MATCH (child:SnomedConcept)-[:IS_A]->(parent:SnomedConcept {id: "404684003"})
RETURN count(child);
// Expected: > 0 — direct children of the root exist
```

- [ ] **Step 10: Commit**

```bash
git add backend/scripts/snomed_ingest/ backend/tests/scripts/snomed_ingest/
git commit -m "feat(snomed): add RF2 Snapshot ingestion pipeline for Canadian Edition"
```

---

## Phase 2 — Layer 2: the mandatory augmentation (raw SNOMED alone has no triage semantics)

This is the "raw data has to be augmented somewhere" step. It is not optional and not a future nice-to-have — it's already scoped in the design doc (§3, §5) and is what makes Layer 1 useful at all: raw SNOMED CT has no concept of "red flag," "urgency," or "follow-up question." Layer 1 is a pure terminology graph; Layer 2 is what turns it into a triage-reasoning structure.

**Files:**
- Create: `backend/scripts/snomed_ingest/anchor_mapping.py` — the `(alias → anchor_concept_id, fsn, rationale)` records; migrated from `backend/graph/static_provider.py`'s existing CTAS alias JSON
- Create: `backend/scripts/snomed_ingest/seed_red_flags.py` — writes `HAS_RED_FLAG`/`ASKS`/`PART_OF` edges from `anchor_mapping.py`'s output; structurally cannot touch `:SnomedConcept`/`:Description` (only ever `MATCH`es them, never `MERGE`s/`SET`s them)

**Interfaces:**
- Consumes: `rf2_reader.DescriptionRow` (to look up FSNs for disambiguation), existing `static_provider.py` alias JSON (read-only, migration source)
- Produces: `anchor_mapping.py`'s `ANCHOR_MAPPINGS: list[AnchorMapping]` — consumed by both `seed_red_flags.py` (Layer 2 seed data) and Phase 3's precision-test fixtures (per design §5 point 3, one artifact, two uses)

- [ ] **Step 1: For each existing CTAS complaint in `static_provider.py`'s alias JSON, find candidate SNOMED concepts by FSN, per the design's methodology (§5)**

Run against the loaded graph:
```cypher
MATCH (c:SnomedConcept)-[:HAS_DESCRIPTION]->(d:Description {is_fsn: true})
WHERE toLower(d.term) CONTAINS toLower($complaint_keyword)
RETURN c.id, d.term
```
For each CTAS complaint, record every candidate this returns.

- [ ] **Step 2: Apply the SNOMED Mapping Guide's editorial process to pick one concept per complaint, write the rationale**

```python
# backend/scripts/snomed_ingest/anchor_mapping.py
from typing import NamedTuple

class AnchorMapping(NamedTuple):
    ctas_alias: str          # the existing static_provider.py alias string
    anchor_concept_id: str
    fsn: str
    rationale: str           # why this concept over the close alternatives — required, not optional

ANCHOR_MAPPINGS: list[AnchorMapping] = [
    AnchorMapping(
        ctas_alias="chest pain",
        anchor_concept_id="29857009",
        fsn="Chest pain (finding)",
        rationale=(
            "FSN-disambiguated per SNOMED Mapping Guide: candidates included "
            "'Chest pain (finding)' [29857009] and 'Central chest pain (finding)' "
            "[271825005]. Chose the broader parent so IS_A*0..3 traversal (design "
            "doc §3) naturally covers 'central chest pain' and other descendants "
            "without a separate anchor per variant."
        ),
    ),
    # ... one entry per existing static_provider.py alias — this is a
    # data-migration task, not a code-design task; do not stub the list.
]
```

- [ ] **Step 3: Implement `seed_red_flags.py`, scoped so it structurally cannot write Layer 1 labels**

```python
# backend/scripts/snomed_ingest/seed_red_flags.py
from neo4j import GraphDatabase
from backend.scripts.snomed_ingest.anchor_mapping import ANCHOR_MAPPINGS
from backend.graph.static_provider import load_red_flag_content  # existing CTAS content


def seed(neo4j_uri: str, neo4j_auth: tuple[str, str]):
    red_flag_content = load_red_flag_content()  # {alias: [{indicator, ctas_level, app_severity, followups}]}
    driver = GraphDatabase.driver(neo4j_uri, auth=neo4j_auth)
    with driver.session() as session:
        for mapping in ANCHOR_MAPPINGS:
            for red_flag in red_flag_content.get(mapping.ctas_alias, []):
                session.run(
                    "MATCH (anchor:SnomedConcept {id: $anchor_id}) "
                    "MERGE (rf:RedFlag {indicator: $indicator}) "
                    "SET rf.ctas_level = $ctas_level, rf.app_severity = $app_severity "
                    "MERGE (anchor)-[:HAS_RED_FLAG]->(rf)",
                    anchor_id=mapping.anchor_concept_id, indicator=red_flag["indicator"],
                    ctas_level=red_flag["ctas_level"], app_severity=red_flag["app_severity"],
                )
                for question in red_flag["followups"]:
                    session.run(
                        "MATCH (rf:RedFlag {indicator: $indicator}) "
                        "MERGE (q:FollowupQuestion {text: $text}) "
                        "MERGE (rf)-[:ASKS]->(q)",
                        indicator=red_flag["indicator"], text=question,
                    )
    driver.close()
```

- [ ] **Step 4: Verify structural protection holds (Layer 1 re-import cannot clobber Layer 2 — this is the design's own load-bearing claim, test it)**

```python
# backend/tests/scripts/snomed_ingest/test_layer_isolation.py
def test_load_rf2_cypher_never_references_layer_2_labels():
    import inspect
    from backend.scripts.snomed_ingest import load_rf2
    source = inspect.getsource(load_rf2)
    for forbidden in ("RedFlag", "FollowupQuestion", "RedFlagCluster",
                       "HAS_RED_FLAG", "ASKS", "PART_OF"):
        assert forbidden not in source, (
            f"load_rf2.py must never reference {forbidden} — Layer 2 is "
            f"seed_red_flags.py's exclusive responsibility (design doc §3)"
        )
```

Run: `pytest backend/tests/scripts/snomed_ingest/test_layer_isolation.py -v`
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add backend/scripts/snomed_ingest/anchor_mapping.py backend/scripts/snomed_ingest/seed_red_flags.py backend/tests/scripts/snomed_ingest/test_layer_isolation.py
git commit -m "feat(snomed): seed Layer 2 red-flag overlay from CTAS anchor mapping"
```

---

## Phase 3 — Precision/recall tuning of `IS_A` traversal depth (design §5 point 4, §10)

**Files:**
- Create: `backend/tests/graph/test_entity_linking_precision.py`

Per anchor in `ANCHOR_MAPPINGS`: sample true `IS_A` descendants at depth 1-3, sample sibling/cousin concepts that must NOT resolve, sweep depth 1-4, record the smallest depth hitting target recall without pulling in negatives. Document per-anchor result as a comment in `anchor_mapping.py`, not a single global constant (design doc is explicit on this point — different complaints have different hierarchy shapes under them).

- [ ] **Step 1: Write the test structure** (one parametrized test per anchor, (a)/(b)/(c) cases per design §10)
- [ ] **Step 2: Run the depth sweep, record results in `anchor_mapping.py`**
- [ ] **Step 3: Commit**

---

## Phase 4 — `Neo4jSnomedProvider`: wire the graph into the application (Clean Architecture Interface Adapter)

**Files:**
- Create: `backend/graph/snomed_neo4j/__init__.py`
- Create: `backend/graph/snomed_neo4j/client.py` — thin driver/session wrapper (Framework & Drivers detail)
- Create: `backend/graph/snomed_neo4j/queries.py` — pure Cypher strings/builders, no driver calls (independently testable)
- Create: `backend/graph/snomed_neo4j/provider.py` — `SnomedGraphProvider(GraphContextProvider)`
- Modify: `backend/graph/factory.py:159-161` (the existing `NotImplementedError` stub, per design §7)
- Test: `backend/tests/graph/test_snomed_provider.py`

**Interfaces:**
- Consumes: `graph.base.GraphContext`, `graph.base.RedFlagMatch`, `graph.base.GraphContextProvider` (unchanged, per Global Constraints)
- Produces: `SnomedGraphProvider().get_symptom_graph_context(user_message: str, recent_messages: list[str]) -> GraphContext` — same signature `StaticLookupProvider` already implements

- [ ] **Step 1: Write the failing test for the traversal query in isolation (no driver — pure Cypher string, per Clean Code "test business rules without DB")**

```python
def test_traversal_query_bounds_is_a_depth_and_filters_by_candidate_ids():
    from backend.graph.snomed_neo4j.queries import build_red_flag_traversal_query
    query, params = build_red_flag_traversal_query(candidate_concept_ids=["22253000"])
    assert "IS_A*0..3" in query
    assert params["candidate_concept_ids"] == ["22253000"]
```

- [ ] **Step 2: Run, confirm fail**
- [ ] **Step 3: Implement `queries.py`** (the exact Cypher from design doc §3, parameterized)
- [ ] **Step 4: Run, confirm pass**
- [ ] **Step 5: Implement `client.py`, `provider.py`** — `_lookup()` per design §4 steps 1-6, mapping `neo4j.Record` → `GraphContext`/`RedFlagMatch` only inside `provider.py`
- [ ] **Step 6: Wire `factory.py`'s `neo4j` branch** (per design §7 — replace the `NotImplementedError` with the real import + construction)
- [ ] **Step 7: Integration test against a real (test-tagged) Neo4j instance or `testcontainers-neo4j`**
- [ ] **Step 8: Commit**

---

## Phase 5 — Prompt injection regression suite (design §9 — blocking, CI gate)

**Files:**
- Create: `backend/tests/graph/test_prompt_injection.py`

Covers both `StaticLookupProvider` and `SnomedGraphProvider` per design §9's five-point test plan: injection payload battery, severity/refusal-behavior assertion, no-echo assertion, output-side EMERGENCY-keyword cross-check, CI gate on every `prompts.py` change. Promptfoo is the grounded tooling recommendation from the design doc for the payload battery (OWASP LLM Top 10 preset).

- [ ] **Step 1-5:** per design doc §9 verbatim — not repeated here to avoid drift between two copies of the same test plan; implementer reads §9 directly.

---

## Phase 6 — Cutover

- [ ] **Step 1:** `GRAPH_RAG_PROVIDER=neo4j` reachable via env var, default remains `static`/`off` for real users (per design §7 — no tier gating)
- [ ] **Step 2:** Run the two-turn worked example from design doc §4 / research artifact Addendum 3 as the first hand-written eval case
- [ ] **Step 3:** DeepEval Track A/B harness per design §12 (Sprint 19's existing eval scope)
- [ ] **Step 4:** Re-derive the Clean Architecture Quick Diagnostic score (design §1) against the actual diff — required, not optional, before citing it anywhere (design §13)

---

## Phase 7 — Explicitly deferred, not this sprint: vector embedding augmentation

The design doc's Layer 1/Layer 2 architecture and the `IS_A*0..3` traversal are **substring/exact-match against SNOMED's own `Description.term` synonym list** — no embeddings, no ML entity linking. This is deliberate (design doc §13: "Multilingual/paraphrase matching beyond what SNOMED's own Description synonyms provide out of the box" is out of scope), and matches the 07-19 plan's trigger #4: paraphrase/multilingual matching only becomes a real project once an eval shows the keyword approach is *measurably* missing real user phrasing — not before.

If/when that trigger fires, the grounded approach (do not build this speculatively now) is Neo4j's own hybrid retrieval pattern — a vector index alongside the existing full-text/graph index, queried through `neo4j-graphrag-python`'s `HybridRetriever` ([Neo4j: Hybrid retrieval using the GraphRAG Python package](https://neo4j.com/blog/developer/hybrid-retrieval-graphrag-python-package/)), which is also the pattern used in the closest published analog — a hybrid graph-RAG system for clinical patient QA combining Neo4j graph traversal with vector embeddings ([PMC13014479](https://pmc.ncbi.nlm.nih.gov/articles/PMC13014479/)). This is a lighter-weight ask than full ML entity linking (SNOMED International's own Entity Linking Challenge and SNOBERT-style benchmarks are a different, heavier problem — clinical-note span extraction, not synonym-paraphrase matching over a small curated anchor set) — don't reach for that machinery unless the simpler vector-augmented Layer 1 lookup is measured and found insufficient.

---

## Skills applied to this plan (per repo convention, see `feedback_kg_design_skills` memory)

- **Clean Architecture:** Layer 1/Layer 2 separation is enforced structurally (Phase 2 Step 4's test), not by convention. `snomed_ingest/` scripts never imported by the request path. `provider.py` is the sole `neo4j.Record` boundary crossing. Dependency Rule score to be re-derived against the actual diff post-implementation (design §1, §13) — not claimed here.
- **Clean Code:** SNOMED IDs are named constants (`constants.py`), not magic strings scattered across scripts. `concept_ids_in_subset` is a single-purpose, independently testable function. No comments explaining *what* the Cypher does — the query strings and function names carry that; comments are reserved for *why* (e.g. the anchor-selection rationale field, which is mandatory per entry, not optional).
- **Pragmatic Programmer:** Orthogonality — `rf2_reader.py` has zero Neo4j knowledge; `queries.py` has zero driver knowledge. Tracer bullet — Phase 1 Step 9 loads and verifies a real subset before trusting the full load. Reversibility — subset root and language refsets are named constants, not hardcoded inline, so re-scoping later is a one-line change. DRY — one `load_rf2.py` driven by an edition-agnostic glob, not a second script for the Canadian filename pattern.
- **DDIA:** Data model choice (graph, not relational) is justified by the access pattern — recursive `IS_A` closure is exactly what index-free adjacency is for, and a flat/relational schema would need a recursive CTE per query instead of native traversal. Batch, not streaming — one-time pinned load, no CDC, matches design §6's explicit no-live-refresh decision. Idempotency via `MERGE`-on-`id` makes reruns safe (a partial failure mid-load is not a corruption risk — a fault-tolerance property, not just a convenience). AuraDB Free's 72h auto-pause is a known, already-mitigated fault mode (existing try/except degrade in `GraphContextProvider`, design §11) — no new mechanism invented for it here.

## Sources (ground-truth verification, not assumed)

- [IHTSDO/snomed-database-loader — official RF2→Neo4j reference tool](https://github.com/IHTSDO/snomed-database-loader/blob/master/NEO4J/Readme.md) — confirms official prior art requires **Full** RF2 (not Snapshot) and has no documented multi-edition/module-filtering support; this plan deliberately diverges (Snapshot-only, for the stated reason: one-time pinned current-state load, not full historical replay) and treats module-aware combined-edition handling as this plan's own contribution, grounded against the actual data rather than this tool's undocumented behavior.
- [NHS TRUD — SNOMED CT UK Edition](https://isd.digital.nhs.uk/trud/users/guest/filters/0/categories/26) and [sct-rs UK edition structure](https://docs.rs/crate/sct-rs/latest/source/docs/uk-edition-structure.md) — confirm "combined/merged" national-edition packaging (International + extension pre-merged, de-duplicated) is a standard, documented SNOMED distribution pattern, not a Canada-specific quirk.
- [Neo4j — Hybrid retrieval using the GraphRAG Python package](https://neo4j.com/blog/developer/hybrid-retrieval-graphrag-python-package/) and [PMC13014479 — hybrid graph RAG for clinical patient QA](https://pmc.ncbi.nlm.nih.gov/articles/PMC13014479/) — grounding for Phase 7's deferred vector-augmentation approach, cited but explicitly not built this sprint.
- Clinical Finding root (`404684003`), `IS_A` typeId (`116680003`), and the two Canadian language refset IDs (`19491000087109` = Canada English, `20581000087109` = Canada French) — verified directly against the extracted `/databank/snomed_ct_ca` release's own Description and RefsetDescriptor files, not from external documentation or memory.

## Rerun Inputs
workflow: writing-plans (superpowers) + clean-architecture/clean-code/pragmatic-programmer/ddia-systems applied to plan structure, grounded by web research (firecrawl_search + WebFetch) and direct verification against the extracted RF2 data
topic: SNOMED CT RF2 (Canadian Edition, 20260531) → deployed Neo4j KG, Sprint 19 resumption
inputs: artifacts/2026-07-25-symptom-understanding-v2-graphrag-design.md, artifacts/2026-07-19-graphrag-neo4j-integration-plan.md, artifacts/2026-07-25-snomed-ct-vs-ctas-vs-graphrag-research.md, artifacts/2026-07-28-snomed-ct-context.md, CHANGELOG.md Sprint 19, /databank (both extracted editions, directly queried), backend/graph/{base,factory,static_provider}.py
output: markdown implementation plan
