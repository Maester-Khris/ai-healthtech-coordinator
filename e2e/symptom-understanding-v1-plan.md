# E2E Test Plan — Symptom Understanding v1 (`GRAPH_RAG_PROVIDER=static`)

Validates the feature built on `feat/symptom-understanding-v1` against the real chat
UI + real backend, before merging to `preview`. Companion script:
`e2e/symptom-understanding-v1.sh`.

## Why this can't be a unit test

The graph-context block is injected into the LLM's *system prompt* — it influences
which follow-up questions the LLM asks, but the LLM's exact wording isn't
deterministic. What's deterministic and checkable end-to-end:
- the chat UI still works at all with the feature on (no crash, no regression)
- the backend actually performed a lookup for a given turn (`graph_context_matched`
  log line, added in Task 8 of the implementation plan specifically so this would be
  observable) — the log line is the test oracle, not the LLM's prose
- the turn-level union (design §5) actually fires on a live multi-turn conversation,
  not just against synthetic fixtures in `test_static_provider.py`

## Prerequisites

- Doppler configured for this project (`doppler setup`), since `SUPABASE_URL` /
  `UPSTASH_REDIS_URL` / LLM provider keys are required for the backend to boot at all.
- `playwright-cli` installed globally (already confirmed present).
- A real Chrome install for `--remote-debugging-port` (not Playwright's bundled
  Chromium) — this is what makes it "Chrome web debugging" rather than a headless
  Playwright browser: you watch the same window the script drives.
- A **persistent Chrome profile, logged in once manually.** The chat textarea is
  gated on `user` (`webapp/src/Menucomponents/subcomponent/ChatPanel.tsx:475` —
  placeholder switches to "Sign in to start a conversation" when logged out), and
  login is Supabase email/password (`LoginModal.tsx`). Rather than scripting
  credentials, log in once by hand in the profile the script will reuse
  (`~/.cache/medicoord-e2e-chrome-profile` below) — every subsequent run of the
  script starts already authenticated. If you'd rather script the login instead
  (e.g. for eventual CI), say so and I'll add a credentials-driven variant.

## What GRAPH_RAG_PROVIDER=static actually needs to observe

From the implementation: `StaticLookupProvider` matches on the *entire* alias/name
string appearing verbatim in the message (`graph/static_provider.py`). Real content
check from Task 5 (already logged in
`artifacts/2026-07-23-symptom-understanding-v1-research-references.md` §4): plain
`"I have chest pain"` does **not** match complaint 003 today (its aliases are
clinical synonyms, not short phrases) — but `"angina"` does, verified directly
against the real generated `symptom_triage_data.json`. Scenario A below uses
`"angina"` for exactly this reason — not because it's the most natural phrasing, but
because it's the one confirmed-working trigger phrase, so a scenario failure means
the *code* broke, not that today's alias content happens not to cover this wording.

## Scenarios

**Scenario A — match fires, turn-level union carries it forward**
1. Turn 1: `"angina"` → expect `graph_context_matched` in the backend log with
   `complaint_name=Chest pain (cardiac features)`.
2. Turn 2: `"it started about an hour ago"` (no symptom keyword on its own) → expect
   `graph_context_matched` to fire **again** — this is the design §5 fix: turn 1's
   match must still be visible via the `recent_messages` window, not silently dropped.
3. Continue answering the LLM's own follow-up questions (duration/severity/associated
   symptoms — see `TRIAGE_SYSTEM_PROMPT` in `backend/llm/prompts.py`) until
   `TriageCard` renders (`showTriageCard = triage.active && lastMsg.role ===
   "assistant"`, `ChatPanel.tsx:190`) — confirms the feature doesn't break the
   existing triage-completion flow.

**Scenario B — no match, no false positive**
1. Fresh session. Turn 1: `"I have a mild headache"` (deliberately not in the
   lookup table) → expect **no** `graph_context_matched` line for this turn.
2. Confirm the chat still completes triage normally — the null/no-match path must be
   invisible to the user, not just to the log.

**Scenario D — flag off, full regression baseline**
Restart the backend with `GRAPH_RAG_PROVIDER` unset (or `off`). Repeat Scenario A's
turn 1 (`"angina"`). Expect: chat behaves identically to pre-feature baseline, **zero**
`graph_context_matched` lines anywhere in the log — proves `NullGraphProvider` is a
true no-op live, not just in `test_factory.py`.

## Success criteria

| Check | Scenario | Pass condition |
|---|---|---|
| Chat completes end-to-end with feature on | A, B | `TriageCard` renders, no console errors |
| Match fires on the matching turn | A | `graph_context_matched` with correct `complaint_name` |
| Match carries forward via turn union | A | `graph_context_matched` fires again on turn 2 |
| No false-positive match | B | zero `graph_context_matched` lines for the headache turn |
| Flag-off is a true no-op | D | zero `graph_context_matched` lines for the whole run |
| No regressions vs. pre-feature behavior | D | chat UI behaves identically to a `git stash` baseline (spot-check, not automated) |

## Known limitation this plan intentionally does not chase

Per the research artifact §4, most red flags in the real data carry
`"followup_question": "NEEDS_AUTHORING"` (588 of them). `build_graph_context_block()`
currently has **no filter for this placeholder** — Task 8's plan flagged this exact
gap as a fast-follow, not solved in this branch. If Scenario A's follow-up questions
look like they're asking the LLM to relay the literal string `NEEDS_AUTHORING`,
that's this known, already-tracked gap surfacing live — not a new bug to chase here.
Worth fixing before this ever reaches production, but out of scope for this E2E pass.
