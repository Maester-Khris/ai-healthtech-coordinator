# Case Study 5 — Two-Track LLM Evaluation Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add case study 5 (`two-track-llm-evaluation-groundedness-faithfulness`) to `webapp/src/data/caseStudies.ts`, extracting the evaluation-methodology narrative (Track A deterministic groundedness + Track B DeepEval LLM-as-judge faithfulness) out of case study 1, which currently compresses it into 3 `result` bullets. Trim CS1's `result`/`methodology` to a one-line cross-reference in the same change, since the trim is a direct dependency of CS5 existing (no duplicated content between the two).

**Architecture:** Pure content addition + one content trim — a new `CaseStudy` object appended to `CASE_STUDIES`, one new diagram image asset, and an in-place edit to CS1's existing `result`/`methodology` fields in the same array. No application logic changes.

**Tech Stack:** React 19 + TypeScript (strict) + Vite, `@phosphor-icons/react`. Diagram image generated externally via Gemini image generation, matching the existing CS1–3 illustration style.

## Global Constraints

- TypeScript strict mode, no `any` (per `CLAUDE.md`)
- No new npm packages
- Content must match `docs/superpowers/specs/2026-07-14-case-study-two-track-llm-evaluation-design.md` verbatim for prose
- All numeric claims must match the numbers already published in CS1 today (Track A: 106 checks, 0 hallucinated, 100%; Track B: 89 scored, 0.956 mean score, 96.6% pass rate, gpt-4o-mini judge, 0.7 threshold) — this is a move, not a re-measurement
- Do not imply the `ragas` Python library is used — it isn't (confirmed via repo-wide search); RAGAS is referenced only as the conceptual retriever/generator metric-family vocabulary, credited as such in the prose
- This plan depends on Task 1 of `2026-07-14-case-study-event-driven-fan-out.md` only insofar as both modify the same file; run this plan's Task 2 (CS5 array append) after CS4 is already in the file, or resolve the merge manually if run in parallel

---

### Task 1: Generate the diagram image (external, manual step)

**Files:**
- Create: `webapp/src/assets/case-studies/two-track-llm-evaluation-groundedness-faithfulness.png`

**Interfaces:**
- Produces: a 1024×1024 image file at the path above, matching the existing CS1–3 illustration style (dark navy `#061219` background, hand-drawn/sketch line art, mint accent `#48F6C1` since this case study's `accent` is `mint`, matching CS3's `two-tier-facility-state-cache-redis-wait-times.png` reference style, which also uses numbered circles above each box)
- Consumed by: Task 2's `diagramImage` import

- [ ] **Step 1: Run this prompt through Gemini image generation**, attaching `webapp/src/assets/case-studies/two-tier-facility-state-cache-redis-wait-times.png` as the style-reference image (mint accent, numbered-circle variant of the same illustration style needed here):

```
Using the attached image as the exact style reference (dark navy background
#061219, thin hand-drawn/sketch-style line art in mint green #48F6C1, rounded
rectangle boxes with a 2px border, a small numbered circle (1, 2, 3, 4) above
each box, bold white hand-lettered box titles, smaller white/light-gray
caption text below each box, white arrows connecting boxes left to right, a
small simple line-icon inside each box, square 1024x1024 canvas) — generate a
new 4-box horizontal flow diagram with these exact steps, in order:

Box 1: "Live Response" — icon: a small chat-bubble/checkmark shape. Caption:
"Every Pass-2 response passes a deterministic substring check, zero LLM cost"

Box 2: "Offline Replay" — icon: a small recording/replay shape. Caption:
"100 requests replayed through /chat, transcripts saved as a dataset"

Box 3: "LLM-as-Judge Scoring" — icon: a small gavel/scale shape. Caption:
"DeepEval FaithfulnessMetric scores each transcript, gpt-4o-mini judge"

Box 4: "Aggregate" — icon: a small bar-chart shape. Caption:
"Mean score and pass rate at a 0.7 threshold"

Keep the same box size, spacing, arrow style, numbered circles, and
typography as the reference image. Only the box content changes — accent
color stays the same mint green as the reference.
```

- [ ] **Step 2: Save the generated image**

Save the output to `webapp/src/assets/case-studies/two-track-llm-evaluation-groundedness-faithfulness.png`.

- [ ] **Step 3: Verify the file**

Run: `file webapp/src/assets/case-studies/two-track-llm-evaluation-groundedness-faithfulness.png`
Expected: image data, roughly square (1024x1024 or close), not a 0-byte or corrupt file.

---

### Task 2: Add the CS5 case study entry

**Files:**
- Modify: `webapp/src/data/caseStudies.ts`

**Interfaces:**
- Consumes: `CaseStudy` and related types (lines 1–69); the new PNG from Task 1
- Produces: a 5th entry in `CASE_STUDIES`, `slug: 'two-track-llm-evaluation-groundedness-faithfulness'`

- [ ] **Step 1: Add the new icon and diagram imports**

Extend the same import block Task 2 of the CS4 plan already modified. If CS4's plan already ran, change:

```typescript
import { TreeStructure, Compass, ChartLineUp, FlowArrow } from '@phosphor-icons/react'
```

to:

```typescript
import { TreeStructure, Compass, ChartLineUp, FlowArrow, Gauge } from '@phosphor-icons/react'
```

and add, alongside the other diagram imports:

```typescript
import twoTrackEvalDiagram from '../assets/case-studies/two-track-llm-evaluation-groundedness-faithfulness.png'
```

(If CS4's plan has not run yet, add `Gauge` to the original `{ TreeStructure, Compass, ChartLineUp }` import instead, and add the `twoTrackEvalDiagram` import alongside the existing three.)

- [ ] **Step 2: Append the CS5 entry to `CASE_STUDIES`**

Insert as the new last entry in the array (after CS4 if present, otherwise after CS3), before the array's closing `]`:

```typescript
  {
    slug: 'two-track-llm-evaluation-groundedness-faithfulness',
    navSection: 'ai-models',
    category: 'LLM Evaluation',
    accent: 'mint',
    icon: Gauge,
    tags: ['#Evals', '#DeepEval', '#LLMAsJudge', '#RAG'],
    title: 'Two-Track LLM Evaluation: Groundedness + Faithfulness',
    readTimeMinutes: 7,
    publishedDate: '2026-07-11',
    updatedDate: '2026-07-14',
    author: 'MediCoord Core Platform Team',
    summary:
      "An LLM's output can't be verified by reading the code that calls it, so Pass 2's generator output is checked by two independent tracks, each catching a different class of unfaithfulness: a zero-cost deterministic substring check running on every live response, and an offline LLM-as-judge pass scoring subtler fabrications a string match can't see.",
    background:
      "RAG evaluation frameworks like RAGAS conventionally split into two metric families: retriever-side (context precision, context recall — did retrieval fetch the right facts) and generator-side (faithfulness, answer relevancy — given those facts, did the model's output stay true to them). MediCoord's Pass 2 architecture makes this split unusually clean: retrieval isn't a semantic/embedding search with ranking uncertainty — it's a deterministic Python lookup (find_nearest_facilities()). The correct facility is a database fact, not a probabilistic retrieval result, which collapses the retriever-eval half of that framework to a non-problem: there's no ranking or recall to score because there's nothing to rank. What's left to evaluate is purely the generator: given a fact already known to be correct, does Pass 2's LLM stay faithful to it, or does it drift, paraphrase incorrectly, or invent details the fact never contained? That's a narrower, generator-only evaluation problem than most RAG eval guides assume — and it's why this pipeline needed two tailored approaches rather than adopting a generic metric suite wholesale. RAGAS is referenced here as the conceptual vocabulary source for the retriever-vs-generator split; the actual implementation uses DeepEval's FaithfulnessMetric, not the ragas library.",
    problem:
      "Two different failure classes need two different detection strategies for that generator-only faithfulness question. A wrong facility name is a simple, exact substitution — cheap to catch deterministically. A wrong address, or a rehab centre mischaracterized as an ER, is subtler unfaithfulness a substring match can't see, but running a judge-LLM call on every live production request adds a third round-trip's cost and latency to every triage response.",
    problemHighlights: [
      {
        heading: 'Exact Substitution vs. Semantic Drift',
        body: "A wrong name is a binary, checkable fact; a wrong address or mischaracterized category requires judgment a string match can't provide.",
        accent: 'danger',
      },
      {
        heading: "Judge Calls Aren't Free",
        body: "A judge-LLM call in the live request path adds a third round-trip's worth of cost and latency to every triage response, on top of the two passes case study 1 already documents.",
        accent: 'info',
      },
    ],
    alternativesConsidered: [
      {
        title: 'LLM-as-judge on every live request',
        body: 'Rejected: cost and latency — a third LLM call in the hot path.',
      },
      {
        title: 'Deterministic-only, skip the judge entirely',
        body: 'Rejected: catches wrong names, misses wrong addresses or category mischaracterizations that still misroute a patient.',
      },
      {
        title: "Feed the full grounding-message text (with instructions) as DeepEval's retrieval_context",
        body: 'Tried and rejected: DeepEval\'s FaithfulnessMetric extracts "truths" from retrieval_context via its own LLM call; instructional text like "use this exact name" pollutes that extraction. Rebuilt as a pure factual restatement (name, address, distance only).',
      },
    ],
    approach:
      "Two tracks, matched to what each failure class actually needs — not a generic RAGAS-style metric suite applied uniformly, but a cheap deterministic check for exact-fact grounding and an LLM-as-judge pass (DeepEval's FaithfulnessMetric, the generator-side metric RAGAS's vocabulary would call faithfulness) for the subtler cases only a semantic judge can catch. Track A (online, deterministic, zero marginal cost): check_facility_groundedness() runs on every Pass-2 response — exact facility-name substring match against the deterministic lookup result, no LLM involved. Track B (offline, LLM-as-judge): 100 requests replayed through the real /chat endpoint and saved as a purpose-built transcript dataset; 89 that resolved to a facility recommendation scored offline with DeepEval's FaithfulnessMetric (gpt-4o-mini judge — chosen for cost, bounded by a stated $5-credit constraint noted in the Sprint 17 discussion notes, not claimed as the best available judge) at a 0.7 pass threshold, against build_retrieval_context()'s facts-only restatement.",
    approachEmphasis: ['zero marginal cost', 'pollute that extraction'],
    codeSamples: [
      {
        filename: 'run_faithfulness_eval.py',
        language: 'python',
        content: `def build_retrieval_context(facility: dict) -> list[str]:
    """
    Pure factual restatement — name, address, distance only.
    Deliberately NOT the full grounding-message text (which also
    contains instructions like "use this exact name"): DeepEval's
    FaithfulnessMetric extracts "truths" from retrieval_context via
    its own LLM call, and instructional text would pollute that
    extraction.
    """
    return [
        f"{facility['name']} is located at {facility['address']}, "
        f"{facility['distanceKm']} km away."
    ]


def score_transcript(transcript: dict, metric) -> dict | None:
    facility = transcript.get("recommended_facility")
    if facility is None:
        return None

    test_case = LLMTestCase(
        input=transcript["message"],
        actual_output=transcript["response_text"],
        retrieval_context=build_retrieval_context(facility),
    )
    metric.measure(test_case)
    return {
        "message": transcript["message"],
        "score": metric.score,
        "success": metric.success,
        "reason": metric.reason,
    }


def summarize_scores(results: list[dict]) -> dict:
    if not results:
        return {"count": 0, "mean_score": 0.0, "pass_rate": 0.0}
    count = len(results)
    mean_score = sum(r["score"] for r in results) / count
    pass_rate = sum(1 for r in results if r["success"]) / count
    return {"count": count, "mean_score": mean_score, "pass_rate": pass_rate}`,
      },
    ],
    diagramSteps: [
      { title: 'Live Response, Track A Gate', desc: 'Every Pass-2 response passes through check_facility_groundedness(), an exact substring match, zero LLM cost.', icon: 'ti ti-check' },
      { title: 'Offline Replay', desc: '100 requests replayed through /chat, transcripts saved as a purpose-built dataset (89 scoreable).', icon: 'ti ti-player-play' },
      { title: 'DeepEval Faithfulness Scoring', desc: 'Each transcript scored against a facts-only retrieval_context (name, address, distance) using gpt-4o-mini as judge.', icon: 'ti ti-scale' },
      { title: 'Aggregate', desc: 'Mean score and pass rate computed at a 0.7 threshold.', icon: 'ti ti-chart-bar' },
    ],
    diagramImage: {
      src: twoTrackEvalDiagram,
      alt: 'Diagram of the two-track evaluation flow: a deterministic groundedness check on every live response, an offline replay building a transcript dataset, DeepEval faithfulness scoring against a facts-only context, and score aggregation',
      caption: 'FIG 5.1: TWO-TRACK EVALUATION FLOW',
    },
    lessonsLearned: [
      {
        title: 'Retrieval-context pollution',
        body: "Feeding the judge instructional text instead of pure facts corrupts its own truth-extraction step. A lesson about the eval instrumentation itself, not the system under test: what you feed a judge model as ground truth needs the same rigor as what you feed the system being judged.",
      },
    ],
    tradeoff:
      "Track B measures faithfulness at a point in time (an offline replay), not continuously — it doesn't run on live production traffic today. Premature-classification rate (whether the model should have asked another question instead of routing) still has no ground-truth label; that's explicitly deferred to Sprint 9's prompt-evaluation work, not silently dropped from scope.",
    result: [
      { text: 'Track A — 0 hallucinated facilities across 106 grounded-response checks — 100% groundedness.', bold: ['Track A', '0', '106', '100%'] },
      { text: 'Track B — DeepEval Faithfulness score of 0.956 (96.6% pass rate at a 0.7 threshold) across 89 facility-grounded responses — catches fabricated details a name-only match cannot see.', bold: ['Track B', '0.956', '96.6%', '89'] },
      { text: 'Premature-classification rate is not yet measurable — no historical baseline exists (the abandoned single-pass prototype was never instrumented).', bold: [] },
    ],
    methodologyOrdered: true,
    methodology: [
      { text: 'Both tracks run against a dedicated staging eval environment — a separate Supabase project and preview backend seeded from real facility data, never live user traffic.', bold: [] },
      { text: 'Track A: 106 classifications had a facility present, all 106 grounded. Window: 2026-07-11, about 15 minutes, exercised via a 4-turn manual smoke test plus a 100-request single-thread synthetic conversation run.', bold: ['106', '2026-07-11', '15 minutes'] },
      { text: 'Track B: of the 100 replayed requests, 89 returned a recommended facility and were scored (the rest resolved to a clarifying follow-up question instead). Window: 2026-07-12, single-thread run against the eval Supabase project.', bold: ['89', '2026-07-12'] },
    ],
  },
```

- [ ] **Step 3: Type-check**

Run: `cd webapp && npx tsc -b`
Expected: no errors.

- [ ] **Step 4: Commit**

```bash
git add webapp/src/data/caseStudies.ts webapp/src/assets/case-studies/two-track-llm-evaluation-groundedness-faithfulness.png
git commit -m "feat(case-studies): add two-track LLM evaluation case study"
```

---

### Task 3: Trim CS1's evaluation content to a cross-reference

**Files:**
- Modify: `webapp/src/data/caseStudies.ts`

**Interfaces:**
- Consumes: nothing new
- Produces: CS1 (`two-pass-tool-orchestration-symptom-triage`)'s `result` field shrinks to 1 bullet; `methodology`/`methodologyOrdered` fields are removed entirely (optional fields, per `CaseStudy` interface)

- [ ] **Step 1: Replace CS1's `result` array**

Find, in the `two-pass-tool-orchestration-symptom-triage` entry:

```typescript
    result: [
      { text: 'Track A — online, deterministic: 0 hallucinated facilities across 106 grounded-response checks logged against simulated live traffic — 100% groundedness.', bold: ['Track A', '0', '106', '100%'] },
      { text: 'Track B — offline, LLM-as-judge: DeepEval Faithfulness score of 0.956 (96.6% pass rate at a 0.7 threshold) across 89 facility-grounded responses replayed from a purpose-built transcript dataset — catches fabricated details a name-only match cannot see, like a wrong street address or a rehabilitation centre mischaracterized as an emergency department.', bold: ['Track B', '0.956', '96.6%', '89'] },
      { text: 'Premature-classification rate is not yet measurable. The abandoned single-pass prototype was never instrumented, so no historical baseline exists to compare against.', bold: [] },
    ],
    methodologyOrdered: true,
    methodology: [
      { text: 'Both tracks run against a dedicated staging eval environment — a separate Supabase project and preview backend seeded from real facility data, never live user traffic — so the same environment supports both a live simulated-load run and offline dataset construction without touching production.', bold: [] },
      { text: 'Track A — online, deterministic: a systematic check (check_facility_groundedness()) runs on every Pass-2 response, no LLM judge, exact facility-name substring match, zero marginal cost. Exercised with two simulated-load runs: a 4-turn manual smoke test plus a 100-request single-thread synthetic conversation run using emergent-sounding symptom messages.', bold: ['Track A', '4-turn', '100-request'] },
      { text: '106 classifications had a facility present, and all 106 were grounded. Window: 2026-07-11, about 15 minutes total.', bold: ['106', '2026-07-11', '15 minutes'] },
      { text: "Track B — offline, LLM-as-judge: the same staging environment's 100-request run was replayed through the real /chat endpoints and saved as transcripts, forming a dataset built specifically for this pipeline. Scored offline with DeepEval's FaithfulnessMetric (gpt-4o-mini judge) against a factual restatement of the facility fact injected pre-Pass-2 (name, address, distance) — judging the entire response, not just the facility name.", bold: ['Track B'] },
      { text: 'Of the 100 replayed requests, 89 returned a recommended facility and were scored; the rest resolved to a clarifying follow-up question instead. Window: 2026-07-12, single-thread run against the eval Supabase project.', bold: ['89', '2026-07-12'] },
      { text: "Premature-classification rate needs a ground-truth label for whether the model should have asked another question. That label doesn't exist yet, and is scoped as a DeepEval question for Sprint 9's prompt-evaluation work.", bold: [] },
    ],
```

Replace with:

```typescript
    result: [
      { text: 'Validated by two independent evaluation tracks — a zero-cost deterministic groundedness check and an offline LLM-as-judge faithfulness score — see Case Study: Two-Track LLM Evaluation for full methodology and measured results.', bold: [] },
    ],
```

(`methodologyOrdered` and `methodology` are fully removed — both are optional fields on `CaseStudy`.)

- [ ] **Step 2: Type-check**

Run: `cd webapp && npx tsc -b`
Expected: no errors — `methodology`/`methodologyOrdered` are optional, so omitting them is valid.

- [ ] **Step 3: Visual verification**

Run: `cd webapp && npm run dev`, open both `/for-engineers/two-pass-tool-orchestration-symptom-triage` (confirm the trimmed single-bullet result, no methodology section) and `/for-engineers/two-track-llm-evaluation-groundedness-faithfulness` (confirm the full evaluation content now lives there).
Expected: both pages render without console errors; no evaluation numbers appear twice across the two pages.

- [ ] **Step 4: Commit**

```bash
git add webapp/src/data/caseStudies.ts
git commit -m "refactor(case-studies): trim CS1 eval content to cross-reference CS5"
```
