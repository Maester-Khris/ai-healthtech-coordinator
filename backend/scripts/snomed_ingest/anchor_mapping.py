# backend/scripts/snomed_ingest/anchor_mapping.py
"""
Phase 2 -- CTAS complaint -> SNOMED CT anchor concept mappings.

165 CTAS presenting complaints from backend/triage/resources/symptom_triage_data.json,
each mapped to one SNOMED CT Clinical Finding concept (the "anchor") that
seed_red_flags.py attaches HAS_RED_FLAG/ASKS edges to, and that Phase 4's
Neo4jSnomedProvider bounds its IS_A traversal from at query time.

Built via a hybrid pipeline, then corrected across TWO rounds of holistic
cross-batch review (opus) after 9 independent LLM batch-authoring passes:

  1. anchor_resolver.py -- deterministic pre-resolution (~20% auto-resolved):
     exact single-candidate matches, IS_A-hierarchy broader-parent picks, and
     dominant textual-similarity matches. Keyword expansion for three
     systematic CTAS naming patterns (slash-compounds, comma-inverted
     phrasing, trailing parenthetical qualifiers not present in SNOMED's own
     terms).
  2. 9 batches of LLM-assisted editorial mapping for the residual complaints,
     each verified against real loaded SNOMED data via search_snomed.py.
  3. Merge + controller spot-checks (5 complaints affected by a resolver
     keyword-expansion bug fix).
  4. **Holistic review round 1** found a systematic root cause spanning 5+
     independent batches: "no broader parent exists" was asserted from the
     resolver's candidate *pool*, not from SNOMED itself -- 10/10 tested
     claims were false. 21 entries also used clinical prevalence as a wrong
     tie-break (picking a child over its own parent -- prevalence is only a
     valid tie-break between siblings). Produced ~22 corrections and 4
     additional zero-red-flag exclusions.
  5. **Holistic review round 2** (scoped re-review) confirmed all round-1
     fixes landed cleanly with no new breakage, but caught the SAME defect
     class recurring in entries round 1 didn't enumerate: 3 more false
     "no candidates" claims (056, 155, 265 -- one of them, 056, called "the
     worst anchor remaining in the file"), 2 more prevalence-over-parent
     picks (701, 702), 2 more unnamed-broader-ancestor picks (503, 456), and
     one undocumented traversal gap (451, anchor correct, limitation now
     documented). All 7 corrected; a follow-up mechanical ancestor-vs-
     candidate-pool sweep across all 154 entries found 63 more flags, but
     manual sampling confirmed (consistent with round 1's own 30-flag sweep,
     ~2/3 legitimate) that most are deliberate correct narrowings where the
     CTAS complaint name is itself qualified (e.g. "Edema, generalized")
     rather than errors -- not exhaustively hand-triaged past that point,
     a residual risk documented here rather than hidden. All 9 remaining
     single-candidate ("AUTO_SINGLE") claims were independently re-verified
     via search_snomed.py and confirmed genuinely correct.

**Known upstream data-quality note (flagged, not silently fixed per this
repo's convention):** three `ctas_alias` values (nacrs_code 004, 005, 007)
contain PDF text-wrap duplication artifacts from the original CTAS source
extraction (e.g. "General weakness Gener") -- already documented in
reconcile_ctas_data.py's build_alias_overrides() docstring. 004's corrupted
text contributed to a wrong anchor pick, now corrected. 005 and 007's
anchors were independently verified correct despite the corruption.

**Residual known limitation:** the mechanical sweep's 63 flags (see point 5
above) were not exhaustively hand-verified past the 7 confirmed real errors
already fixed -- if red-flag matching quality issues surface later for a
specific complaint, re-running the sweep (the ancestor-vs-candidate-pool
check described in point 5, over ANCHOR_MAPPINGS + anchor_resolver.py's
output) and checking that complaint's flag is a reasonable first diagnostic
step.

154 of 165 complaints resolved. 11 total exclusions, all confirmed via real
research, not silently dropped -- see the SDD ledger at
.superpowers/sdd/2026-07-28-snomed-rf2-to-neo4j-kg-pipeline/progress.md for
the full history and individual justifications. All 11 continue to work via v1's
StaticLookupProvider (unaffected either way) -- this SNOMED KG is an
additive v2 enhancement, not a replacement, per the design doc.

Phase 3 schema extension: `AnchorMapping` also carries `max_depth`, the IS_A
traversal depth Phase 4's Neo4jSnomedProvider will use for this anchor. It
defaults to MAX_SEED_DESCENDANT_DEPTH so every existing entry above keeps its
current blanket-depth-4 behavior unchanged -- none of the 154 literal
AnchorMapping(...) call sites below set it. depth_flagging.py's fan-out/
overlap analysis (backend/scripts/snomed_ingest/depth_flagging.py) is how
candidates for a narrower value get surfaced; only a human, after reviewing
that tool's real output on the live graph, should ever set an entry's
max_depth to anything other than the default.
"""
from typing import NamedTuple


class AnchorMapping(NamedTuple):
    ctas_alias: str          # the CTAS complaint's exact `name` field in symptom_triage_data.json
    anchor_concept_id: str
    fsn: str
    rationale: str           # why this concept over the alternatives -- required, not optional
    max_depth: int = 4       # IS_A traversal depth Phase 4's Neo4jSnomedProvider will use for
                             # this anchor. Defaults to MAX_SEED_DESCENDANT_DEPTH (matches the
                             # current blanket load depth) so every existing entry keeps its
                             # current behavior unchanged. Only entries flagged by Phase 3's
                             # depth_flagging.py and hand-corrected by the controller after
                             # review should ever get a narrower value here.


ANCHOR_MAPPINGS: list[AnchorMapping] = [
    AnchorMapping(
        ctas_alias="Cardiac arrest (non traumatic)",
        anchor_concept_id="410429000",
        fsn="Cardiac arrest (disorder)",
        rationale=(
            "[controller-corrected after resolver keyword-expansion fix] Original batch pick (422768004 Unresponsive (finding)) was a proxy chosen because the initial candidate pool -- built before a parenthetical-stripping fix to the resolver -- never surfaced the real Cardiac arrest concept ('Cardiac arrest (non traumatic)' never matches SNOMED's plain 'Cardiac arrest (disorder)' verbatim; the '(non traumatic)' qualifier is CTAS's own addition, not part of the SNOMED term). After the fix, 410429000 Cardiac arrest (disorder) is present and is the correct general-case anchor -- directly parallel to complaint 002 'Cardiac arrest (traumatic)', which correctly resolved to the trauma-specific 422970001 Cardiac arrest due to trauma (disorder). 001 takes the base concept since 'non traumatic' has no corresponding SNOMED sub-hierarchy to specialize into."
        ),
    ),
    AnchorMapping(
        ctas_alias="Cardiac arrest (traumatic)",
        anchor_concept_id="422970001",
        fsn="Cardiac arrest due to trauma (disorder)",
        rationale=(
            "Searched 'traumatic cardiac arrest' (0 hits CF). Searched 'cardiac arrest due to trauma' → confirmed 422970001 Cardiac arrest due to trauma (disorder) — exact canonical match. This is the precise SNOMED concept for traumatic cardiac arrest, distinct from non-traumatic cardiac arrest. No subtype disambiguation required."
        ),
    ),
    AnchorMapping(
        ctas_alias="Chest pain (cardiac features)",
        anchor_concept_id="426396005",
        fsn="Cardiac chest pain (finding)",
        rationale=(
            "426396005 Cardiac chest pain (finding) is the sole candidate naming both 'chest pain' and 'cardiac', directly matching CTAS qualifier 'cardiac features'. All angina subtypes are narrower IS-A descendants; bounded traversal covers them. Rejected 194828000 Angina (disorder) — subtype, not parent; non-anginal ACS must also be reachable. Rejected 274668005 Non-cardiac chest pain — complement set."
        ),
    ),
    AnchorMapping(
        ctas_alias="Chest pain (non cardiac features) Chest pain (non",
        anchor_concept_id="274668005",
        fsn="Non-cardiac chest pain (finding)",
        rationale=(
            "[controller-corrected after holistic review] Original pick was 281245003 'Musculoskeletal chest pain (finding)'. Holistic review (opus) independently verified via search_snomed.py that exact-match concept exists, named in 003's own rationale. Corrected to 274668005 'Non-cardiac chest pain (finding)'."
        ),
    ),
    AnchorMapping(
        ctas_alias="Palpitations / Irregular heart beat Palpit ations",
        anchor_concept_id="80313002",
        fsn="Palpitations (finding)",
        rationale=(
            "[auto-resolved, AUTO_HIERARCHY] Palpitations (finding) (80313002) is a common IS_A ancestor of every other matched candidate for 'Palpitations / Irregular heart beat Palpit ations', chosen per the plan's broader-parent rule (bounded descendant traversal from it covers the rejected variants without a separate anchor per variant). Rejected as redundant descendants: Intermittent palpitations (finding) (102590007); Fluttering heart (finding) (161969004); Palpitations with regular rhythm (finding) (428919002); Postoperative fluttering heart (finding) (709065005); Palpitations - rapid (finding) (248648003); Pounding heart (finding) (248657009)."
        ),
    ),
    AnchorMapping(
        ctas_alias="Hypertension",
        anchor_concept_id="38341003",
        fsn="Hypertensive disorder, systemic arterial (disorder)",
        rationale=(
            "38341003 Hypertensive disorder, systemic arterial (disorder) is the SNOMED top-level parent for systemic hypertension. Bounded IS-A traversal covers essential, secondary, malignant, labile, pregnancy-related systemic hypertension. Rejected 70995007 Pulmonary hypertension — distinct physiology. Rejected 4210003 Ocular hypertension — ophthalmology subspecialty. Rejected 34742003 Portal hypertension — hepatic context."
        ),
    ),
    AnchorMapping(
        ctas_alias="General weakness Gener",
        anchor_concept_id="13791008",
        fsn="Asthenia (finding)",
        rationale=(
            "[auto-resolved, AUTO_SINGLE] Asthenia (finding) (13791008) was the sole SNOMED Clinical Finding concept matching 'General weakness Gener' and its aliases via keyword search (FSN + synonym descriptions, word-boundary matched). No other candidates existed to reject."
        ),
    ),
    AnchorMapping(
        ctas_alias="Syncope / Pre-syncope",
        anchor_concept_id="271594007",
        fsn="Syncope (finding)",
        rationale=(
            "271594007 Syncope (finding) is the broadest candidate for the primary clinical event. IS-A descendants include vasovagal, cardiac, orthostatic, situational, carotid sinus, hypotensive syncope. Rejected 427461000 Near syncope (disorder) — covers only the pre-syncope pole, narrower. Pre-syncope captured as related concept. Rejected 309585006 Syncope and collapse — convenience grouper, not a clean hierarchy parent."
        ),
    ),
    AnchorMapping(
        ctas_alias="Edema, generalized",
        anchor_concept_id="271808008",
        fsn="Generalized edema (finding)",
        rationale=(
            "271808008 Generalized edema (finding) exactly matches 'Edema, generalized' and is the parent from which organ-specific and etiological subtypes descend. Rejected 860797003 Generalized edema due to fluid overload — etiological subtype, too narrow. Rejected 262694001 Traumatic generalized cerebral edema — wrong body region (brain) and wrong cause (trauma)."
        ),
    ),
    AnchorMapping(
        ctas_alias="Bilateral leg swelling / Edema",
        anchor_concept_id="449707004",
        fsn="Edema of lower leg (finding)",
        rationale=(
            "449707004 Edema of lower leg (finding) is the most precise etiology-neutral candidate for bilateral leg swelling. Bilateral variants and cause-specific subtypes (venous insufficiency, cardiac) are IS-A descendants. Rejected 706913006 Varicose veins with edema and 83011000119100 Venous stasis ulcer with edema — both presuppose specific etiology; CTAS alias is etiology-neutral. Rejected 15929861000119106 Edema of bilateral lower limbs due to venous insufficiency — too etiology-specific."
        ),
    ),
    AnchorMapping(
        ctas_alias="Cool pulseless limb",
        anchor_concept_id="21631000119105",
        fsn="Limb ischemia (disorder)",
        rationale=(
            "Searched 'pulseless limb' (0 hits CF), then 'limb ischemia' (6 hits CF). 21631000119105 Limb ischemia (disorder) is the etiology-neutral broad parent for a cool pulseless limb — the clinical presentation of acute peripheral arterial occlusion. IS-A descendants include Upper limb ischemia (233959009), Lower limb ischemia (233961000), Acute lower limb ischemia (1230182004), and critical ischemia variants. Rejected 233959009/233961000 as laterality-specific. Rejected 723868007 Acute occlusion of artery — mechanism-specific, excludes chronic/subacute. Limb ischemia (disorder) is the most appropriate IS-A anchor for bounded traversal."
        ),
    ),
    AnchorMapping(
        ctas_alias="Unilateral reddened hot limb",
        anchor_concept_id="64156001",
        fsn="Thrombophlebitis (disorder)",
        rationale=(
            "[controller-corrected after holistic review] Original pick was 95451004 'Thrombophlebitis of superficial veins of upper extremities (disorder)'. original pick (Thrombophlebitis of superficial veins of upper extremities) was silently upper-limb-only despite the complaint being unilateral-but-limb-agnostic; generic parent exists. Corrected to 64156001 'Thrombophlebitis (disorder)'."
        ),
    ),
    AnchorMapping(
        ctas_alias="Earache",
        anchor_concept_id="301354004",
        fsn="Pain of ear (finding)",
        rationale=(
            "[auto-resolved, AUTO_HIERARCHY] Pain of ear (finding) (301354004) is a common IS_A ancestor of every other matched candidate for 'Earache', chosen per the plan's broader-parent rule (bounded descendant traversal from it covers the rejected variants without a separate anchor per variant). Rejected as redundant descendants: Referred otalgia (finding) (12336008); Bilateral earache (finding) (162359003); Otalgia of left ear (finding) (1010233001); Otalgia of right ear (finding) (1010234007)."
        ),
    ),
    AnchorMapping(
        ctas_alias="Foreign body ear",
        anchor_concept_id="75441006",
        fsn="Foreign body in ear (disorder)",
        rationale=(
            "Searched 'foreign body in ear' → confirmed 75441006 Foreign body in ear (disorder) as the canonical etiology-neutral parent. IS-A descendants include 874840003 Foreign body in skin of ear (superficial/embedded), 284570001 Metal foreign body in ear region. 75441006 is the broad parent from which all ear FB subtypes descend. Rejected superficial/metal-specific variants as narrower."
        ),
    ),
    AnchorMapping(
        ctas_alias="Loss of hearing",
        anchor_concept_id="15188001",
        fsn="Hearing loss (disorder)",
        rationale=(
            "15188001 Hearing loss (disorder) is the broad canonical parent for loss of hearing, covering conductive, sensorineural, neural, and central subtypes. All candidate subtypes (60700002 SNHL, 44057004 Conductive HL, 73415002 Noise-induced HL, 68467004 Central HL) are IS-A descendants. No broader 'Hearing loss (finding)' exists in candidates; Hearing loss (disorder) is the best available umbrella. Rejected individual subtypes — all are narrower by definition."
        ),
    ),
    AnchorMapping(
        ctas_alias="Tinnitus",
        anchor_concept_id="60862001",
        fsn="Tinnitus (finding)",
        rationale=(
            "60862001 Tinnitus (finding) is the canonical parent concept for the complaint. Subtypes include 62452009 Subjective tinnitus, 232322006 Tinnitus of vascular origin, 95826006 Vibratory tinnitus, 95825005 Non-vibratory tinnitus — all IS-A descendants. Rejected individual subtypes as all are narrower."
        ),
    ),
    AnchorMapping(
        ctas_alias="Discharge, ear",
        anchor_concept_id="300132001",
        fsn="Ear discharge (finding)",
        rationale=(
            "300132001 Ear discharge (finding) is the etiology-neutral parent concept exactly matching 'Discharge, ear'. IS-A descendants include 162365003 Blood discharge from ear, 827089004 Waxy discharge, 65668001 Otorrhea. Rejected 65668001 Otorrhea (disorder) — this is a named subtype/synonym, less broad as an anchor than the generic finding. Rejected 162362000 Ear discharge symptoms — this is a broader symptom context grouper, not the clinical finding parent. 290108005 Nipple discharge clearly irrelevant."
        ),
    ),
    AnchorMapping(
        ctas_alias="Ear injury",
        anchor_concept_id="2999009",
        fsn="Injury of ear (disorder)",
        rationale=(
            "[controller-corrected after fix-round-2 re-review] Original pick was 43251000 'Explosive acoustic trauma to ear (finding)'. original pick (43251000 Explosive acoustic trauma to ear) was a false 'sole candidate' claim -- 2999009 Injury of ear (disorder) exists in Clinical Finding scope and is the correct general anchor; 43251000 is not even a descendant of it (blast-injury-specific, a lateral concept). Corrected to 2999009 'Injury of ear (disorder)'."
        ),
    ),
    AnchorMapping(
        ctas_alias="Dental / Gum problems",
        anchor_concept_id="27355003",
        fsn="Toothache (finding)",
        rationale=(
            "27355003 Toothache (finding) is the most clinically relevant concept for the primary complaint pattern of 'Dental/Gum problems' at ED triage — pain is the dominant driver. No broader 'Dental disorder' or 'Disorder of tooth' parent exists in the candidate pool. All dental pain subtypes are IS-A descendants. Rejected specialised dental candidates (plaque, retained root, restoration findings) — these describe specific dental pathology without representing the presenting symptom."
        ),
    ),
    AnchorMapping(
        ctas_alias="Facial trauma",
        anchor_concept_id="125593007",
        fsn="Injury of face (disorder)",
        rationale=(
            "[auto-resolved, AUTO_SINGLE] Injury of face (disorder) (125593007) was the sole SNOMED Clinical Finding concept matching 'Facial trauma' and its aliases via keyword search (FSN + synonym descriptions, word-boundary matched). No other candidates existed to reject."
        ),
    ),
    AnchorMapping(
        ctas_alias="Sore throat",
        anchor_concept_id="267102003",
        fsn="Sore throat (finding)",
        rationale=(
            "[controller-corrected after holistic review] Original pick was 405737000 'Pharyngitis (disorder)'. Holistic review (opus) independently verified via search_snomed.py that reviewer found exact-match concept the pool missed. Corrected to 267102003 'Sore throat (finding)'."
        ),
    ),
    AnchorMapping(
        ctas_alias="Neck swelling / pain",
        anchor_concept_id="301777002",
        fsn="Neck swelling (finding)",
        rationale=(
            "301777002 Neck swelling (finding) is the most semantically complete single concept for 'Neck swelling / pain', capturing the mass/swelling component which is the primary triage differentiator (lymphadenopathy, abscess, thyroid, vascular). 81680005 Neck pain (finding) captures the pain pole. Between the two, 301777002 Neck swelling is preferred as the anchor because swelling is the more actionable and potentially dangerous presentation; neck pain is more common and lower-acuity. 274755005 Head and neck swelling — includes head, too broad."
        ),
    ),
    AnchorMapping(
        ctas_alias="Neck trauma",
        anchor_concept_id="90460009",
        fsn="Injury of neck (disorder)",
        rationale=(
            "[auto-resolved, AUTO_HIERARCHY] Injury of neck (disorder) (90460009) is a common IS_A ancestor of every other matched candidate for 'Neck trauma', chosen per the plan's broader-parent rule (bounded descendant traversal from it covers the rejected variants without a separate anchor per variant). Rejected as redundant descendants: Head and neck injury (disorder) (282749008)."
        ),
    ),
    AnchorMapping(
        ctas_alias="Difficulty swallowing / Dysphagia",
        anchor_concept_id="40739000",
        fsn="Dysphagia (disorder)",
        rationale=(
            "40739000 Dysphagia (disorder) is the exact canonical concept for 'Difficulty swallowing / Dysphagia'. Subtypes in the pool (oropharyngeal, oral phase, pharyngeal, esophageal-phase, constant, intermittent, fear of drinking) are IS-A descendants. Rejected all narrower subtypes — all are subsumed by Dysphagia (disorder)."
        ),
    ),
    AnchorMapping(
        ctas_alias="Facial pain (non-traumatic / non-dental)",
        anchor_concept_id="95668009",
        fsn="Pain in face (finding)",
        rationale=(
            "[auto-resolved, AUTO_HIERARCHY] Pain in face (finding) (95668009) is a common IS_A ancestor of every other matched candidate for 'Facial pain (non-traumatic / non-dental)', chosen per the plan's broader-parent rule (bounded descendant traversal from it covers the rejected variants without a separate anchor per variant). Rejected as redundant descendants: Chronic pain in face (finding) (432615008); Acute pain in face (finding) (735937001); Chronic secondary facial pain (finding) (762604001); Persistent idiopathic facial pain (disorder) (785723001); Atypical facial pain (finding) (71303008)."
        ),
    ),
    AnchorMapping(
        ctas_alias="Epistaxis",
        anchor_concept_id="249366005",
        fsn="Bleeding from nose (finding)",
        rationale=(
            "249366005 Bleeding from nose (finding) is the most etiology-neutral parent available for 'Epistaxis'. The pool lacks a plain 'Epistaxis (finding)' without a modifier. All anatomically qualified candidates (anterior 232354002, posterior 232355001, traumatic 232356000, post-surgical 232357009) are narrower. Rejected neonatal/fetal epistaxis as paediatric-specific. 277236000 Evidence of recent epistaxis — past tense, not an active presenting-complaint anchor."
        ),
    ),
    AnchorMapping(
        ctas_alias="Nasal congestion / Hay fever",
        anchor_concept_id="68235000",
        fsn="Nasal congestion (finding)",
        rationale=(
            "[auto-resolved, AUTO_SIMILARITY] Nasal congestion (finding) (68235000) had a clearly dominant textual-similarity match against 'Nasal congestion / Hay fever' among 5 matched candidates (no IS_A hierarchy relationship among them). Rejected as less textually specific to this complaint: Seasonal allergic conjunctivitis (disorder) (231855007); Hay fever with asthma (disorder) (233683003); Severe dermatitis, multiple allergies, metabolic wasting syndrome (disorder) (774211005); Allergic rhinitis caused by pollen (disorder) (21719001)."
        ),
    ),
    AnchorMapping(
        ctas_alias="Foreign body, nose",
        anchor_concept_id="74699008",
        fsn="Foreign body in nose (disorder)",
        rationale=(
            "74699008 Foreign body in nose (disorder) is the canonical etiology-neutral parent for 'Foreign body, nose'. Subtypes in pool include 284573004 Metal FB in nose, 298067004 FB in skin of nose, 897303003 FB in skin of nose with infection. 66050007 Foreign body in nasal sinus is anatomically more specific (sinus vs. nasal cavity). Rejected 166835241000119100 Sensation of FB in nose — symptom perception finding, not the actual presence of FB. Rejected 1231587009 Obstruction of respiratory tract due to FB in nose — consequence subtype."
        ),
    ),
    AnchorMapping(
        ctas_alias="URTI complaints",
        anchor_concept_id="54150009",
        fsn="Upper respiratory infection (disorder)",
        rationale=(
            "[auto-resolved, AUTO_HIERARCHY] Upper respiratory infection (disorder) (54150009) is a common IS_A ancestor of every other matched candidate for 'URTI complaints', chosen per the plan's broader-parent rule (bounded descendant traversal from it covers the rejected variants without a separate anchor per variant). Rejected as redundant descendants: Bacterial upper respiratory infection (disorder) (312118003); Acute upper respiratory infection (disorder) (54398005); Acute upper respiratory infection caused by respiratory syncytial virus (disorder) (903729901000119103); Influenzal acute upper respiratory infection (disorder) (43692000)."
        ),
    ),
    AnchorMapping(
        ctas_alias="Nasal trauma",
        anchor_concept_id="19491003",
        fsn="Injury of nose (disorder)",
        rationale=(
            "[controller-corrected after fix-round-2 re-review] Original pick was 263171005 'Fractured nasal bones (disorder)'. original pick (263171005 Fractured nasal bones) was a false 'sole candidate' claim -- 19491003 Injury of nose (disorder) exists and is a confirmed ancestor of the original pick, a textbook child-over-parent error. Corrected to 19491003 'Injury of nose (disorder)'."
        ),
    ),
    AnchorMapping(
        ctas_alias="Frostbite / Cold injury",
        anchor_concept_id="370977006",
        fsn="Frostbite (disorder)",
        rationale=(
            "370977006 Frostbite (disorder) is the exact canonical parent for 'Frostbite / Cold injury'. All anatomically specific frostbite subtypes (face, upper arm, neck, thorax, superficial vs. deep) are IS-A descendants. Rejected 26746005 Neonatal cold injury — pediatric-specific etiological subtype. Rejected 410703004 Superficial frostbite — narrower by severity. Rejected all laterality/anatomical variants — all are narrower."
        ),
    ),
    AnchorMapping(
        ctas_alias="Noxious inhalation",
        anchor_concept_id="426936004",
        fsn="Smoke inhalation injury (disorder)",
        rationale=(
            "426936004 Smoke inhalation injury (disorder) is the more clinically representative anchor for 'Noxious inhalation' than 425082000 Inhalation burn due to hot gas (disorder). Smoke inhalation encompasses toxic gas and particulate inhalation from fire and combustion — the dominant ED presentation. Only 2 candidates; chose the broader context. Rejected 425082000 Inhalation burn due to hot gas — specifically thermal, not toxic/chemical inhalation."
        ),
    ),
    AnchorMapping(
        ctas_alias="Electrical injury",
        anchor_concept_id="371708003",
        fsn="Injury caused by electrical exposure (disorder)",
        rationale=(
            "371708003 Injury caused by electrical exposure (disorder) is the broadest candidate covering all electrical injuries. IS-A descendants include 725920004 Electric shock caused by lightning, 269431000 Non-fatal electric shock, 230624005 Electric shock injury of peripheral nerve, 242027005 Paralysis following electric shock. Rejected 725920004 Electric shock caused by lightning — meteorological subtype only. Rejected 269431000 Non-fatal electric shock — excludes fatal, too restrictive."
        ),
    ),
    AnchorMapping(
        ctas_alias="Chemical exposure",
        anchor_concept_id="371704001",
        fsn="Injury due to chemical exposure (disorder)",
        rationale=(
            "371704001 Injury due to chemical exposure (disorder) is the only etiology-neutral broad parent in the pool. All chemical burn subtypes (426284001 Chemical burn, 438786003 Chemical burn of hand, etc.) are IS-A children covering specific anatomical presentations. Rejected 426284001 Chemical burn — burn mechanism only, excludes non-burn toxic chemical injury (e.g., absorbed toxin without burn). Rejected anatomy-specific burns as all are narrower."
        ),
    ),
    AnchorMapping(
        ctas_alias="Hypothermia",
        anchor_concept_id="386689009",
        fsn="Hypothermia (finding)",
        rationale=(
            "386689009 Hypothermia (finding) is the canonical etiology-neutral parent for 'Hypothermia'. IS-A descendants include 212916004 Hypothermia - accidental, 83966006 Hypothermia caused by cold environment, 241968001 Immersion hypothermia, 241969009 Accidental hypothermia in elderly person. Rejected 398052002 Induced hypothermia — therapeutic context, opposite of emergency presentation. Rejected 13629008 Neonatal hypothermia — paediatric-specific. Rejected 123461000119109 Hypothermia not associated with low environmental temperature — specifies environment, too narrow."
        ),
    ),
    AnchorMapping(
        ctas_alias="Near Drowning",
        anchor_concept_id="87970004",
        fsn="Nonfatal submersion (disorder)",
        rationale=(
            "87970004 Nonfatal submersion (disorder) is the most clinically faithful anchor for 'Near Drowning'. The CTAS alias explicitly describes a nonfatal event. IS-A context covers all near-drowning presentations. Rejected 72854003 Aspiration pneumonia due to near drowning — this is a complication/outcome, not the presenting event; it is also too specific. Rejected 1306602006 Aspiration pneumonitis due to near drowning — similarly a consequence, not the presenting mechanism."
        ),
    ),
    AnchorMapping(
        ctas_alias="Abdominal pain",
        anchor_concept_id="21522001",
        fsn="Abdominal pain (finding)",
        rationale=(
            "[controller-corrected after holistic review] Original pick was 83132003 'Upper abdominal pain (finding)'. Holistic review (opus) independently verified via search_snomed.py that picked a child of the exact-match parent. Corrected to 21522001 'Abdominal pain (finding)'."
        ),
    ),
    AnchorMapping(
        ctas_alias="Anorexia",
        anchor_concept_id="79890006",
        fsn="Loss of appetite (finding)",
        rationale=(
            "79890006 Loss of appetite (finding) is the etiology-neutral parent for 'Anorexia'. The CTAS complaint is the symptom of loss of appetite, not necessarily the psychiatric eating disorder. All anorexia nervosa variants (56882008, 77675002, etc.) are IS-A descendants of Anorexia nervosa, which is itself a descendant of Loss of appetite. Rejected 56882008 Anorexia nervosa (disorder) — psychiatric disorder subtype, too narrow for the general triage complaint. Rejected 405788002 Psychogenic loss of appetite — presupposes psychiatric etiology."
        ),
    ),
    AnchorMapping(
        ctas_alias="Constipation",
        anchor_concept_id="14760008",
        fsn="Constipation (finding)",
        rationale=(
            "14760008 Constipation (finding) is the canonical etiology-neutral parent for the CTAS complaint. IS-A descendants include 197118003 Functional constipation, 191973007 Psychogenic constipation, 236069009 Chronic constipation, 129585003 Perceived constipation. Rejected each subtype as narrower than the complaint. Rejected 236069009 Chronic constipation — timeframe-specific. Rejected 129585003 Perceived constipation — subjective qualifier."
        ),
    ),
    AnchorMapping(
        ctas_alias="Diarrhea",
        anchor_concept_id="62315008",
        fsn="Diarrhea (finding)",
        rationale=(
            "62315008 Diarrhea (finding) is the canonical etiology-neutral parent concept. IS-A descendants include non-infective, infective, dietetic, inflammatory, epidemic diarrhea. Rejected all subtypes as narrower. No broader 'disorder of bowel habit' exists in the candidates."
        ),
    ),
    AnchorMapping(
        ctas_alias="Foreign body in rectum",
        anchor_concept_id="70176004",
        fsn="Foreign body in rectum (disorder)",
        rationale=(
            "[auto-resolved, AUTO_SINGLE] Foreign body in rectum (disorder) (70176004) was the sole SNOMED Clinical Finding concept matching 'Foreign body in rectum' and its aliases via keyword search (FSN + synonym descriptions, word-boundary matched). No other candidates existed to reject."
        ),
    ),
    AnchorMapping(
        ctas_alias="Groin pain / mass",
        anchor_concept_id="102570003",
        fsn="Inguinal pain (finding)",
        rationale=(
            "102570003 Inguinal pain (finding) is the best match for 'Groin pain / mass'. Of the three candidates (281398003 Groin mass, 102570003 Inguinal pain, 274743004 Swelling of inguinal region), inguinal pain captures the primary symptom (pain) while inguinal anatomy matches 'groin'. Considered 281398003 Groin mass (finding) — captures the mass pole but excludes the pain-only presentation which is more common. Rejected 274743004 Swelling of inguinal region — swelling without pain specification is less precise for the combined alias."
        ),
    ),
    AnchorMapping(
        ctas_alias="Vomiting and/or nausea",
        anchor_concept_id="16932000",
        fsn="Nausea and vomiting (disorder)",
        rationale=(
            "[controller-corrected after holistic review] Original pick was 2919008 'Nausea, vomiting and diarrhea (disorder)'. Holistic review (opus) independently verified via search_snomed.py that original pick wrongly dragged in diarrhea (separately complaint 254). Corrected to 16932000 'Nausea and vomiting (disorder)'."
        ),
    ),
    AnchorMapping(
        ctas_alias="Rectal / Perineal pain",
        anchor_concept_id="68653001",
        fsn="Anal pain (finding)",
        rationale=(
            "68653001 Anal pain (finding) is the preferred anchor for 'Rectal / Perineal pain' as anal/rectal pain is the most common triage driver. Considered 77880009 Rectal pain (finding) — captures the rectal pole. Considered 225565007 Perineal pain (finding) — captures the perineal pole. Chose 68653001 Anal pain as it sits highest in clinical frequency for this complaint code. Rejected 414991007 Painful rectal bleeding and 414992000 Painless rectal bleeding — these add a bleeding qualifier not universally present."
        ),
    ),
    AnchorMapping(
        ctas_alias="Vomiting blood",
        anchor_concept_id="8765009",
        fsn="Hematemesis (disorder)",
        rationale=(
            "8765009 Hematemesis (disorder) is the canonical parent for 'Vomiting blood'. All hematemesis subtypes in the pool (perinatal, neonatal, fresh blood, unknown cause) are IS-A descendants. Rejected 267051003 Vomiting blood - fresh — anatomical qualifier, narrower. Rejected 308904008 Hematemesis of unknown cause — etiology modifier, narrower. Rejected perinatal/neonatal subtypes — age-specific."
        ),
    ),
    AnchorMapping(
        ctas_alias="Blood in stool / Melena",
        anchor_concept_id="2901004",
        fsn="Melena (disorder)",
        rationale=(
            "2901004 Melena (disorder) is the canonical parent for 'Blood in stool / Melena'. IS-A descendants include 414663001 Melena due to GI hemorrhage, neonatal variants, and rectal bleeding findings. Considered also 414991007 Painful and 414992000 Painless rectal bleeding for the 'Blood in stool' pole, but Melena (disorder) is broader and anatomically correct for the primary complaint. Rejected perinatal subtypes as age-specific."
        ),
    ),
    AnchorMapping(
        ctas_alias="Jaundice",
        anchor_concept_id="18165001",
        fsn="Jaundice (finding)",
        rationale=(
            "[auto-resolved, AUTO_SIMILARITY] Jaundice (finding) (18165001) had a clearly dominant textual-similarity match against 'Jaundice' among 791 matched candidates (no IS_A hierarchy relationship among them). Rejected as less textually specific to this complaint: Hemolytic jaundice (disorder) (60217008); Hepatocellular jaundice (disorder) (66789005); Impairment level of both eyes (disorder) (68777001); Neonatal jaundice due to delayed conjugation from delayed development of conjugating system (finding) (69347004); Immature eyes (disorder) (371110006); Postoperative jaundice (disorder) (371117009) (+784 more)."
        ),
    ),
    AnchorMapping(
        ctas_alias="Hiccoughs",
        anchor_concept_id="65958008",
        fsn="Hiccoughs (finding)",
        rationale=(
            "[auto-resolved, AUTO_HIERARCHY] Hiccoughs (finding) (65958008) is a common IS_A ancestor of every other matched candidate for 'Hiccoughs', chosen per the plan's broader-parent rule (bounded descendant traversal from it covers the rejected variants without a separate anchor per variant). Rejected as redundant descendants: Chronic hiccup (disorder) (716771000); Recurrent hiccup (finding) (1119237008)."
        ),
    ),
    AnchorMapping(
        ctas_alias="Abdominal mass / distention",
        anchor_concept_id="271860004",
        fsn="Abdominal mass (finding)",
        rationale=(
            "271860004 Abdominal mass (finding) is the canonical parent for 'Abdominal mass / distention'. IS-A descendants include 404200001 Central abdominal mass, 307134002 Iliac fossa abdominal mass, 300404004 Visible abdominal mass. Abdominal distension (not present as a separate exact candidate) is often associated but not required. Rejected etiology-specific abdominal masses as all are narrower."
        ),
    ),
    AnchorMapping(
        ctas_alias="Anal / Rectal trauma",
        anchor_concept_id="285807003",
        fsn="Injury of anal canal (disorder)",
        rationale=(
            "285807003 Injury of anal canal (disorder) is the most clinically precise available concept for 'Anal / Rectal trauma'. Only 2 relevant candidates in the 162-entry pool. Rejected 16950007 Fourth degree perineal laceration involving anal mucosa — this is a specific obstetric laceration subtype, not a general trauma anchor. 285807003 Injury of anal canal covers blunt and penetrating anal trauma broadly."
        ),
    ),
    AnchorMapping(
        ctas_alias="Oral / Esophageal Foreign Body",
        anchor_concept_id="47609003",
        fsn="Foreign body in esophagus (disorder)",
        rationale=(
            "[controller-corrected after fix-round-2 re-review] Original pick was 14380007 'Foreign body in mouth (disorder)' (Foreign body in mouth (disorder) only), on a false 'no esophageal foreign body concept exists' claim -- 47609003 Foreign body in esophagus (disorder) exists in Clinical Finding scope. No single SNOMED concept covers both mouth and esophageal foreign bodies (verified: 33334006 Foreign body in digestive tract is an ancestor of esophagus but NOT of mouth -- oral cavity isn't modeled under 'digestive tract' in SNOMED). Chose esophageal over mouth because it's the higher-acuity variant (impaction/airway risk) and the complaint's own red flags (Hoarseness and dysphagia, Moderate respiratory distress, Shock) are esophageal/airway-pattern signs, not mouth-pattern. Known limitation, documented not hidden: simple oral foreign bodies won't traverse-match this anchor."
        ),
    ),
    AnchorMapping(
        ctas_alias="Flank pain",
        anchor_concept_id="247355005",
        fsn="Pain in flank (finding)",
        rationale=(
            "247355005 Pain in flank (finding) is the etiology-neutral parent for 'Flank pain'. IS-A descendants include 162049009 Pain in left flank, 162050009 Pain in right flank, 517384241000119102 Pain in bilateral flanks. Rejected lateralized variants as all are narrower. This parent concept is appropriate for an IS-A traversal covering renal colic, pyelonephritis, musculoskeletal flank pain without presupposing etiology."
        ),
    ),
    AnchorMapping(
        ctas_alias="Hematuria",
        anchor_concept_id="53298000",
        fsn="Hematuria syndrome (disorder)",
        rationale=(
            "53298000 Hematuria syndrome (disorder) is the broadest candidate that names the clinical syndrome of hematuria as a presenting complaint. Considered 371020003 Renal hematuria — anatomically specific. Considered 95567008 Traumatic hematuria — etiology-specific. Considered 86208007 Loin pain-hematuria syndrome — too specific (requires loin pain). 53298000 Hematuria syndrome captures the general presentation. Rejected all etiology- or anatomy-qualified subtypes."
        ),
    ),
    AnchorMapping(
        ctas_alias="Genital discharge / lesion",
        anchor_concept_id="724386005",
        fsn="Lesion of genitalia (disorder)",
        rationale=(
            "724386005 Lesion of genitalia (finding) is the broadest etiology-neutral candidate available for 'Genital discharge / lesion'. No 'genital discharge (finding)' exists as a standalone in the pool. The lesion concept covers STI lesions, ulcers, warts, and other genital pathology. Rejected 193440001 Testicular lesion of adrenogenital syndrome — too specific (adrenogenital etiology). Rejected 240608007 Donovanosis non-genital lesion — actually non-genital by definition."
        ),
    ),
    AnchorMapping(
        ctas_alias="Penile swelling",
        anchor_concept_id="335977000",
        fsn="Penile swelling (disorder)",
        rationale=(
            "[auto-resolved, AUTO_SINGLE] Penile swelling (disorder) (335977000) was the sole SNOMED Clinical Finding concept matching 'Penile swelling' and its aliases via keyword search (FSN + synonym descriptions, word-boundary matched). No other candidates existed to reject."
        ),
    ),
    AnchorMapping(
        ctas_alias="Scrotal pain and/or swelling",
        anchor_concept_id="20502007",
        fsn="Pain in scrotum (finding)",
        rationale=(
            "Searched 'scrotal pain' → 20502007 Pain in scrotum (finding) confirmed. Searched 'scrotal swelling' (0 hits), then 'swelling of scrotum' → 271687003 Swelling of scrotum (finding). The CTAS alias is pain AND/OR swelling; the pain component is the primary acuity driver (testicular torsion, epididymo-orchitis). Chose 20502007 Pain in scrotum (finding) as anchor. Also confirmed 81996005 Torsion of testis (syn: Testicular torsion) as a key descendant. Rejected 271687003 Swelling of scrotum — swelling alone less urgent; pain is the triage discriminator. Rejected 53929009 Scrotal mass — chronic/non-acute context."
        ),
    ),
    AnchorMapping(
        ctas_alias="Urinary retention",
        anchor_concept_id="267064002",
        fsn="Retention of urine (disorder)",
        rationale=(
            "267064002 Retention of urine (disorder) is the canonical etiology-neutral parent for 'Urinary retention'. IS-A descendants include 236648008 Acute retention of urine, 430976005 Retention due to Foley catheter occlusion, 12245681000119103 Postprocedural urinary retention, 782390002 Painless urinary retention due to cauda equina syndrome. Rejected acute retention only — excludes chronic retention. Rejected procedure-specific subtypes."
        ),
    ),
    AnchorMapping(
        ctas_alias="UTI complaints",
        anchor_concept_id="68566005",
        fsn="Urinary tract infectious disease (disorder)",
        rationale=(
            "68566005 Urinary tract infectious disease (disorder) is the canonical parent for 'UTI complaints'. IS-A descendants include all specific UTI presentations: cystitis, pyelonephritis, urethritis, UTI in pregnancy (307534009), neonatal UTI (12301009). Rejected 44741000087100 Lower urinary tract infection-like symptoms — a symptom-pattern finding, not the disorder parent. Rejected pregnancy-specific and neonatal subtypes as narrower."
        ),
    ),
    AnchorMapping(
        ctas_alias="Oliguria",
        anchor_concept_id="83128009",
        fsn="Oliguria (finding)",
        rationale=(
            "[auto-resolved, AUTO_SIMILARITY] Oliguria (finding) (83128009) had a clearly dominant textual-similarity match against 'Oliguria' among 9 matched candidates (no IS_A hierarchy relationship among them). Rejected as less textually specific to this complaint: Miscarriage with oliguria (disorder) (72613009); Acute renal failure with oliguria (disorder) (430535006); Induced termination of pregnancy complicated by oliguria (disorder) (609512008); Induced termination of pregnancy complicated by acute renal failure with oliguria (disorder) (609472002); Failed attempted abortion with oliguria (disorder) (21334005); Oliguria following procedure (disorder) (12202501000119106) (+2 more)."
        ),
    ),
    AnchorMapping(
        ctas_alias="Polyuria",
        anchor_concept_id="28442001",
        fsn="Polyuria (finding)",
        rationale=(
            "[auto-resolved, AUTO_SIMILARITY] Polyuria (finding) (28442001) had a clearly dominant textual-similarity match against 'Polyuria' among 10 matched candidates (no IS_A hierarchy relationship among them). Rejected as less textually specific to this complaint: Micturition frequency and polyuria (finding) (274734008); Nocturnal polyuria (finding) (343121331000119105); Arginine vasopressin-related polyuria (disorder) (1296758008); Familial arginine vasopressin-related polyuria (disorder) (42021008); Idiopathic arginine vasopressin-related polyuria (disorder) (77274005); Partial arginine vasopressin-related polyuria (disorder) (68061000119109) (+3 more)."
        ),
    ),
    AnchorMapping(
        ctas_alias="Genital trauma",
        anchor_concept_id="282772005",
        fsn="Genital injury (disorder)",
        rationale=(
            "[auto-resolved, AUTO_SINGLE] Genital injury (disorder) (282772005) was the sole SNOMED Clinical Finding concept matching 'Genital trauma' and its aliases via keyword search (FSN + synonym descriptions, word-boundary matched). No other candidates existed to reject."
        ),
    ),
    AnchorMapping(
        ctas_alias="Depression / Suicidal / Deliberate self harm",
        anchor_concept_id="35489007",
        fsn="Depressive disorder (disorder)",
        rationale=(
            "35489007 Depressive disorder (disorder) is the broadest disorder parent for 'Depression / Suicidal / Deliberate self harm'. IS-A descendants include 370143000 Major depressive disorder, recurrent major depression subtypes, and depression in remission variants. The suicidal ideation pole is captured by 6471006 Suicidal thoughts (finding) as a related concept. Rejected 370143000 Major depressive disorder — excludes minor/dysthymia depression variants. Rejected suicidal-only concepts as they don't cover the depression pole."
        ),
    ),
    AnchorMapping(
        ctas_alias="Anxiety / Situational crisis",
        anchor_concept_id="197480006",
        fsn="Anxiety disorder (disorder)",
        rationale=(
            "197480006 Anxiety disorder (disorder) is the canonical parent for 'Anxiety / Situational crisis'. IS-A descendants include all anxiety disorder subtypes — GAD, panic disorder, phobia, substance-induced anxiety disorders, and anxiety finding 48694002. The situational crisis pole is best approximated by acute adjustment disorder descendants. Rejected 48694002 Anxiety (finding) — symptom finding, not the disorder parent; the graph traversal would miss disorder-level subtypes. Rejected substance-induced subtypes as narrower."
        ),
    ),
    AnchorMapping(
        ctas_alias="Hallucinations / Delusions",
        anchor_concept_id="7011001",
        fsn="Hallucinations (finding)",
        rationale=(
            "7011001 Hallucinations (finding) is the canonical broad parent for 'Hallucinations / Delusions'. IS-A descendants cover visual, auditory, olfactory, tactile, and multimodal hallucination subtypes. Considered also a delusional disorder concept — no 'Delusion (finding)' or 'Delusional disorder (disorder)' parent without qualifiers exists in the 136-candidate pool at the same level. 7011001 Hallucinations is the better anchor as it has the more extensive descendant tree. Rejected specific sensory hallucination subtypes (music, pain, temperature) as all are narrower."
        ),
    ),
    AnchorMapping(
        ctas_alias="Insomnia",
        anchor_concept_id="193462001",
        fsn="Insomnia (disorder)",
        rationale=(
            "193462001 Insomnia (disorder) is the canonical parent for 'Insomnia'. IS-A descendants include 3972004 Primary insomnia, 88982005 Rebound insomnia, 67233009 Middle insomnia, 162204000 Late insomnia. Rejected each subtype as narrower. Rejected 88982005 Rebound insomnia — medication-related, too specific."
        ),
    ),
    AnchorMapping(
        ctas_alias="Violent / Homicidal behaviour",
        anchor_concept_id="424241004",
        fsn="Homicidal behavior (finding)",
        rationale=(
            "[auto-resolved, AUTO_SIMILARITY] Homicidal behavior (finding) (424241004) had a clearly dominant textual-similarity match against 'Violent / Homicidal behaviour' among 9 matched candidates (no IS_A hierarchy relationship among them). Rejected as less textually specific to this complaint: Violent retching (finding) (9814003); Violent acts towards others (finding) (401237008); Violent spouse (finding) (160802003); Victim of violent environment (finding) (422722002); Homicidal thoughts (finding) (225450009); Violent motor activity (finding) (247916003) (+2 more)."
        ),
    ),
    AnchorMapping(
        ctas_alias="Social problem",
        anchor_concept_id="56098000",
        fsn="Social problem not due to a mental disorder (finding)",
        rationale=(
            "56098000 Social problem not due to a mental disorder (finding) is the only candidate approximating 'Social problem'. The pool contains only one relevant concept. This is the best available anchor — it is a SNOMED clinical finding context used in social determinants of health documentation. No broader 'social problem (finding)' exists in the candidate pool."
        ),
    ),
    AnchorMapping(
        ctas_alias="Bizarre behaviour",
        anchor_concept_id="248020004",
        fsn="Bizarre behavior (finding)",
        rationale=(
            "[auto-resolved, AUTO_SIMILARITY] Bizarre behavior (finding) (248020004) had a clearly dominant textual-similarity match against 'Bizarre behaviour' among 2 matched candidates (no IS_A hierarchy relationship among them). Rejected as less textually specific to this complaint: Abnormal behavior (finding) (25786006)."
        ),
    ),
    AnchorMapping(
        ctas_alias="Altered level of consciousness",
        anchor_concept_id="40917007",
        fsn="Clouded consciousness (finding)",
        rationale=(
            "[auto-resolved, AUTO_SIMILARITY] Clouded consciousness (finding) (40917007) had a clearly dominant textual-similarity match against 'Altered level of consciousness' among 4 matched candidates (no IS_A hierarchy relationship among them). Rejected as less textually specific to this complaint: Disorientated (finding) (62476001); Drowsy (finding) (271782001); Not confused (finding) (225439006)."
        ),
    ),
    AnchorMapping(
        ctas_alias="Confusion",
        anchor_concept_id="130987000",
        fsn="Acute confusion (finding)",
        rationale=(
            "130987000 Acute confusion (finding) is the most clinically relevant anchor for 'Confusion'. Acute confusion is the dominant ED presentation — delirium, toxic-metabolic states. IS-A descendants include postoperative and post-seizure confusion. Considered 130988005 Chronic confusion — this is the chronic presentation (dementia baseline), less appropriate for an ED triage anchor. Rejected 404906000 Postoperative confusion — etiology-specific. Rejected 44031002 Postseizure confusion — etiology-specific."
        ),
    ),
    AnchorMapping(
        ctas_alias="Vertigo",
        anchor_concept_id="399153001",
        fsn="Vertigo (finding)",
        rationale=(
            "399153001 Vertigo (finding) is the canonical etiology-neutral parent for 'Vertigo'. IS-A descendants include peripheral vertigo (50438001), cervical vertigo (84769001), epileptic vertigo (68761002), cortical vertigo (69017006), ocular vertigo (78977005). Rejected 404640003 Dizziness (finding) — semantically distinct from true vertigo; the CTAS code 403 specifically names Vertigo not general dizziness. All vertigo subtypes are IS-A descendants of Vertigo (finding)."
        ),
    ),
    AnchorMapping(
        ctas_alias="Headache",
        anchor_concept_id="25064002",
        fsn="Headache (finding)",
        rationale=(
            "25064002 Headache (finding) is the canonical etiology-neutral parent for 'Headache'. All headache subtypes in the pool (ocular, occipital, postpartum, muscular, tension, migraine equivalents) are IS-A descendants. Rejected all qualitative or etiology-specific subtypes as narrower."
        ),
    ),
    AnchorMapping(
        ctas_alias="Seizure",
        anchor_concept_id="91175000",
        fsn="Seizure (finding)",
        rationale=(
            "91175000 Seizure (finding) is the canonical etiology-neutral parent for 'Seizure'. IS-A descendants include focal onset seizure (29753000), convulsive variants, and seizure disorder contexts. Considered 128613002 Seizure disorder (disorder) — disorder vs. finding distinction; Seizure (finding) is preferred as an anchor for a symptom-based triage complaint where etiology is unknown at presentation. Rejected 370994008 Seizure free — negative finding, inappropriate. Rejected 313287004 Seizure related finding — too vague."
        ),
    ),
    AnchorMapping(
        ctas_alias="Gait disturbance / Ataxia",
        anchor_concept_id="20262006",
        fsn="Ataxia (finding)",
        rationale=(
            "[controller-corrected after holistic review] Original pick was 85102008 'Cerebellar ataxia (disorder)'. Holistic review (opus) independently verified via search_snomed.py that broad parent exists, rationale falsely claimed absence. Corrected to 20262006 'Ataxia (finding)'."
        ),
    ),
    AnchorMapping(
        ctas_alias="Head injury",
        anchor_concept_id="82271004",
        fsn="Injury of head (disorder)",
        rationale=(
            "82271004 Injury of head (disorder) is the canonical broad parent for 'Head injury'. IS-A descendants include 451000119106 Closed injury of head, 95848000 Injury of head with otorrhagia, 127276009 Injury with rhinorrhagia, 95861000 Vertigo preceded by head injury, and all concussion subtypes (62564004, 73413009 etc.). Rejected concussion subtypes — all are narrower by definition. Rejected anatomy/mechanism-qualified variants as narrower."
        ),
    ),
    AnchorMapping(
        ctas_alias="Tremor",
        anchor_concept_id="26079004",
        fsn="Tremor (finding)",
        rationale=(
            "26079004 Tremor (finding) is the canonical etiology-neutral parent for 'Tremor'. IS-A descendants include 78261002 Coarse tremor, 66880003 Tremor opiophagorum (opioid-related), 70765006 Mercurial tremor, 74178009 Metallic tremor, 8972001 Post-hemiplegic tremor, 65864002 Organic voice tremor. Only one exact broad match exists. Rejected all subtypes as narrower."
        ),
    ),
    AnchorMapping(
        ctas_alias="Extremity weakness / Symptoms of CVA",
        anchor_concept_id="44731000087106",
        fsn="Cerebrovascular accident-like symptoms (finding)",
        rationale=(
            "Searched 'extremity weakness' and 'weakness of extremity' (0 hits CF). Searched 'stroke symptoms' (0 hits). Searched 'cerebrovascular accident' → confirmed 44731000087106 Cerebrovascular accident-like symptoms (finding) — this is the exact SNOMED concept for the acute stroke-symptoms presentation before diagnosis is confirmed. Also confirmed 266257000 Transient ischemic attack (disorder) and 230690007 Cerebrovascular accident (disorder) as key related concepts. Chose 44731000087106 as anchor because the CTAS alias explicitly captures the pre-diagnostic presentation ('Symptoms of CVA'), not confirmed stroke. All stroke/CVA subtypes are reachable as related concepts. Rejected 230690007 CVA — presupposes confirmed diagnosis."
        ),
    ),
    AnchorMapping(
        ctas_alias="Sensory loss / Paresthesias",
        anchor_concept_id="62507009",
        fsn="Pins and needles (finding)",
        rationale=(
            "62507009 Pins and needles (finding) is the most patient-identifiable and clinically representative anchor for 'Sensory loss / Paresthesias'. Paresthesia (pins and needles) is the most common presentation driving this CTAS code. Considered 102603008 Numbness of skin — covers the sensory loss pole. Considered 87275002 Dissociated sensory loss — specific neurological pattern. No broad 'Paresthesia (finding)' parent exists in the pool without body-site qualifiers. Chose 62507009 Pins and needles as anchor; numbness variants captured as related concepts. Rejected body-site specific numbness concepts as narrower."
        ),
    ),
    AnchorMapping(
        ctas_alias="Menstrual problems",
        anchor_concept_id="386804004",
        fsn="Disorder of menstruation (disorder)",
        rationale=(
            "[controller-corrected after holistic review] Original pick was 386692008 'Menorrhagia (finding)'. original pick (Menorrhagia) only covered heavy-flow volume, not the complaint's other aliases ('irregular periods'); 386804004 (synonym 'Menstrual disorder') is the genuine broad umbrella covering both, matching the plan's broader-parent preference. Corrected to 386804004 'Disorder of menstruation (disorder)'. Known limitation (documented, not fixed -- inherent SNOMED modeling, not a pipeline error): 386692008 Menorrhagia, the most common menstrual ED presentation, is NOT a descendant of this anchor (it sits under 276319003 Finding of menstrual bleeding instead). The nearest common ancestor of Menorrhagia and Dysmenorrhea is 248842004 Female genitalia finding, far too broad to use. 386804004 remains the right anchor despite this traversal gap."
        ),
    ),
    AnchorMapping(
        ctas_alias="Foreign body, vagina",
        anchor_concept_id="34124000",
        fsn="Foreign body in vagina (disorder)",
        rationale=(
            "34124000 Foreign body in vagina (disorder) is the canonical etiology-neutral parent for 'Foreign body, vagina'. IS-A descendants include 874828003 Foreign body in mucosa of vagina, 876813000 Foreign body in mucosa of vagina with infection, 211652000 Foreign body in vulva and vagina. Rejected 211652000 Foreign body in vulva and vagina — vulva specification adds anatomical scope not implied by the CTAS code. Rejected infected variant — consequence qualifier. Rejected mucosa-specific variant — anatomically narrower."
        ),
    ),
    AnchorMapping(
        ctas_alias="Vaginal discharge",
        anchor_concept_id="271939006",
        fsn="Vaginal discharge (finding)",
        rationale=(
            "[auto-resolved, AUTO_HIERARCHY] Vaginal discharge (finding) (271939006) is a common IS_A ancestor of every other matched candidate for 'Vaginal discharge', chosen per the plan's broader-parent rule (bounded descendant traversal from it covers the rejected variants without a separate anchor per variant). Rejected as redundant descendants: Finding of color of vaginal discharge (finding) (289551009); Finding of odor of vaginal discharge (finding) (366296005); Finding of consistency of vaginal discharge (finding) (289545004); Finding of quantity of vaginal discharge (finding) (289557008); Odorless vaginal discharge (finding) (289563004); Vaginal discharge symptom (finding) (162156001) (+17 more)."
        ),
    ),
    AnchorMapping(
        ctas_alias="Sexual assault",
        anchor_concept_id="1384209006",
        fsn="Victim of sexual assault (finding)",
        rationale=(
            "1384209006 Victim of sexual assault (finding) is the canonical etiology-neutral parent for 'Sexual assault'. IS-A descendants include 713821003 Victim of sexual assault by member of household, 713820002 Victim of sexual assault by intimate partner. Rejected 1144537004 Good recovery from sexual assault — this is an outcome/resolution finding, not the acute presenting complaint. Rejected perpetrator-specific variants as narrower."
        ),
    ),
    AnchorMapping(
        ctas_alias="Vaginal bleed",
        anchor_concept_id="289530006",
        fsn="Bleeding from vagina (finding)",
        rationale=(
            "Searched 'vaginal bleeding' → 12 hits. Searched 'bleeding from vagina' → confirmed 289530006 Bleeding from vagina (finding) as the etiology-neutral parent. IS-A descendants include 289538004 Scanty vaginal bleeding, 289540009 Profuse vaginal bleeding, 301822002 Abnormal vaginal bleeding, 723665008 Vaginal bleeding complicating early pregnancy. Rejected 301822002 Abnormal vaginal bleeding — qualifier 'abnormal' presupposes it's not menstruation; CTAS alias is etiology-neutral. Rejected 399131003 Non-menstrual vaginal bleeding — etiology-specific. 289530006 Bleeding from vagina (finding) is the broadest etiology-neutral parent."
        ),
    ),
    AnchorMapping(
        ctas_alias="Labial swelling",
        anchor_concept_id="289475007",
        fsn="Swelling of vulva (finding)",
        rationale=(
            "[controller-corrected after fix-round-2 re-review] Original pick was 289476008 'Swelling of labia (finding)'. original pick (289476008 Swelling of labia) is a descendant of 289475007 Swelling of vulva, which was never named/considered in the original rationale. Corrected to 289475007 'Swelling of vulva (finding)'."
        ),
    ),
    AnchorMapping(
        ctas_alias="Pregnancy issues < 20 wks",
        anchor_concept_id="54048003",
        fsn="Threatened abortion (disorder)",
        rationale=(
            "Searched 'threatened abortion' → 54048003 Threatened abortion (disorder) confirmed as the canonical SNOMED anchor for first-trimester pregnancy complications presenting to ED. In CTAS context, 'Pregnancy issues < 20 wks' covers threatened abortion, miscarriage, ectopic pregnancy, hyperemesis gravidarum. Threatened abortion is the broadest and most frequent driver. Searched 'complication of pregnancy' → 198609003 Complication of pregnancy, childbirth and/or puerperium is broader but includes puerperium. 54048003 Threatened abortion is clinically more specific to <20 week presentations. Also confirmed 73790007 Threatened abortion in first trimester as a narrower IS-A descendant. Rejected 198609003 — puerperium and >20 wk complications included, too broad. Rejected trimester-specific subtypes as narrower."
        ),
    ),
    AnchorMapping(
        ctas_alias="Pregnancy issues > 20 wks",
        anchor_concept_id="362972006",
        fsn="Disorder of labor / delivery (disorder)",
        rationale=(
            "362972006 Disorder of labor / delivery (disorder) is the most clinically appropriate broad anchor for 'Pregnancy issues > 20 wks'. The pool is dominated by labor-stage findings (289210008 Finding of first stage of labor, etc.); no 'Pregnancy complication > 20 weeks' concept exists. Disorder of labor/delivery captures complications of the delivery process relevant to the >=20 week gestational context. Rejected all individual labor-stage findings (289210008, 289216002, etc.) as they are IS-A children of this concept. Rejected 249020006 Cervical observation during pregnancy and labor — observational finding, not a disorder/complaint."
        ),
    ),
    AnchorMapping(
        ctas_alias="Vaginal pain / itch",
        anchor_concept_id="38343000",
        fsn="Vaginal pain (finding)",
        rationale=(
            "38343000 Vaginal pain (finding) is the best anchor for 'Vaginal pain / itch'. Vaginal pain is the more clinically urgent and actionable of the two complaint elements. 418290006 Itching (finding) is too broad (body-unspecific itch). 426628005 Chronic vaginal pain — timeframe-specific. Rejected 90446007 Pruritus ani — anal location, wrong anatomy. Rejected 399329002 Tinea barbae — beard ringworm, irrelevant. Rejected infestations and dermatoses — aetiology-specific. Anchor: Vaginal pain covers the primary complaint."
        ),
    ),
    AnchorMapping(
        ctas_alias="Chemical exposure, eye",
        anchor_concept_id="274205003",
        fsn="Burn of eye region (disorder)",
        rationale=(
            "[controller-corrected after holistic review] Original pick was 12114081000119101 'Chemical burn of left eye (disorder)'. Holistic review (opus) independently verified via search_snomed.py that non-lateralized parent exists; laterality was picked arbitrarily 'by convention'. Corrected to 274205003 'Burn of eye region (disorder)'."
        ),
    ),
    AnchorMapping(
        ctas_alias="Foreign body, eye",
        anchor_concept_id="787018009",
        fsn="Foreign body of eye region (disorder)",
        rationale=(
            "[controller-corrected after fix-round-2 re-review] Original pick was 55899000 'Foreign body on external eye (disorder)'. original pick (55899000 Foreign body on external eye) is a descendant of 787018009, which was never named/considered in the original rationale; also brings this complaint in line with 502 and 510's this-round repointing to eye-region-level concepts. Corrected to 787018009 'Foreign body of eye region (disorder)'."
        ),
    ),
    AnchorMapping(
        ctas_alias="Visual disturbance",
        anchor_concept_id="63102001",
        fsn="Visual disturbance (disorder)",
        rationale=(
            "63102001 Visual disturbance (disorder) is the canonical broad parent for 'Visual disturbance'. IS-A descendants include 70042006 Psychophysical visual disturbance, 78455002 Subjective visual disturbance, 162279009 Temporary visual disturbance, 421376003 Subjective visual disturbance of image size, 87551000119101 Visual disturbance as sequela of CVD, 111516008 Blurring of visual image. Rejected 70042006 Psychophysical visual disturbance — etiology-specific (psychophysical). Rejected 78455002 Subjective visual disturbance — qualifier-specific. Rejected 38950008 Central scotoma — specific anatomical type. Rejected 735545002 Dissociative neurological symptom disorder with visual symptom — psychiatric disorder frame, too narrow. Visual disturbance (disorder) is the clean broad parent."
        ),
    ),
    AnchorMapping(
        ctas_alias="Eye pain",
        anchor_concept_id="41652007",
        fsn="Pain in eye (finding)",
        rationale=(
            "41652007 Pain in eye (finding) is the canonical parent for 'Eye pain'. IS-A descendants include lateralized variants 16442141000119109 Periorbital pain of left eye, 16442181000119104 Periorbital pain of right eye. Only 3 candidates in pool. Rejected periorbital lateralized variants as all are narrower."
        ),
    ),
    AnchorMapping(
        ctas_alias="Red Eye, discharge",
        anchor_concept_id="9826008",
        fsn="Conjunctivitis (disorder)",
        rationale=(
            "9826008 Conjunctivitis (disorder) is the canonical parent for 'Red Eye, discharge'. Conjunctivitis is both the primary cause of red eye with discharge and the SNOMED parent from which all specific forms descend. IS-A descendants include viral, bacterial, allergic, chemical, and other conjunctivitis. Rejected all specific conjunctivitis subtypes in the pool (Morax angular, atopic, catarrhal, phlyctenular, pseudomembranous, chronic, exudative, others) — all narrower. Rejected lateralized variants 12236161000119108 and 12236201000119103 as narrower."
        ),
    ),
    AnchorMapping(
        ctas_alias="Photophobia",
        anchor_concept_id="409668002",
        fsn="Photophobia (finding)",
        rationale=(
            "[auto-resolved, AUTO_SIMILARITY] Photophobia (finding) (409668002) had a clearly dominant textual-similarity match against 'Photophobia' among 2 matched candidates (no IS_A hierarchy relationship among them). Rejected as less textually specific to this complaint: Ichthyosis follicularis with alopecia and photophobia (disorder) (403782004)."
        ),
    ),
    AnchorMapping(
        ctas_alias="Diplopia",
        anchor_concept_id="24982008",
        fsn="Diplopia (disorder)",
        rationale=(
            "[auto-resolved, AUTO_HIERARCHY] Diplopia (disorder) (24982008) is a common IS_A ancestor of every other matched candidate for 'Diplopia', chosen per the plan's broader-parent rule (bounded descendant traversal from it covers the rejected variants without a separate anchor per variant). Rejected as redundant descendants: Monocular diplopia (disorder) (50446000); Refractive diplopia (disorder) (75364009); Double vision with both eyes open (disorder) (246655008); Homonymous diplopia (disorder) (251755005); Heteronymous diplopia (disorder) (251756006); Paradoxical diplopia (disorder) (251757002) (+2 more)."
        ),
    ),
    AnchorMapping(
        ctas_alias="Periorbital swelling",
        anchor_concept_id="49563000",
        fsn="Periorbital edema (disorder)",
        rationale=(
            "Searched 'periorbital swelling' (0 hits CF). Searched 'periorbital edema' → 4 hits: 49563000 Periorbital edema (disorder) is the broad parent; lateralized variants (bilateral 349131000119103, left 348551000119107, right 348101000119102) are IS-A descendants. Searched 'eyelid swelling' (0 hits). 49563000 Periorbital edema (disorder) is the verified exact SNOMED match for periorbital swelling — periorbital swelling and periorbital edema are clinically synonymous."
        ),
    ),
    AnchorMapping(
        ctas_alias="Eye trauma",
        anchor_concept_id="282752000",
        fsn="Injury of eye region (disorder)",
        rationale=(
            "[controller-corrected after holistic review] Original pick was 735659002 'Retained magnetic foreign body in bilateral eyes due to and following eye injury (disorder)'. Holistic review (opus) independently verified via search_snomed.py that original pick was a narrow retained-foreign-body concept, grossly over-specific. Corrected to 282752000 'Injury of eye region (disorder)'."
        ),
    ),
    AnchorMapping(
        ctas_alias="Back pain",
        anchor_concept_id="161891005",
        fsn="Backache (finding)",
        rationale=(
            "[controller-corrected after holistic review] Original pick was 279039007 'Low back pain (finding)'. Holistic review (opus) independently verified via search_snomed.py that synonym 'Back pain' confirmed; pool missed it. Corrected to 161891005 'Backache (finding)'."
        ),
    ),
    AnchorMapping(
        ctas_alias="Traumatic back / spine injury",
        anchor_concept_id="282766005",
        fsn="Lower back injury (disorder)",
        rationale=(
            "282766005 Lower back injury (disorder) is the best available anchor for 'Traumatic back / spine injury'. Of 3 candidates: 698499006 Spine injury due to birth trauma — paediatric/obstetric specific; 282767001 Injury of back of chest — thoracic level; 282766005 Lower back injury — lumbar trauma, most common traumatic spinal presentation. No 'Spinal cord injury (disorder)' or 'Injury of spine (disorder)' parent appears in the restricted pool. Rejected birth trauma and thoracic-specific variants. Lower back injury is the least narrow option covering the dominant clinical scenario."
        ),
    ),
    AnchorMapping(
        ctas_alias="Amputation",
        anchor_concept_id="262595009",
        fsn="Traumatic amputation (disorder)",
        rationale=(
            "[controller-corrected after holistic review] Original pick was 95855003 'Traumatic amputation of finger (disorder)'. Holistic review (opus) independently verified via search_snomed.py that exact-match concept exists, rationale falsely claimed absence. Corrected to 262595009 'Traumatic amputation (disorder)'."
        ),
    ),
    AnchorMapping(
        ctas_alias="Upper extremity pain",
        anchor_concept_id="102556003",
        fsn="Pain in upper limb (finding)",
        rationale=(
            "[controller-corrected after holistic review] Original pick was 45326000 'Pain of shoulder region (finding)'. Holistic review (opus) independently verified via search_snomed.py that exact-match exists; rationale's own claimed search was wrong. Corrected to 102556003 'Pain in upper limb (finding)'."
        ),
    ),
    AnchorMapping(
        ctas_alias="Lower extremity pain",
        anchor_concept_id="10601006",
        fsn="Pain in lower limb (finding)",
        rationale=(
            "[auto-resolved, AUTO_HIERARCHY] Pain in lower limb (finding) (10601006) is a common IS_A ancestor of every other matched candidate for 'Lower extremity pain', chosen per the plan's broader-parent rule (bounded descendant traversal from it covers the rejected variants without a separate anchor per variant). Rejected as redundant descendants: Pain in bilateral lower legs (finding) (12247531000119106)."
        ),
    ),
    AnchorMapping(
        ctas_alias="Upper extremity injury",
        anchor_concept_id="127278005",
        fsn="Injury of upper extremity (disorder)",
        rationale=(
            "[auto-resolved, AUTO_SINGLE] Injury of upper extremity (disorder) (127278005) was the sole SNOMED Clinical Finding concept matching 'Upper extremity injury' and its aliases via keyword search (FSN + synonym descriptions, word-boundary matched). No other candidates existed to reject."
        ),
    ),
    AnchorMapping(
        ctas_alias="Lower extremity injury",
        anchor_concept_id="127279002",
        fsn="Injury of lower limb (disorder)",
        rationale=(
            "Searched 'lower extremity injury', 'lower limb injury' (0 hits CF). Searched 'injury of lower extremity' → confirmed 127279002 Injury of lower limb (disorder) (syn: 'Injury of lower extremity') — the canonical broad parent. IS-A descendants include superficial injuries, crushing injury 39595001, fractures, and all anatomically specific lower limb injuries. Rejected 274197007 Superficial injury of lower limb — mechanism-specific (superficial only). Rejected 39595001 Crushing injury — mechanism-specific."
        ),
    ),
    AnchorMapping(
        ctas_alias="Joint(s) swelling",
        anchor_concept_id="271771009",
        fsn="Joint swelling (finding)",
        rationale=(
            "[auto-resolved, AUTO_SINGLE] Joint swelling (finding) (271771009) was the sole SNOMED Clinical Finding concept matching 'Joint(s) swelling' and its aliases via keyword search (FSN + synonym descriptions, word-boundary matched). No other candidates existed to reject."
        ),
    ),
    AnchorMapping(
        ctas_alias="Feeding difficulties in newborn",
        anchor_concept_id="72552008",
        fsn="Neonatal feeding problem (finding)",
        rationale=(
            "[auto-resolved, AUTO_SINGLE] Neonatal feeding problem (finding) (72552008) was the sole SNOMED Clinical Finding concept matching 'Feeding difficulties in newborn' and its aliases via keyword search (FSN + synonym descriptions, word-boundary matched). No other candidates existed to reject."
        ),
    ),
    AnchorMapping(
        ctas_alias="Neonatal jaundice",
        anchor_concept_id="387712008",
        fsn="Neonatal jaundice (finding)",
        rationale=(
            "[auto-resolved, AUTO_SIMILARITY] Neonatal jaundice (finding) (387712008) had a clearly dominant textual-similarity match against 'Neonatal jaundice' among 30 matched candidates (no IS_A hierarchy relationship among them). Rejected as less textually specific to this complaint: Neonatal jaundice due to delayed conjugation from delayed development of conjugating system (finding) (69347004); Neonatal jaundice associated with preterm delivery (finding) (73749009); Hypermelanosis following phototherapy for neonatal jaundice (disorder) (403525002); Neonatal jaundice due to delayed conjugation (finding) (17140000); Neonatal jaundice due to glucose-6-phosphate dehydrogenase deficiency (finding) (206439006); Neonatal jaundice with congenital hypothyroidism (disorder) (206457007) (+23 more)."
        ),
    ),
    AnchorMapping(
        ctas_alias="Inconsolable crying in infants",
        anchor_concept_id="788918005",
        fsn="Excessive crying of infant (finding)",
        rationale=(
            "Searched 'inconsolable crying' (0 hits CF). Searched 'excessive crying' → 788918005 Excessive crying of infant (finding) confirmed as the most specific match for the infant age group. Also confirmed 766877008 Constantly crying infant (finding) as a narrower variant. 788918005 Excessive crying of infant (finding) is the most accurate anchor — 'inconsolable' maps clinically to 'excessive crying of infant'. Rejected 275925003 Excessive crying of child — age-specific to older children. Rejected 766877008 Constantly crying infant — 'constantly' is a severity qualifier, narrower. Rejected 162214009 Crying infant — too generic (does not capture excessive/inconsolable severity)."
        ),
    ),
    AnchorMapping(
        ctas_alias="Wheezing – no other complaints",
        anchor_concept_id="56018004",
        fsn="Wheezing (finding)",
        rationale=(
            "56018004 Wheezing (finding) is the canonical etiology-neutral parent for 'Wheezing'. IS-A descendants include 68095009 Wheezing stridor, 9763007 Expiratory wheezing, 31572008 Inspiratory wheezing, 161947006 Nocturnal cough and wheeze. Rejected 272040008 Wheezing symptom (finding) — symptom context wrapper, less precise than the clinical finding. Rejected pattern- and timing-specific subtypes as all narrower."
        ),
    ),
    AnchorMapping(
        ctas_alias="Paediatric gait disorder / painful walk",
        anchor_concept_id="88121000119101",
        fsn="Limp occurring during childhood (finding)",
        rationale=(
            "Searched 'limp child' (0 hits), 'limp in child' → confirmed 88121000119101 Limp occurring during childhood (finding) (syn: 'Limp in childhood'). Searched 'painful gait' → 428264009 Painful gait (finding); 'antalgic gait' → 67141003 Antalgic gait (finding). 88121000119101 Limp occurring during childhood (finding) is the most clinically precise anchor for the paediatric gait complaint — a limping child is the canonical presentation of this CTAS code (Perthes, SUFE, septic arthritis, transient synovitis). Rejected 428264009 Painful gait — not paediatric-specific and misses non-painful gait disorders. Rejected 67141003 Antalgic gait — pain-qualified, excludes non-antalgic gait disorders in children."
        ),
    ),
    AnchorMapping(
        ctas_alias="Apneic spells in infants",
        anchor_concept_id="724229002",
        fsn="Apnea of infancy (disorder)",
        rationale=(
            "Searched 'apnoeic spell' → 70073005 Perinatal apneic spells (disorder) (syn: 'Perinatal apnoeic spells'). Searched 'apnea of infancy' → confirmed 724229002 Apnea of infancy (disorder) as the most precise anchor for apneic episodes in infants beyond the perinatal period. Also confirmed 276544005 Apnea of prematurity (disorder) and 13094009 Neonatal apnea (finding). 724229002 Apnea of infancy (disorder) is chosen because 'apneic spells in infants' covers the post-neonatal infant period (1 month–1 year); Apnea of infancy is specifically defined for this age window. Rejected 70073005 Perinatal apneic spells — perinatal period only (0–28 days), too narrow. Rejected 13094009 Neonatal apnea — neonatal period only."
        ),
    ),
    AnchorMapping(
        ctas_alias="Concern for patient's welfare",
        anchor_concept_id="95930005",
        fsn="Victim of neglect (finding)",
        rationale=(
            "95930005 Victim of neglect (finding) is the best anchor for 'Concern for patient's welfare'. No 'Concern for patient's welfare (finding)' concept exists. Neglect encompasses child abuse, elder neglect, and self-neglect contexts — the primary clinical scenarios driving this CTAS code. IS-A descendants include 401235000 Moderate risk of self neglect, 401330008 High risk of self neglect, 401233007 At increased risk of self neglect. Rejected self-neglect-specific subtypes as narrower than the general concern. Rejected 231421000119102 Child victim of nutritional neglect — too specific."
        ),
    ),
    AnchorMapping(
        ctas_alias="Floppy child",
        anchor_concept_id="205294008",
        fsn="Neonatal hypotonia (disorder)",
        rationale=(
            "Searched 'floppy infant' → confirmed 205294008 Neonatal hypotonia (disorder) (syn: 'Floppy infant'). Searched 'floppy child' (0 hits). Searched 'infant hypotonia' → only 721887007 Puerto Rican infant hypotonia syndrome (disease-specific). 205294008 Neonatal hypotonia (disorder) is the only SNOMED concept directly synonymous with 'floppy infant/child'. While the CTAS alias says 'child' rather than 'infant', clinically floppy-child presentations at triage use this same concept. No 'Hypotonia (finding)' broad parent without age qualifier exists in the CF scope. 205294008 is the verified best available anchor."
        ),
    ),
    AnchorMapping(
        ctas_alias="Stridor",
        anchor_concept_id="70407001",
        fsn="Stridor (finding)",
        rationale=(
            "[auto-resolved, AUTO_SIMILARITY] Stridor (finding) (70407001) had a clearly dominant textual-similarity match against 'Stridor' among 11 matched candidates (no IS_A hierarchy relationship among them). Rejected as less textually specific to this complaint: Wheezing stridor (finding) (68095009); Factitious asthma (disorder) (233690008); Noisy respiration (finding) (248573009); Laryngeal stridor (finding) (773117009); Expiratory stridor (finding) (301287002); Intermittent stridor (finding) (301826004) (+4 more)."
        ),
    ),
    AnchorMapping(
        ctas_alias="Congenital problem in children",
        anchor_concept_id="66091009",
        fsn="Congenital disease (disorder)",
        rationale=(
            "Searched 'congenital problem' (0 hits CF). Searched 'congenital disease' → confirmed 66091009 Congenital disease (disorder) (syn: 'Congenital disease', 'Congenital disorder'). Searched 'congenital malformation' → 276654001 Congenital malformation (disorder) (syn: 'Congenital anomaly'). 66091009 Congenital disease (disorder) is the broadest top-level SNOMED parent for all congenital conditions, covering structural anomalies, metabolic disorders, chromosomal abnormalities — all categories of 'congenital problem in children'. Rejected 276654001 Congenital malformation — covers structural anomalies only, excludes inborn errors of metabolism and chromosomal disorders."
        ),
    ),
    AnchorMapping(
        ctas_alias="Shortness of breath",
        anchor_concept_id="267036007",
        fsn="Dyspnea (finding)",
        rationale=(
            "[controller-corrected after holistic review] Original pick was 60845006 'Dyspnea on exertion (finding)'. Holistic review (opus) independently verified via search_snomed.py that broad parent exists, rationale falsely claimed absence. Corrected to 267036007 'Dyspnea (finding)'."
        ),
    ),
    AnchorMapping(
        ctas_alias="Respiratory arrest",
        anchor_concept_id="87317003",
        fsn="Respiratory arrest (disorder)",
        rationale=(
            "87317003 Respiratory arrest (disorder) is the canonical parent for 'Respiratory arrest'. IS-A descendants include 95634003 Neonatal respiratory arrest, 276259003 Respiratory arrest preceding cardiac arrest, 1259554001 Anoxic encephalopathy due to respiratory arrest. Rejected 1023001 Apnea (finding) — symptom finding, not the disorder parent. Rejected neonatal subtype as age-specific. Rejected consequence subtypes (anoxic encephalopathy) as narrower."
        ),
    ),
    AnchorMapping(
        ctas_alias="Cough / Congestion",
        anchor_concept_id="49727002",
        fsn="Cough (finding)",
        rationale=(
            "[controller-corrected after holistic review] Original pick was 68235000 'Nasal congestion (finding)'. Holistic review (opus) independently verified via search_snomed.py that resolves both the 152/653 anchor collision and a false 'no parent' claim. Corrected to 49727002 'Cough (finding)'."
        ),
    ),
    AnchorMapping(
        ctas_alias="Hyperventilation",
        anchor_concept_id="68978004",
        fsn="Hyperventilation (finding)",
        rationale=(
            "68978004 Hyperventilation (finding) is the canonical etiology-neutral parent for 'Hyperventilation'. IS-A descendants include 191956005 Psychogenic hyperventilation, 69479009 Anxiety hyperventilation, 423427003 Intermittent hyperventilation, 399164003 Acidotic hyperventilation. Rejected etiology-specific subtypes as all narrower."
        ),
    ),
    AnchorMapping(
        ctas_alias="Hemoptysis",
        anchor_concept_id="66857006",
        fsn="Hemoptysis (finding)",
        rationale=(
            "[auto-resolved, AUTO_SIMILARITY] Hemoptysis (finding) (66857006) had a clearly dominant textual-similarity match against 'Hemoptysis' among 3 matched candidates (no IS_A hierarchy relationship among them). Rejected as less textually specific to this complaint: Perinatal hemoptysis of fetus and/or neonate (finding) (206304007); Infection caused by Paragonimus (disorder) (30369007)."
        ),
    ),
    AnchorMapping(
        ctas_alias="Respiratory foreign body",
        anchor_concept_id="196168001",
        fsn="Choking due to airways obstruction (finding)",
        rationale=(
            "196168001 Choking due to airways obstruction (finding) is the most clinically precise available concept for 'Respiratory foreign body'. The pool contains no 'Foreign body in airway (disorder)' concept. Choking due to airway obstruction captures the life-threatening presentation of respiratory foreign body. Rejected 373909009 Choking sensation — symptom perception, weaker. Rejected 85597002 Choking caused by phlegm in larynx — non-FB aetiology. Rejected 225589000 Chokes when swallowing — swallowing act, not the airway obstruction state. Rejected 225930002 At increased risk of choking — risk finding, not active presentation."
        ),
    ),
    AnchorMapping(
        ctas_alias="Allergic reaction",
        anchor_concept_id="419076005",
        fsn="Allergic reaction (disorder)",
        rationale=(
            "419076005 Allergic reaction (disorder) is the canonical etiology-neutral parent for 'Allergic reaction'. IS-A descendants include 416093006 Allergic reaction caused by drug, 419452009 Allergic reaction caused by food, 419375001 Allergic reaction caused by oil, 418367004 Allergic reaction caused by grass pollen, 418364006 Allergic reaction caused by pollen. All cause-specific subtypes are IS-A descendants. Rejected all cause-qualified subtypes as narrower."
        ),
    ),
    AnchorMapping(
        ctas_alias="Bite",
        anchor_concept_id="283682007",
        fsn="Bite - wound (disorder)",
        rationale=(
            "[controller-corrected after fix-round-2 re-review] Original pick was 283683002 'Mammal bite wound (disorder)'. original pick (283683002 Mammal bite wound) is a descendant of 283682007 Bite - wound; prevalence ('vast majority of ED bite presentations') was wrongly used as a tie-break against a real parent, inverting the plan's actual rule. Corrected to 283682007 'Bite - wound (disorder)'."
        ),
    ),
    AnchorMapping(
        ctas_alias="Sting",
        anchor_concept_id="371058004",
        fsn="Venomous sting (disorder)",
        rationale=(
            "[controller-corrected after fix-round-2 re-review] Original pick was 403142004 'Hymenoptera sting (disorder)'. original pick (403142004 Hymenoptera sting) is a descendant of 371058004 Venomous sting -- the rationale itself acknowledged this broader concept, then overrode it on prevalence grounds, inverting the plan's actual rule. Corrected to 371058004 'Venomous sting (disorder)'."
        ),
    ),
    AnchorMapping(
        ctas_alias="Abrasion",
        anchor_concept_id="399963005",
        fsn="Abrasion (disorder)",
        rationale=(
            "399963005 Abrasion (disorder) is the canonical etiology-neutral parent for 'Abrasion'. IS-A descendants include corneal abrasion, infected abrasion, abrasions of specific body sites. The broad Abrasion (disorder) anchors the entire IS-A tree. Rejected 85848002 Corneal abrasion — ocular specific. Rejected 110164000, 110168000 forehead/chin abrasions — anatomy-specific. Rejected infected abrasion variants — complication qualifier."
        ),
    ),
    AnchorMapping(
        ctas_alias="Laceration / Puncture",
        anchor_concept_id="274165007",
        fsn="Laceration of skin (disorder)",
        rationale=(
            "[controller-corrected after holistic review] Original pick was 370247008 'Facial laceration (disorder)'. Holistic review (opus) independently verified via search_snomed.py that broader parent exists, matches 704's own complaint scope. Corrected to 274165007 'Laceration of skin (disorder)'."
        ),
    ),
    AnchorMapping(
        ctas_alias="Burn",
        anchor_concept_id="125666000",
        fsn="Burn (disorder)",
        rationale=(
            "125666000 Burn (disorder) is the canonical etiology-neutral parent for 'Burn'. IS-A descendants include 314534006 Thermal burn, chemical burns, electrical burns, and all body-site specific burns. Considered 314534006 Thermal burn — valid but excludes chemical and electrical burns. Rejected all anatomy- and mechanism-specific burns as narrower."
        ),
    ),
    AnchorMapping(
        ctas_alias="Blood and body fluid exposure",
        anchor_concept_id="304235000",
        fsn="Sharps injury (disorder)",
        rationale=(
            "304235000 Sharps injury (disorder) is the anchor for 'Blood and body fluid exposure'. Broad search confirmed no 'Blood and body fluid exposure (finding)' or 'Occupational exposure to blood (finding)' exists in Clinical Finding scope -- Sharps injury is the closest verified concept covering the most common exposure route. Known limitation, documented rather than hidden: splash/mucosal exposure events (non-sharps) are not well covered by this anchor's descendant traversal; a future pass could add a second seed keyword search specifically for mucosal/splash exposure if this proves to miss real user mentions."
        ),
    ),
    AnchorMapping(
        ctas_alias="Pruritus",
        anchor_concept_id="418290006",
        fsn="Itching (finding)",
        rationale=(
            "418290006 Itching (finding) is the only etiology-neutral itch parent in the pool for 'Pruritus'. All other itch candidates are body-site specific (scrotal, vulvar, penile, perianal). Itching (finding) is the broad symptom parent covering all localizations. Rejected 65645005, 67882000, 69069001, 90446007 — all are anatomically specific subtypes."
        ),
    ),
    AnchorMapping(
        ctas_alias="Rash",
        anchor_concept_id="64144002",
        fsn="Pruritic rash (disorder)",
        rationale=(
            "64144002 Pruritic rash (disorder) is the most clinically appropriate anchor for 'Rash'. Pruritic rash captures the dominant triage presentation where rash and itch co-occur. No broad 'Rash (finding)' parent appears without qualifiers in the 73-candidate pool. Considered 398591002 Centripetal rash (finding) and 398600002 Centrifugal rash — distribution qualifiers, too specific. Rejected 91487003 Diaper rash — paediatric age-specific context. Rejected 95332009 Rash of systemic lupus erythematosus — disease-specific."
        ),
    ),
    AnchorMapping(
        ctas_alias="Localized swelling / redness",
        anchor_concept_id="10677951000119102",
        fsn="Localized swelling of forearm (finding)",
        rationale=(
            "10677951000119102 Localized swelling of forearm (finding) is the anchor for 'Localized swelling / redness'. Verified: no broad 'Localized swelling (finding)' parent exists in Clinical Finding scope -- all 36 candidates in the original pool were site-specific. Forearm chosen as a frequently-affected, clinically-significant site; this is a pragmatic single-site proxy for a genuinely site-agnostic complaint, not a perfect match. Known limitation: the 'redness' half of the complaint is only partially covered by this anchor's descendants."
        ),
    ),
    AnchorMapping(
        ctas_alias="Other skin conditions",
        anchor_concept_id="95320005",
        fsn="Disorder of skin (disorder)",
        rationale=(
            "Searched 'skin condition' (0 hits CF), 'skin disorder', 'disorder of skin', 'skin disease', 'skin finding'. Confirmed 95320005 Disorder of skin (disorder) (syn: 'Skin disorder', 'Skin disease', 'Dermatosis') as the canonical SNOMED top-level parent for all skin disorders. IS-A traversal from this concept covers all specific dermatological diagnoses. Also confirmed 106076001 Skin finding (finding) exists but is less specific. 95320005 is the correct anchor for 'Other skin conditions NOS'. Rejected 106076001 Skin finding — observation-level, not disorder parent."
        ),
    ),
    AnchorMapping(
        ctas_alias="Lumps, bumps, calluses",
        anchor_concept_id="201040000",
        fsn="Callosity (disorder)",
        rationale=(
            "[controller-corrected after holistic review] Original pick was 229810006 'Apical callus (disorder)'. 201040000 Callosity (disorder) has the synonym 'Callus' -- exact match the original 8-candidate pool missed (picked Apical callus, foot-specific). Corrected to 201040000 'Callosity (disorder)'."
        ),
    ),
    AnchorMapping(
        ctas_alias="Redness / tenderness, breast",
        anchor_concept_id="266579006",
        fsn="Inflammatory disorder of breast (disorder)",
        rationale=(
            "266579006 Inflammatory disorder of breast (disorder) is the best available broad anchor for 'Redness / tenderness, breast'. IS-A descendants include mastitis variants (purulent mastitis 16317041000119105, 16317081000119100), 290079000 Generalized breast tenderness, 290080002 Localized breast tenderness. Rejected 254840009 Inflammatory carcinoma of breast — malignancy subtype, too specific. Rejected individual mastitis subtypes as all are narrower."
        ),
    ),
    AnchorMapping(
        ctas_alias="Cyanosis",
        anchor_concept_id="3415004",
        fsn="Cyanosis (finding)",
        rationale=(
            "[controller-corrected after holistic review] Original pick was 95837007 'Central cyanosis (disorder)'. Holistic review (opus) independently verified via search_snomed.py that parent never considered by original pick. Corrected to 3415004 'Cyanosis (finding)'."
        ),
    ),
    AnchorMapping(
        ctas_alias="Spontaneous bruising",
        anchor_concept_id="161887000",
        fsn="Spontaneous bruising (disorder)",
        rationale=(
            "[auto-resolved, AUTO_SIMILARITY] Spontaneous bruising (disorder) (161887000) had a clearly dominant textual-similarity match against 'Spontaneous bruising' among 2 matched candidates (no IS_A hierarchy relationship among them). Rejected as less textually specific to this complaint: Easy bruising (finding) (424131007)."
        ),
    ),
    AnchorMapping(
        ctas_alias="Foreign body, skin",
        anchor_concept_id="93458008",
        fsn="Foreign body in skin (disorder)",
        rationale=(
            "93458008 Foreign body in skin (disorder) is the canonical etiology-neutral parent for 'Foreign body, skin'. IS-A descendants include all anatomically specific skin FB variants (eyelid, foot, foreskin, finger, etc.) across the 3493-candidate pool. Rejected all anatomy-specific subtypes as all are IS-A children of this parent. Rejected 211463006 Foreign body in skin wound — wound qualifier narrows to open-wound scenarios only."
        ),
    ),
    AnchorMapping(
        ctas_alias="Substance misuse / Intoxication",
        anchor_concept_id="1149334009",
        fsn="Acute intoxication (disorder)",
        rationale=(
            "[controller-corrected after holistic review] Original pick was 414296009 'Frequency of substance misuse (finding)'. Holistic review (opus) independently verified via search_snomed.py that exact-match concept exists. Corrected to 1149334009 'Acute intoxication (disorder)'."
        ),
    ),
    AnchorMapping(
        ctas_alias="Overdose ingestion",
        anchor_concept_id="708079007",
        fsn="Overdose of illicit drug (disorder)",
        rationale=(
            "708079007 Overdose of illicit drug (disorder) is the best available anchor for 'Overdose ingestion'. No broad 'Drug overdose (disorder)' parent without qualifiers exists in the 25-candidate pool. Illicit drug overdose represents the most common ED overdose presentation; licit drug overdose (paracetamol, opioid prescriptions, etc.) candidates are mechanism-specific. Considered 711538001 Intentional drug overdose by tablet — intent- and route-specific. Considered 711539009 Intentional drug overdose by injectable — route-specific. Rejected 295501005 General anesthetic drug overdose — medical/iatrogenic context. Rejected 402766005 Skin lesion due to drug overdose — consequence finding."
        ),
    ),
    AnchorMapping(
        ctas_alias="Substance withdrawal",
        anchor_concept_id="1254795002",
        fsn="Substance withdrawal syndrome (disorder)",
        rationale=(
            "1254795002 Substance withdrawal syndrome (disorder) is the canonical parent for 'Substance withdrawal'. IS-A descendants include 74934004 Psychoactive substance withdrawal syndrome, 16236701000119107 Delirium due to substance withdrawal, 1254958006 Tremor due to substance withdrawal, 724726005 Perceptual disturbances due to withdrawal, 1259130000 Autonomic disorder due to withdrawal syndrome. Rejected 74934004 Psychoactive substance withdrawal syndrome — narrower (psychoactive only). Rejected delirium and tremor subtypes as consequence qualifiers. Rejected 414819007 Neonatal abstinence syndrome — age-specific."
        ),
    ),
    AnchorMapping(
        ctas_alias="Major trauma – penetrating",
        anchor_concept_id="262560006",
        fsn="Penetrating wound (disorder)",
        rationale=(
            "[controller-corrected after holistic review] Original pick was 283545005 'Gunshot wound (disorder)'. Holistic review (opus) independently verified via search_snomed.py that generic parent exists, matches 802's correct pattern. Corrected to 262560006 'Penetrating wound (disorder)'."
        ),
    ),
    AnchorMapping(
        ctas_alias="Major trauma – blunt",
        anchor_concept_id="425359009",
        fsn="Blunt injury (disorder)",
        rationale=(
            "Searched 'blunt trauma' → confirmed 425359009 Blunt injury (disorder) (syn: 'Blunt trauma'). Searched 'multiple injuries' → 262519004 Multiple injuries (disorder). 425359009 Blunt injury (disorder) is the etiology-neutral broad parent for all blunt mechanism injuries, appropriate for 'Major trauma – blunt'. IS-A descendants include 424863004 Blunt injury of abdomen, 422916003 Blunt injury of thorax, and all body-site specific blunt injuries. Also confirmed 213389000 Severe multiple injuries as related. Rejected 262519004 Multiple injuries — mechanism-neutral, does not specify blunt; the CTAS code explicitly names blunt. Chose 425359009 as the mechanism-specific anchor."
        ),
    ),
    AnchorMapping(
        ctas_alias="Isolated chest trauma – penetrating",
        anchor_concept_id="1388867009",
        fsn="Penetrating wound of thorax (disorder)",
        rationale=(
            "Searched 'penetrating chest', 'penetrating thorax' → confirmed 1388867009 Penetrating wound of thorax (disorder) (syn: 'Penetrating chest injury', 'Penetrating thoracic injury'). This is the canonical SNOMED concept for isolated penetrating chest trauma. Confirmed via multiple synonym matches. No broader 'penetrating chest trauma' parent needed — this is the correct specific anchor. Rejected 262525000 Chest injury (disorder) — broader, includes blunt; the CTAS code specifies penetrating."
        ),
    ),
    AnchorMapping(
        ctas_alias="Isolated chest trauma – blunt",
        anchor_concept_id="422916003",
        fsn="Blunt injury of thorax (disorder)",
        rationale=(
            "Searched 'blunt chest' (0 hits), 'chest wall contusion' (0 hits), 'contusion of thorax' (0 hits). Searched 'blunt injury of thorax' → confirmed 422916003 Blunt injury of thorax (disorder) as the exact canonical concept. Also confirmed 262525000 Chest injury (disorder) as a broader alternative. Chose 422916003 Blunt injury of thorax as the mechanism-specific anchor for 'Isolated chest trauma – blunt'. Rejected 262525000 Chest injury — includes penetrating injuries; the CTAS code specifies blunt."
        ),
    ),
    AnchorMapping(
        ctas_alias="Isolated abdominal trauma – penetrating",
        anchor_concept_id="443183003",
        fsn="Penetrating wound of abdomen (disorder)",
        rationale=(
            "Searched 'penetrating abdominal', 'abdominal penetrating wound' (0 hits CF). Searched 'penetrating wound of abdomen' → confirmed 443183003 Penetrating wound of abdomen (disorder). Also confirmed 283475002 Stab wound of abdomen (disorder) as a narrower IS-A descendant. 443183003 is the canonical broad parent for penetrating abdominal trauma. Rejected 283475002 Stab wound of abdomen — stab is a specific mechanism; penetrating also includes gunshot, impalement."
        ),
    ),
    AnchorMapping(
        ctas_alias="Isolated abdominal trauma – blunt",
        anchor_concept_id="424863004",
        fsn="Blunt injury of abdomen (disorder)",
        rationale=(
            "Searched 'blunt abdominal', 'blunt abdomen', 'abdominal contusion', 'contusion of abdomen' (all 0 hits CF). Searched 'blunt injury of abdomen' → confirmed 424863004 Blunt injury of abdomen (disorder) (syn: 'Blunt trauma to abdomen'). Also confirmed 128069005 Injury of abdomen (disorder) as a broader alternative. Chose 424863004 as the mechanism-specific anchor matching 'Isolated abdominal trauma – blunt'. Rejected 128069005 Injury of abdomen — includes penetrating; the CTAS code specifies blunt."
        ),
    ),
    AnchorMapping(
        ctas_alias="Exposure to communicable disease",
        anchor_concept_id="1296884009",
        fsn="At increased risk of exposure to communicable disease (finding)",
        rationale=(
            "1296884009 At increased risk of exposure to communicable disease (finding) is preferred over 1220567008 Sexual behavior with high risk of exposure to communicable disease (finding) for 'Exposure to communicable disease'. Only 2 candidates. 1296884009 is etiology-neutral and covers any route of communicable disease exposure. Rejected 1220567008 — sexually transmitted exposure only, too narrow; the CTAS complaint covers any communicable disease exposure (e.g. measles, TB, COVID-19 contacts)."
        ),
    ),
    AnchorMapping(
        ctas_alias="Fever",
        anchor_concept_id="386661006",
        fsn="Fever (finding)",
        rationale=(
            "386661006 Fever (finding) is the canonical etiology-neutral parent for 'Fever'. IS-A descendants cover the entire fever etiology space (infectious, post-vaccine, pyrexia of unknown origin, fever with chills 274640006, fever >100.4F 426000000, and all specific infectious fever variants in the 325-candidate pool). Rejected all cause-specific fever variants as narrower. Rejected 274640006 Fever with chills — symptom qualifier. Rejected 426000000 Fever >100.4F — threshold qualifier."
        ),
    ),
    AnchorMapping(
        ctas_alias="Hyperglycemia",
        anchor_concept_id="80394007",
        fsn="Hyperglycemia (disorder)",
        rationale=(
            "80394007 Hyperglycemia (disorder) is the canonical parent for 'Hyperglycemia'. IS-A descendants include 398123003 Dawn phenomenon, 170765005 Chronic hyperglycemia, 441690002 Drug-induced hyperglycemia, 708122002 Steroid-induced hyperglycemia, 700449008 Non-diabetic hyperglycemia, and diabetes-related hyperglycemia subtypes. Only one broad non-etiology-qualified concept in the pool. Rejected all etiology-specific subtypes as narrower."
        ),
    ),
    AnchorMapping(
        ctas_alias="Hypoglycemia",
        anchor_concept_id="302866003",
        fsn="Hypoglycemia (disorder)",
        rationale=(
            "302866003 Hypoglycemia (disorder) is the canonical parent for 'Hypoglycemia'. IS-A descendants include all specific subtypes: 62151007 Leucine-induced, 66095000 Mixed, 68581004 Childhood, 71858003 Autoimmune, 6974005 Fasting, 317006 Reactive, 111559003 Spontaneous hypoglycemia. Rejected all cause-specific subtypes as narrower."
        ),
    ),
    AnchorMapping(
        ctas_alias="Medical device problem",
        anchor_concept_id="73862001",
        fsn="Complication of catheter (disorder)",
        rationale=(
            "[controller-corrected after holistic review] Original pick was 278534004 'Disorder associated with cystostomy catheter (disorder)'. original pick (Disorder associated with cystostomy catheter) came from a pool dominated by fallopian tube disorders per the batch's own admission; 73862001 (synonym 'Complication of catheter') is a proper generic parent covering device/tube/line/catheter problems broadly, matching the complaint's own aliases ('device malfunction', 'catheter/tube/line problem'). Corrected to 73862001 'Complication of catheter (disorder)'."
        ),
    ),
    AnchorMapping(
        ctas_alias="Abnormal lab values",
        anchor_concept_id="151271000119102",
        fsn="Abnormal blood test (finding)",
        rationale=(
            "[auto-resolved, AUTO_SINGLE] Abnormal blood test (finding) (151271000119102) was the sole SNOMED Clinical Finding concept matching 'Abnormal lab values' and its aliases via keyword search (FSN + synonym descriptions, word-boundary matched). No other candidates existed to reject."
        ),
    ),
    AnchorMapping(
        ctas_alias="Pallor / Anemia",
        anchor_concept_id="271737000",
        fsn="Anemia (disorder)",
        rationale=(
            "271737000 Anemia (disorder) is the canonical parent for 'Pallor / Anemia'. The pallor pole is captured by 1237486008 Pale discoloration of entire skin of body and 1209208002 Pallor of skin of face as related concepts. Anemia (disorder) is the primary clinical diagnosis and the most actionable; pallor is a sign of anemia. IS-A descendants include all anemia subtypes in the 408-candidate pool: hemolytic, aplastic, megaloblastic, nutritional, congenital, immune-mediated, and others. Rejected individual anemia subtypes as all are narrower. Rejected organ-specific pallor findings as sign concepts, not disorder anchors."
        ),
    ),
    AnchorMapping(
        ctas_alias="Post-operative complications",
        anchor_concept_id="385486001",
        fsn="Postoperative complication (disorder)",
        rationale=(
            "Searched 'postoperative complication' → confirmed 385486001 Postoperative complication (disorder) as the broad parent. Also confirmed 88797001 Complication of surgical procedure (disorder) (syn: 'Complication of surgical procedure') as an alternative. 385486001 Postoperative complication (disorder) is the more specific and clinically relevant anchor for 'Post-operative complications' — IS-A descendants include all specific postoperative complications (wound dehiscence, hemorrhage, infection, etc.). Rejected 88797001 — slightly broader (includes intraoperative complications). Chose 385486001 as the most precise match."
        ),
    ),
    AnchorMapping(
        ctas_alias="Newly Born",
        anchor_concept_id="118188004",
        fsn="Neonatal finding (finding)",
        rationale=(
            "[controller-corrected after holistic review] Original pick was 102500002 'Good neonatal condition at birth (finding)'. original pick (Good neonatal condition at birth) had an inverted polarity mismatch with its own red flag's emergent severity ('good condition' implying no concern vs 'emergent' implying concern); 118188004 is a neutral broad umbrella category, matches the plan's broader-parent preference. Corrected to 118188004 'Neonatal finding (finding)'."
        ),
    ),
]
