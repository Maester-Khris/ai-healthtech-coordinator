# Case Study 4 — Event-Driven Fan-Out Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add case study 4 (`event-driven-fan-out-eventbridge-serverless-pipeline`) to `webapp/src/data/caseStudies.ts`, documenting the AWS data pipeline's event-driven orchestration (S3 → Lambda → EventBridge → 3-phase dbt-runner gate) and its two-stack CloudFormation/SAM composition.

**Architecture:** Pure content addition — one new `CaseStudy` object appended to the existing `CASE_STUDIES` array, one new diagram image asset. No application logic changes.

**Tech Stack:** React 19 + TypeScript (strict) + Vite, `@phosphor-icons/react`. Diagram image generated externally via Gemini image generation (matches the existing CS1–3 illustration style — dark navy background, hand-drawn line art, accent-colored boxes), not built with a diagramming tool.

## Global Constraints

- TypeScript strict mode, no `any` (per `CLAUDE.md`)
- No new npm packages
- Content must match `docs/superpowers/specs/2026-07-14-case-study-event-driven-fan-out-design.md` verbatim for prose (background/problem/approach/etc.) — this plan carries that prose into literal code
- All numeric claims in the `result`/`methodology` fields must match the real CloudWatch data already gathered (90-day window ending 2026-07-14, account `891377252836`, `us-east-1`) — no invented numbers

---

### Task 1: Generate the diagram image (external, manual step)

**Files:**
- Create: `webapp/src/assets/case-studies/event-driven-fan-out-eventbridge-serverless-pipeline.png`

**Interfaces:**
- Produces: a 1024×1024 image file at the path above, matching the existing CS1–3 illustration style (dark navy `#061219` background, hand-drawn/sketch line art, 4 boxes left-to-right connected by arrows, accent color `#00D2FF` blue since this case study's `accent` is `blue`, matching CS2's `haversine-proximity-severity-gated-eligibility.png` reference style)
- Consumed by: Task 2's `diagramImage` import

- [ ] **Step 1: Run this prompt through Gemini image generation**, attaching `webapp/src/assets/case-studies/haversine-proximity-severity-gated-eligibility.png` as the style-reference image (blue accent, same illustration style needed here):

```
Using the attached image as the exact style reference (dark navy background
#061219, thin hand-drawn/sketch-style line art in light blue #00D2FF, rounded
rectangle boxes with a 2px border, bold white hand-lettered box titles, smaller
white/light-gray caption text below each box, white arrows connecting boxes
left to right, small simple line-icon inside each box, square 1024x1024
canvas, no numbered circles) — generate a new 4-box horizontal flow diagram
with these exact steps, in order:

Box 1: "Scheduled Ingestion" — icon: a small clock/calendar. Caption:
"Lambda fires every 7 days, writes raw JSON to S3"

Box 2: "S3 Event Trigger" — icon: a small S3-bucket/folder shape. Caption:
"Object Created event invokes the matching processor directly"

Box 3: "Processor Fan-In Signal" — icon: a small broadcast/signal shape.
Caption: "Publishes ProcessorComplete to the default EventBridge bus"

Box 4: "Shared Verification Gate" — icon: a small checklist/shield shape.
Caption: "dbt run, then dbt test, then a live Supabase health check"

Keep the same box size, spacing, arrow style, and typography as the
reference image. Only the box content and the accent color (light blue,
matching the reference) change.
```

- [ ] **Step 2: Save the generated image**

Save the output to `webapp/src/assets/case-studies/event-driven-fan-out-eventbridge-serverless-pipeline.png`.

- [ ] **Step 3: Verify the file**

Run: `file webapp/src/assets/case-studies/event-driven-fan-out-eventbridge-serverless-pipeline.png`
Expected: image data, roughly square (1024x1024 or close), not a 0-byte or corrupt file.

---

### Task 2: Add the CS4 case study entry

**Files:**
- Modify: `webapp/src/data/caseStudies.ts`

**Interfaces:**
- Consumes: `CaseStudy`, `DiagramImage`, `NamedSection`, `ProblemHighlight`, `CodeSample`, `MetricBullet` types already defined at the top of the file (lines 1–69); the new PNG from Task 1
- Produces: a 4th entry in the exported `CASE_STUDIES` array, `slug: 'event-driven-fan-out-eventbridge-serverless-pipeline'`

- [ ] **Step 1: Add the new icon and diagram imports**

At the top of `webapp/src/data/caseStudies.ts`, change:

```typescript
import { TreeStructure, Compass, ChartLineUp } from '@phosphor-icons/react'
import type { MetricBullet } from '../utils/caseStudyContent'
import twoPassTriageDiagram from '../assets/case-studies/two-pass-tool-orchestration-symptom-triage.png'
import haversineProximityDiagram from '../assets/case-studies/haversine-proximity-severity-gated-eligibility.png'
import twoTierCacheDiagram from '../assets/case-studies/two-tier-facility-state-cache-redis-wait-times.png'
```

to:

```typescript
import { TreeStructure, Compass, ChartLineUp, FlowArrow } from '@phosphor-icons/react'
import type { MetricBullet } from '../utils/caseStudyContent'
import twoPassTriageDiagram from '../assets/case-studies/two-pass-tool-orchestration-symptom-triage.png'
import haversineProximityDiagram from '../assets/case-studies/haversine-proximity-severity-gated-eligibility.png'
import twoTierCacheDiagram from '../assets/case-studies/two-tier-facility-state-cache-redis-wait-times.png'
import eventDrivenFanOutDiagram from '../assets/case-studies/event-driven-fan-out-eventbridge-serverless-pipeline.png'
```

- [ ] **Step 2: Append the CS4 entry to `CASE_STUDIES`**

Immediately after the closing `},` of the `two-tier-facility-state-cache-redis-wait-times` entry (the array's last current entry, closing `},` at line 422, immediately before the array's closing `]` at line 423 — confirm with `grep -n "^  },\|^]" webapp/src/data/caseStudies.ts` since line numbers shift as content is added), insert:

```typescript
  {
    slug: 'event-driven-fan-out-eventbridge-serverless-pipeline',
    navSection: 'infrastructure',
    category: 'Serverless Pipeline Orchestration',
    accent: 'blue',
    icon: FlowArrow,
    tags: ['#AWS', '#IaC', '#EventBridge', '#Serverless'],
    title: 'Event-Driven Fan-Out: S3 to Lambda to EventBridge to dbt',
    readTimeMinutes: 7,
    publishedDate: '2026-06-16',
    updatedDate: '2026-07-14',
    author: 'MediCoord Core Platform Team',
    summary:
      'Decoupling a multi-source ingestion pipeline into independent Lambda stages using native S3 and EventBridge event triggers instead of a Step Functions orchestrator or a polling coordinator — so a failure in one processor never blocks the others, and a completion signal from any of three independent sources fans into one shared transform-integrity-test-live-health checkpoint.',
    background:
      "Three independent external sources (Places, ER-wait, Open Data) each need fetch, S3 landing, process/upsert, and shared dbt transformation before the data is usable for triage routing. Coordinating three sources that get added, disabled, or moved independently over time (ER-wait was later moved to a Railway worker, Sprint 12) is a different problem than coordinating a single fixed pipeline.",
    problem:
      "A central orchestrator has to know about every source up front — adding or retiring a source means editing shared orchestration state, not just adding or removing an independent resource. And a failure in one source's processor shouldn't block or freeze the sources that are healthy.",
    problemHighlights: [
      {
        heading: 'Central Orchestrator = Central Coupling',
        body: "A Step Functions state machine (or any central coordinator) has to know about every source up front; adding a 4th source means editing the orchestrator's definition, not just adding an independent stack resource.",
        accent: 'danger',
      },
      {
        heading: "One Failure Shouldn't Freeze the Rest",
        body: "If one source's processor starts failing, that can't block a healthy source's processor from running or the shared dbt-runner from firing on the sources that did succeed.",
        accent: 'info',
      },
    ],
    alternativesConsidered: [
      {
        title: 'Step Functions state machine',
        body: "Its centralized definition doesn't match how sources actually get added or retired over time (ad hoc, sometimes disabled entirely, as ER-wait was). Editing a state machine to add or remove a branch is more coupling than the problem needs.",
      },
      {
        title: 'Polling/cron-based coordinator',
        body: 'A periodic Lambda or status-table poll adds latency and a dedicated moving part solely for coordination that S3/EventBridge already provides natively, at no extra cost.',
      },
    ],
    approach:
      "S3 Object Created events, filtered by key prefix (raw/places/, raw/er-wait/, raw/open-data/), trigger the matching processor Lambda directly — no orchestrator in between. Each processor publishes a custom ProcessorComplete event (status: SUCCESS, source medicoord.pipeline) to the default EventBridge bus after a successful Supabase upsert. One DbtRunnerRule matches that event pattern regardless of which of the three processors fired it, fanning all three into a single shared dbt-runner that never needs to know which source triggered it. Once triggered, dbt-runner runs three phases, not one: Phase 1 dbt run (transforms facilities_clean), Phase 2 dbt test (13 automated data-quality tests, 13/13 passing — an integrity gate, not just a transform), Phase 3 the medi_db_health_check Supabase RPC (dead tuples, long-running queries, deadlocks — a live database health check, not a pipeline-internal check). IAM backs the whole chain with three least-privilege roles: ingestion (SSM read + S3 write + logs), processor (S3 read + logs + EventBridge publish scoped to the default bus), dbt-runner (logs only — Supabase access is HTTPS with env-injected credentials, no AWS resource access needed). The pipeline is defined across two separate CloudFormation stacks, not one. s3-buckets.yaml (plain CloudFormation) defines the landing bucket with native EventBridgeConfiguration (S3-to-EventBridge without the manual console toggle that was tried first and abandoned), a 30-day lifecycle expiry (raw files are transient — cost hygiene, not an afterthought), and a full PublicAccessBlockConfiguration (this bucket is internal-only, stated explicitly rather than left to default). template.yaml (AWS SAM) defines the compute layer: 3 IAM roles, 4 processing/ingestion Lambdas plus dbt-runner, EventBridge rules. The S3 stack exports BucketName/BucketArn via CloudFormation Export; the compute stack consumes them via !ImportValue in every IAM policy and EventBridge rule that touches the bucket — one resource, one source of truth, zero hardcoded ARNs or duplicated bucket names across stacks.",
    approachEmphasis: ['never needs to know which source triggered it', 'one source of truth, zero hardcoded ARNs'],
    codeSamples: [
      {
        filename: 's3-buckets.yaml',
        language: 'yaml',
        content: `Outputs:
  BucketName:
    Description: Name of the raw ingestion bucket
    Value: !Ref MedicoordRawBucket
    Export:
      Name: medicoord-ingestion-bucket-name

  BucketArn:
    Description: ARN of the raw ingestion bucket
    Value: !GetAtt MedicoordRawBucket.Arn
    Export:
      Name: medicoord-ingestion-bucket-arn`,
      },
      {
        filename: 'template.yaml',
        language: 'yaml',
        content: `# One rule covers all three processors — fires when any processor
# publishes ProcessorComplete with status SUCCESS. dbt-runner never
# knows which source triggered it.
DbtRunnerRule:
  Type: AWS::Events::Rule
  Properties:
    Name: medicoord-dbt-runner-rule
    EventPattern:
      source:
        - medicoord.pipeline
      detail-type:
        - ProcessorComplete
      detail:
        status:
          - SUCCESS
    State: ENABLED
    Targets:
      - Id: DbtRunnerTarget
        Arn: !GetAtt DbtRunner.Arn

# Cross-stack reference — no hardcoded bucket ARN
S3Write:
  PolicyDocument:
    Statement:
      - Effect: Allow
        Action: s3:PutObject
        Resource: !Sub
          - '\${BucketArn}/*'
          - BucketArn: !ImportValue medicoord-ingestion-bucket-arn`,
      },
      {
        filename: 'dbt-runner/handler.py',
        language: 'python',
        content: `logger.info("Phase 1 — dbt run")
# ... run facilities_clean transform ...

logger.info("Phase 2 — dbt test")
# ... 13 automated data-quality tests, fails loudly on bad data ...

logger.info("Phase 3 — DB health checks (RPC)")
# ... medi_db_health_check: dead tuples, long-running queries, deadlocks ...`,
      },
    ],
    diagramSteps: [
      { title: 'Scheduled Ingestion', desc: 'An EventBridge Schedule rule fires an ingestion Lambda on a 7-day cadence, writes raw JSON to S3 under a source-specific prefix.', icon: 'ti ti-clock' },
      { title: 'S3 Event Trigger', desc: 'S3 Object Created, filtered by key prefix, directly invokes the matching processor Lambda. No polling, no orchestrator.', icon: 'ti ti-cloud-upload' },
      { title: 'Processor Fan-In Signal', desc: 'After a successful Supabase upsert, the processor publishes a ProcessorComplete/SUCCESS event to the default EventBridge bus.', icon: 'ti ti-git-merge' },
      { title: 'Shared Verification Gate', desc: 'One rule matches ProcessorComplete from any of the three processors and invokes dbt-runner once: transform, then 13 data-quality tests, then a live Supabase health check.', icon: 'ti ti-shield-check' },
    ],
    diagramImage: {
      src: eventDrivenFanOutDiagram,
      alt: 'Diagram of the event-driven pipeline: scheduled ingestion writes to S3, an S3 event triggers the matching processor, the processor signals completion on EventBridge, and a shared rule fans all three sources into one dbt-runner verification gate',
      caption: 'FIG 4.1: EVENT-DRIVEN FAN-OUT PIPELINE',
    },
    lessonsLearned: [
      {
        title: 'A stale bug stayed invisible for months because nothing was watching',
        body: "places-processor 404'd on its Supabase upsert on roughly 48% of invocations (15 of 31) over a 90-day historical window, with zero downstream impact: dbt-runner kept running clean on whichever processors succeeded, and no other source was blocked. The event-driven design's resilience — failures don't cascade — is also exactly why the bug went unnoticed for so long. Decoupling contains a fault; it doesn't surface it. The fix has held for the most recent 21 days (10 invocations, 0 errors) as of this write-up.",
      },
    ],
    tradeoff:
      "Only 1 of 3 ingestion sources is actually active in this pipeline today — er-wait-scraper and open-data-sync's EventBridge Schedule rules are disabled; the team moved ER-wait ingestion to a Railway background worker instead during Sprint 12, to avoid near-real-time Lambda cost overhead. This is architecture built for three sources, one active — stated directly rather than implied by omission. Separately: because the DbtRunnerRule pattern matches ProcessorComplete from any processor, two processors completing within the same window could trigger dbt-runner twice back-to-back. Not a correctness problem — the dbt models and health-check RPC are idempotent/read-only — but worth knowing if duplicate CloudWatch log entries for dbt-runner show up close together.",
    result: [
      { text: '31 places-processor invocations over 90 days; 0 errors in the most recent 21 days (10 invocations) — a historical Supabase-upsert 404 bug is confirmed fixed.', bold: ['31', '0', '21 days', '10'] },
      { text: '12 dbt-runner invocations over 90 days, 0 errors — the shared fan-in/verification gate holds regardless of which processor triggers it.', bold: ['12', '0'] },
    ],
    methodologyOrdered: true,
    methodology: [
      { text: 'CloudWatch GetMetricStatistics (AWS/Lambda, Invocations + Errors), 90-day window, weekly buckets, per function, live production AWS account.', bold: [] },
      { text: "CloudWatch Logs filter-log-events on places-processor's log group confirmed the 404 root cause: a urllib.request.urlopen call inside upsert_facilities(), not a third-party API key issue.", bold: [] },
      { text: 'A most-recent-21-days re-check (3 weekly buckets) confirmed the fix held: 10 invocations, 0 errors.', bold: ['21-days', '10', '0'] },
    ],
  },
```

- [ ] **Step 3: Type-check**

Run: `cd webapp && npx tsc -b`
Expected: no errors. (Per this repo's known quirk, use `tsc -b`, not `tsc --noEmit` — the latter false-negatives here.)

- [ ] **Step 4: Visual verification**

Run: `cd webapp && npm run dev`, open `/for-engineers/event-driven-fan-out-eventbridge-serverless-pipeline` (or navigate via the `/for-engineers` case study list).
Expected: page renders — summary, background, problem highlights (2), alternatives considered (2), approach with 3 code samples, diagram image + 4-step grid, lessons learned (1), tradeoff, result (2 bullets), methodology (3 bullets, ordered). No console errors.

- [ ] **Step 5: Commit**

```bash
git add webapp/src/data/caseStudies.ts webapp/src/assets/case-studies/event-driven-fan-out-eventbridge-serverless-pipeline.png
git commit -m "feat(case-studies): add event-driven fan-out case study"
```
