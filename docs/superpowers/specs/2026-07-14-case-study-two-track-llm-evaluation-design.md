# Case Study 5 — Two-Track LLM Evaluation (Groundedness + Faithfulness) — Design

## Goal

Add a 5th `/for-engineers` case study documenting how MediCoord evaluates Pass 2's
generator output for faithfulness — two independent tracks (a zero-cost deterministic
check + an offline LLM-as-judge pass), framed against the RAGAS retriever/generator
metric split. This content already exists in compressed form inside CS1
(`two-pass-tool-orchestration-symptom-triage`)'s `result`/`methodology` fields; this spec
extracts it into its own case study and trims CS1 to a one-line cross-reference, so CS1
stays focused on the workflow/orchestration decision and CS5 owns the evaluation
methodology decision. No overlap, continuity instead — CS1 is "what we built and why,"
CS5 is "how we proved it holds."

## Scope

**In scope:**
- One new `CaseStudy` object appended to `webapp/src/data/caseStudies.ts` (5th entry)
- One new diagram image asset
- Trim CS1's existing `result` (3 bullets → 1) and `methodology` (6 bullets → unset,
  it's optional) fields to a single cross-reference bullet

**Out of scope:**
- Any change to the actual evaluation code (`run_faithfulness_eval.py`,
  `check_facility_groundedness()`) — this documents what already shipped in Sprint 17
  Phase B (PR #36), doesn't change it
- Adopting the actual `ragas` Python library — not used in this codebase (confirmed via
  repo-wide search); RAGAS is referenced only as the conceptual metric-family vocabulary
  (retriever-side vs. generator-side), not as an implementation dependency. Framing must
  not imply the library itself is used.
- Real hyperlink from CS1's cross-reference bullet to CS5 — `MetricBullet` only supports
  `{text, bold}`, no anchor/link rendering. The cross-reference is a plain-text mention of
  CS5's title, not a clickable link. (Skipped per YAGNI; add real cross-linking if this
  pattern recurs across more case studies.)

## Metadata

| Field | Value |
|---|---|
| `slug` | `two-track-llm-evaluation-groundedness-faithfulness` |
| `navSection` | `ai-models` |
| `category` | `LLM Evaluation` |
| `accent` | `mint` |
| `icon` | New Phosphor import — `Gauge` (not yet used by CS1–4) |
| `tags` | `#Evals` `#DeepEval` `#LLMAsJudge` `#RAG` |
| `readTimeMinutes` | 7 |
| `publishedDate` | `2026-07-11` (Track A measurement date) |
| `updatedDate` | `2026-07-14` (this case study's write date) |
| `author` | `MediCoord Core Platform Team` |

## Narrative content

**Summary**: An LLM's output can't be verified by reading the code that calls it, so
Pass 2's generator output is checked by two independent tracks, each catching a different
class of unfaithfulness: a zero-cost deterministic substring check running on every live
response, and an offline LLM-as-judge pass scoring subtler fabrications a string match
can't see.

**Background**: RAG evaluation frameworks like RAGAS conventionally split into two metric
families: retriever-side (context precision, context recall — did retrieval fetch the
right facts) and generator-side (faithfulness, answer relevancy — given those facts, did
the model's output stay true to them). MediCoord's Pass 2 architecture makes this split
unusually clean: retrieval isn't a semantic/embedding search with ranking uncertainty —
it's a deterministic Python lookup (`find_nearest_facilities()`). The "correct" facility
is a database fact, not a probabilistic retrieval result, which collapses the
retriever-eval half of that framework to a non-problem: there's no ranking or recall to
score because there's nothing to rank. What's left to evaluate is purely the
**generator**: given a fact already known to be correct, does Pass 2's LLM stay faithful
to it, or does it drift, paraphrase incorrectly, or invent details the fact never
contained? That's a narrower, generator-only evaluation problem than most RAG eval guides
assume — and it's why this pipeline needed two tailored approaches rather than adopting a
generic metric suite wholesale. (Framing note: RAGAS is referenced here as the
conceptual/vocabulary source for the retriever-vs-generator split; the actual
implementation uses DeepEval's `FaithfulnessMetric`, not the `ragas` library.)

**Problem**: Two different failure classes need two different detection strategies for
that generator-only faithfulness question. A wrong facility name is a simple, exact
substitution — cheap to catch deterministically. A wrong address, or a rehab centre
mischaracterized as an ER, is subtler unfaithfulness a substring match can't see, but
running a judge-LLM call on every live production request adds a third round-trip's cost
and latency to every triage response.

**Problem highlights**:
- *Exact Substitution vs. Semantic Drift* — a wrong name is a binary, checkable fact; a
  wrong address or mischaracterized category requires judgment a string match can't
  provide.
- *Judge Calls Aren't Free* — a judge-LLM call in the live request path adds a third
  round-trip's worth of cost and latency to every triage response, on top of the two
  passes CS1 already documents.

**Alternatives considered**:
- *LLM-as-judge on every live request* — rejected: cost + latency, a third LLM call in
  the hot path.
- *Deterministic-only, skip the judge entirely* — rejected: catches wrong names, misses
  wrong addresses/category mischaracterizations that still misroute a patient.
- *Feed the full grounding-message text (with instructions) as DeepEval's
  `retrieval_context`* — tried and rejected: DeepEval's `FaithfulnessMetric` extracts
  "truths" from `retrieval_context` via its own LLM call; instructional text like *"use
  this exact name"* pollutes that extraction. Rebuilt as a pure factual restatement
  (name/address/distance only).

**Approach** (intro line ties the RAGAS framing to the implementation): *Two tracks,
matched to what each failure class actually needs — not a generic RAGAS-style metric
suite applied uniformly, but a cheap deterministic check for exact-fact grounding and an
LLM-as-judge pass (DeepEval's `FaithfulnessMetric`, the generator-side metric RAGAS's
vocabulary would call faithfulness) for the subtler cases only a semantic judge can
catch.*
- **Track A** (online, deterministic, zero marginal cost): `check_facility_groundedness()`
  runs on every Pass-2 response — exact facility-name substring match against the
  deterministic lookup result, no LLM involved.
- **Track B** (offline, LLM-as-judge): 100 requests replayed through the real `/chat`
  endpoint and saved as a purpose-built transcript dataset; 89 that resolved to a facility
  recommendation scored offline with DeepEval's `FaithfulnessMetric` (`gpt-4o-mini` judge
  — chosen for cost, bounded by a stated $5-credit constraint noted in the Sprint 17
  discussion notes, not claimed as the best available judge) at a 0.7 pass threshold,
  against `build_retrieval_context()`'s facts-only restatement.

**Approach emphasis** (bolded phrases): `"zero marginal cost"`, `"pollute that
extraction"`

**Code samples** (real code, already written in
`backend/scripts/triage_deepeval/run_faithfulness_eval.py`):
1. `build_retrieval_context()` — the facts-only restatement design
2. `score_transcript()` — per-transcript DeepEval scoring
3. `summarize_scores()` — mean score + pass-rate aggregation

**Diagram steps** (4):
1. *Live Response → Track A Gate* — every Pass-2 response passes through
   `check_facility_groundedness()`, an exact substring match, zero LLM cost.
2. *Offline Replay* — 100 requests replayed through `/chat`, transcripts saved as a
   purpose-built dataset (89 scoreable).
3. *DeepEval Faithfulness Scoring* — each transcript scored against a facts-only
   `retrieval_context` (name/address/distance) using `gpt-4o-mini` as judge.
4. *Aggregate* — mean score + pass rate at a 0.7 threshold.

**Diagram image**: new asset —
`webapp/src/assets/case-studies/two-track-llm-evaluation-groundedness-faithfulness.{png,svg}`.
**Open item, implementation phase**: same as CS4 — no diagram tool run yet, default to
the excalidraw skill mirroring the existing diagrams' visual style.

**Lessons learned**:
- *Retrieval-context pollution* — feeding the judge instructional text instead of pure
  facts corrupts its own truth-extraction step. A lesson about the eval instrumentation
  itself, not the system under test: what you feed a judge model as "ground truth" needs
  the same rigor as what you feed the system being judged.

**Tradeoff** (stated plainly): Track B measures faithfulness at a point in time (an
offline replay), not continuously — it doesn't run on live production traffic today.
Premature-classification rate (whether the model should have asked another question
instead of routing) still has no ground-truth label; that's explicitly deferred to
Sprint 9's prompt-evaluation work, not silently dropped from scope.

## Evidence (methodology + result)

Same real numbers already published in CS1 today, moved here with their full methodology
context restored (CS1 currently compresses this to 3 bullets):

**Methodology bullets**:
- Both tracks run against a dedicated staging eval environment — a separate Supabase
  project and preview backend seeded from real facility data, never live user traffic.
- Track A: 106 classifications had a facility present, all 106 grounded. Window:
  2026-07-11, ~15 minutes, exercised via a 4-turn manual smoke test plus a 100-request
  single-thread synthetic conversation run.
- Track B: of the 100 replayed requests, 89 returned a recommended facility and were
  scored (the rest resolved to a clarifying follow-up question instead). Window:
  2026-07-12, single-thread run against the eval Supabase project.

**Result bullets**:
- **Track A** — 0 hallucinated facilities across 106 grounded-response checks — 100%
  groundedness.
- **Track B** — DeepEval Faithfulness score of **0.956** (**96.6%** pass rate at a 0.7
  threshold) across **89** facility-grounded responses — catches fabricated details a
  name-only match cannot see.
- Premature-classification rate is not yet measurable — no historical baseline exists
  (the abandoned single-pass prototype was never instrumented).

## CS1 trim (companion change, same PR)

`webapp/src/data/caseStudies.ts`, `two-pass-tool-orchestration-symptom-triage` entry:

- Replace the current 3-bullet `result` array with one bullet:
  `{ text: "Validated by two independent evaluation tracks — a zero-cost deterministic groundedness check and an offline LLM-as-judge faithfulness score — see Case Study: Two-Track LLM Evaluation for full methodology and measured results.", bold: [] }`
- Remove `methodologyOrdered: true` and the entire `methodology` array (field is
  optional — omit it entirely rather than leave an empty array)
- No other fields on CS1 change (background/problem/approach/tradeoff/lessons stay as-is
  — this trim only touches the evaluation-proof section, not the workflow narrative)

## File placement

- `webapp/src/data/caseStudies.ts` — append the new `CaseStudy` object (5th entry, after
  CS4) + new icon import (`Gauge`); trim CS1's `result`/`methodology` in the same file
- `webapp/src/assets/case-studies/two-track-llm-evaluation-groundedness-faithfulness.{png,svg}` — new

## Open questions / risks for the implementation plan

- Diagram asset generation — same open item as CS4's spec, no existing tool wired up in
  this repo's case-study workflow
- `Gauge` icon needs confirming as an actual export of `@phosphor-icons/react` before use
  (same verification CS4's `FlowArrow` already passed — do the same check for `Gauge`)
- CS1 and CS5 land in the same PR/commit since the trim is a direct dependency of CS5
  existing — sequencing note for the implementation plan, not a design ambiguity
