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
    # RF2 files are plain unquoted TSV per the SNOMED release format spec — terms may
    # contain literal double-quote characters (e.g. quoted product names, inch marks).
    # csv's default "excel" dialect treats '"' as a quote char and QUOTE_MINIMAL, which
    # misparses those rows (observed: "field larger than field limit" on the real CA
    # Description Snapshot). QUOTE_NONE disables quote interpretation entirely, matching
    # the RF2 spec's actual (lack of) escaping rules.
    with open(path, encoding="utf-8", newline="") as f:
        yield from csv.DictReader(f, delimiter="\t", quoting=csv.QUOTE_NONE)


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
