# Case Study 4 — Event-Driven Fan-Out (S3 → Lambda → EventBridge → dbt) — Design

## Goal

Add a 4th `/for-engineers` case study documenting the AWS data pipeline's (Sprint 12)
serverless orchestration design: independent ingestion sources fan out through native
S3/EventBridge event triggers — no central orchestrator — and fan back in on one shared
dbt-runner that acts as a transform + data-integrity + live-DB-health checkpoint. The
IaC composition itself (two CloudFormation stacks, cross-stack output reuse) is shown,
not just described, matching how CS1–CS3 always pair prose with real code.

Origin: reviewing a separate resume/JD-tailoring exercise flagged IaC as a scoring gap,
despite this repo having real CloudFormation + SAM infrastructure already shipped and
running. This case study is the evidence.

This is a content-only addition. No application code changes — `webapp/src/data/caseStudies.ts`
gains one new entry, plus a new diagram asset.

## Scope

**In scope:**
- One new `CaseStudy` object appended to `webapp/src/data/caseStudies.ts`
- One new diagram image asset (png + svg, matching the existing 3 case studies' asset pattern)
- Real CloudWatch metrics as the evidence section (pulled directly from the live AWS account)

**Out of scope:**
- Any change to the actual pipeline infrastructure or Lambda code (this documents what
  already shipped in Sprint 12/PR #21, doesn't change it)
- The GraphRAG case study and the LLM-eval-faithfulness case study — separate specs, next
- Fixing/re-verifying the historical 404 bug (already confirmed fixed, 21 days clean)

## Metadata

| Field | Value |
|---|---|
| `slug` | `event-driven-fan-out-eventbridge-serverless-pipeline` |
| `navSection` | `infrastructure` |
| `category` | `Serverless Pipeline Orchestration` |
| `accent` | `blue` (alternates against CS3's `mint`) |
| `icon` | New Phosphor import — `FlowArrow` (not yet used by CS1–3: `TreeStructure`, `Compass`, `ChartLineUp`) |
| `tags` | `#AWS` `#IaC` `#EventBridge` `#Serverless` |
| `readTimeMinutes` | 7 |
| `publishedDate` | `2026-06-16` (Sprint 12 ship date, per CHANGELOG PR #21) |
| `updatedDate` | `2026-07-14` (this case study's write date) |
| `author` | `MediCoord Core Platform Team` (consistent with CS1–3) |

## Narrative content

**Summary**: Decoupling a multi-source ingestion pipeline into independent Lambda stages
using native S3 and EventBridge event triggers instead of a Step Functions orchestrator
or a polling coordinator — so a failure in one processor never blocks the others, and a
completion signal from any of three independent sources fans into one shared
transform → integrity-test → live-health checkpoint.

**Background**: Three independent external sources (Places, ER-wait, Open Data) each need
fetch → S3 landing → process/upsert → shared dbt transformation before the data is usable
for triage routing. Coordinating three sources that get added, disabled, or moved
independently over time (ER-wait was later moved to a Railway worker, Sprint 12) is a
different problem than coordinating a single fixed pipeline.

**Problem**: A central orchestrator has to know about every source up front — adding or
retiring a source means editing shared orchestration state, not just adding/removing an
independent resource. And a failure in one source's processor shouldn't block or freeze
the sources that are healthy.

**Problem highlights**:
- *Central Orchestrator = Central Coupling* — a Step Functions state machine (or any
  central coordinator) has to know about every source up front; adding a 4th source means
  editing the orchestrator's definition, not just adding an independent stack resource.
- *One Failure Shouldn't Freeze the Rest* — if one source's processor starts failing, that
  can't block a healthy source's processor from running or the shared dbt-runner from
  firing on the sources that did succeed.

**Alternatives considered**:
- *Step Functions state machine* — rejected: its centralized definition doesn't match how
  sources actually get added/retired over time (ad hoc, sometimes disabled entirely, as
  ER-wait was). Editing a state machine to add/remove a branch is more coupling than the
  problem needs.
- *Polling/cron-based coordinator* — rejected: a periodic Lambda or status-table poll adds
  latency and a dedicated moving part solely for coordination that S3/EventBridge already
  provides natively, at no extra cost.

**Approach** (two parts — orchestration, then infrastructure composition):

*Orchestration*: S3 `Object Created` events, filtered by key prefix (`raw/places/`,
`raw/er-wait/`, `raw/open-data/`), trigger the matching processor Lambda directly — no
orchestrator in between. Each processor publishes a custom `ProcessorComplete` event
(`status: SUCCESS`, source `medicoord.pipeline`) to the default EventBridge bus after a
successful Supabase upsert. One `DbtRunnerRule` matches that event pattern regardless of
which of the three processors fired it, fanning all three into a single shared
`dbt-runner` that never needs to know which source triggered it. Once triggered,
`dbt-runner` runs three phases, not one: **Phase 1** `dbt run` (transforms
`facilities_clean`), **Phase 2** `dbt test` (13 automated data-quality tests, 13/13
passing — an integrity gate, not just a transform), **Phase 3** the `medi_db_health_check`
Supabase RPC (dead tuples, long-running queries, deadlocks — a live database health check,
not a pipeline-internal check). IAM backs the whole chain with three least-privilege
roles: ingestion (SSM read + S3 write + logs), processor (S3 read + logs + EventBridge
publish scoped to the default bus), dbt-runner (logs only — Supabase access is HTTPS with
env-injected credentials, no AWS resource access needed).

*Infrastructure composition*: the pipeline is defined across two separate CloudFormation
stacks, not one. `s3-buckets.yaml` (plain CloudFormation) defines the landing bucket with
native `EventBridgeConfiguration` (S3→EventBridge without the manual console toggle that
was tried first and abandoned), a 30-day lifecycle expiry (raw files are transient — cost
hygiene, not an afterthought), and a full `PublicAccessBlockConfiguration` (this bucket is
internal-only, stated explicitly rather than left to default). `template.yaml` (AWS SAM)
defines the compute layer — 3 IAM roles, 4 processing/ingestion Lambdas plus dbt-runner,
EventBridge rules. The S3 stack exports `BucketName`/`BucketArn` via CloudFormation
`Export`; the compute stack consumes them via `!ImportValue` in every IAM policy and
EventBridge rule that touches the bucket — one resource, one source of truth, zero
hardcoded ARNs or duplicated bucket names across stacks.

**Approach emphasis** (bolded phrases): `"never needs to know which source triggered it"`,
`"one source of truth, zero hardcoded ARNs"`

**Code samples** (real excerpts, 2–3 files):
1. `s3-buckets.yaml` — the `Outputs`/`Export` block
2. `template.yaml` — the `DbtRunnerRule` EventBridge pattern (matches `ProcessorComplete`
   from any processor) and one `!ImportValue` usage (e.g. `IngestionRole`'s `S3Write` policy)
3. Optionally: `dbt-runner/handler.py`'s three `logger.info("Phase N — ...")` lines as a
   minimal illustration of the 3-phase gate (not the full multiprocessing-patch code, which
   is implementation noise unrelated to this case study's point)

**Diagram steps** (4, matching CS3's format):
1. *Scheduled Ingestion* — an EventBridge Schedule rule fires an ingestion Lambda (e.g.
   `places-enricher`) on a 7-day cadence, writes raw JSON to S3 under a source-specific prefix.
2. *S3 Event Trigger* — S3 `Object Created`, filtered by key prefix, directly invokes the
   matching processor Lambda. No polling, no orchestrator.
3. *Processor Fan-In Signal* — after a successful Supabase upsert, the processor publishes
   a `ProcessorComplete`/`SUCCESS` event to the default EventBridge bus.
4. *Shared Verification Gate* — one EventBridge rule matches `ProcessorComplete` from any
   of the three processors and invokes `dbt-runner` once: transform → 13 data-quality
   tests → live Supabase health check.

**Diagram image**: new asset needed —
`webapp/src/assets/case-studies/event-driven-fan-out-eventbridge-serverless-pipeline.png`
(+ `.svg`), matching the existing 3 assets' visual style. **Open item, implementation
phase**: no diagram tool run yet; likely built via the excalidraw skill mirroring CS3's
diagram composition (4 numbered steps, arrows, S3/Lambda/EventBridge icons).

**Lessons learned**:
- *A stale bug stayed invisible for months because nothing was watching* —
  `places-processor` 404'd on its Supabase upsert on ~48% of invocations (15/31) over a
  90-day historical window, with zero downstream impact: `dbt-runner` kept running clean
  on whichever processors succeeded, and no other source was blocked. The event-driven
  design's resilience — failures don't cascade — is also exactly why the bug went
  unnoticed for so long. Decoupling contains a fault; it doesn't surface it. The fix has
  held for the most recent 21 days (10 invocations, 0 errors) as of this write-up
  (2026-07-14).

**Tradeoff** (stated plainly, not hidden):
Only 1 of 3 ingestion sources is actually active in this pipeline today —
`er-wait-scraper` and `open-data-sync`'s EventBridge Schedule rules are disabled
(`Enabled: false` in `template.yaml`); the team moved ER-wait ingestion to a Railway
background worker instead during Sprint 12, to avoid near-real-time Lambda cost overhead.
This is "architecture built for three sources, one active" — stated directly rather than
implied by omission. Separately: because the `DbtRunnerRule` pattern matches
`ProcessorComplete` from *any* processor, two processors completing within the same
window could trigger `dbt-runner` twice back-to-back. Not a correctness problem — the dbt
models and health-check RPC are idempotent/read-only — but worth knowing if duplicate
CloudWatch log entries for `dbt-runner` show up close together.

## Evidence (methodology + result)

Pulled live via `aws cloudwatch get-metric-statistics` against account `891377252836`
(`us-east-1`), 90-day window ending 2026-07-14, `AWS/Lambda` `Invocations`/`Errors` per
function. Cross-checked against CloudWatch Logs (`filter-log-events`, pattern `ERROR`) to
identify the actual 404 root cause rather than assume it.

**Methodology bullets**:
- CloudWatch `GetMetricStatistics` (`AWS/Lambda`, `Invocations` + `Errors`), 90-day window,
  weekly buckets, per function, live production AWS account
- CloudWatch Logs `filter-log-events` on `places-processor`'s log group to confirm the
  404 root cause (a `urllib.request.urlopen` call inside `upsert_facilities()`, not a
  third-party API key issue)
- Most-recent-21-days re-check (3 weekly buckets) to confirm the fix held

**Result bullets**:
- **31** `places-processor` invocations over 90 days; **0 errors in the most recent 21
  days** (10 invocations) — a historical Supabase-upsert 404 bug (15/31 historically,
  root-caused to a stale REST path, not an API key) is confirmed fixed
- **12** `dbt-runner` invocations over 90 days, **0 errors** — the shared fan-in/verification
  gate holds regardless of which processor triggers it
- `er-wait-*`/`open-data-*` functions show 0–3 invocations total over the same window —
  consistent with, not contradicting, the stated tradeoff that those sources are disabled

## File placement

- `webapp/src/data/caseStudies.ts` — append the new `CaseStudy` object (4th entry, after
  CS3) and the two new icon/diagram imports at the top of the file
- `webapp/src/assets/case-studies/event-driven-fan-out-eventbridge-serverless-pipeline.{png,svg}` — new

## Open questions / risks for the implementation plan

- Diagram asset generation is the one piece with no existing tool wired up in this repo's
  case-study workflow — the plan should call out how CS1–3's diagrams were originally
  produced (if that's discoverable) or default to the excalidraw skill
- `FlowArrow` icon needs confirming as an actual export of `@phosphor-icons/react` before
  it's used in the import statement
