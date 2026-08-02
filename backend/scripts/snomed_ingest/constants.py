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

# Approved deviation from the plan's literal single-root subset design (see
# load_rf2.py's module docstring and task-1-report.md): the full Clinical
# Finding subtree is ~3x over Neo4j AuraDB Free tier's 200,000-node cap. The
# actual downstream need is only the neighborhoods around the CTAS complaint
# concepts — Phase 3's own bounded IS_A*0..4 sweep from each anchor. This bounds
# how many IS_A hops load_rf2.py descends from each complaint-matched seed.
MAX_SEED_DESCENDANT_DEPTH = 4
