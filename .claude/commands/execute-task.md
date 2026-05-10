# /execute-task

Execute a defined task from the `.agents/tasks/` folder with planning, implementation, and a clean git commit.

## Invocation
```
/execute-task <task-filename>
# example: /execute-task 001-backend-skeleton.md
```

---

## Step 1 — Read the Task

Read `.agents/tasks/<task-filename>` in full before doing anything else.
If the file does not exist, stop and report:
`⛔ Task file not found: .agents/tasks/<task-filename>`

---

## Step 2 — Load Context

Before writing the plan, read the key repo files to build an accurate picture of the
codebase. Skip any file already present in the current context window — do not re-read
what is already there.

### Always read (if not already in context)

- `AGENTS.md`
- `.claude/CLAUDE.md`
- `docs/ARCHITECTURE.md`
- `docs/API.md`
- `shared/types.ts` — if it exists

### Read conditionally based on task scope

| Task touches | Also read |
|---|---|
| `backend/` | All files under `docs/ADR/` — scan for decisions that affect this task |
| `frontend/` or `webapp/` | Scan `webapp/src/` top-level structure |
| API contract or types | `shared/types.ts` and `backend/models.py` side by side |
| CI/CD or deployment | List existing files under `.github/workflows/` |
| Any file that already exists | Read that specific file in full before planning changes to it |

### Confirm what was loaded

After reading, output one line before writing the plan:

```
Context loaded: AGENTS.md, CLAUDE.md, ARCHITECTURE.md, API.md, shared/types.ts [+ any extras]
```

If a key file is missing, note it explicitly:

```
⚠️ shared/types.ts not found — will flag in plan if contract changes are needed.
```

---

## Step 3 — Plan

Write a structured execution plan based on loaded context. Do not write any code yet.

### Plan format

```
## Plan: <task name>

### Context notes
One or two sentences on what the loaded files revealed that shapes this plan.
Call out any conflict between the task description and what the codebase actually contains.

### Files to create
- <path> — <one line reason>

### Files to modify
- <path> — <one line reason>

### Files that will NOT be touched
- <anything adjacent that might seem relevant but is out of scope>

### API / type contract impact
Does this task change shared/types.ts or any endpoint in docs/API.md?
→ YES: describe the exact change. shared/types.ts must be updated before anything else.
→ NO: state "No contract changes."

### Open questions
Anything genuinely ambiguous that requires a decision before proceeding.
If none, write "None — proceeding."
```

**Stop after writing the plan. Wait for approval.**
A simple "go", "yes", or "looks good" is sufficient.
If the user modifies the plan, revise and wait again before implementing.

---

## Step 4 — Implement

Execute the approved plan step by step.

Rules during implementation:
- Follow conventions in `AGENTS.md` and `.claude/CLAUDE.md`
- TypeScript: strict mode, no `any`, all props typed with explicit interfaces
- Python: type hints on all function signatures, Pydantic models for all request/response bodies
- If a new env var is needed: add it to `.env.example` before using it anywhere
- If a new package is needed: note it, add to `package.json` or `requirements.txt`
- Never hardcode secrets, API keys, or credentials
- If a necessary change falls outside the approved scope: stop, flag it, do not proceed silently

---

## Step 5 — Tests (conditional)

Run this step only if:
- The task file specifies `Tests required: yes`, **or**
- The user explicitly requests tests when invoking the command

Run with Doppler env injection:
```bash
doppler run -- pytest <path>       # Python
doppler run -- npm run test        # Frontend
```

Do not commit if tests are failing. Fix first, then proceed to Step 6.

---

## Step 6 — Outcome Summary

Write a concise summary before committing:

```
## Outcome: <task name>

Done: <what was implemented — one sentence per item>
Files changed: <explicit list>
Contract changes: <yes/no — if yes, describe>
Packages added: <list or "none">
Deferred: <anything from the task not done, and why>
Known issues: <anything to flag for follow-up, or "none">
```

---

## Step 7 — Git Commit

### 7a — Branch check (run before staging anything)

```bash
git branch --show-current
```

**If the result is `main` or `preview`:**
Stop immediately. Do not stage or commit anything.
Report:
```
⛔ On protected branch '<branch>'. Create a feature branch first:
git checkout -b feat/<short-description>
```

**If the branch is safe:** proceed to 7b.

### 7b — Stage explicitly

```bash
# Name every file — never use git add . or git add -A
git add <file1> <file2> ...

# Review what is staged before committing
git diff --staged --stat
```

### 7c — Commit

```bash
git commit -m "<type>(<scope>): <short description>"
```

Commit message rules:
- **Type:** `feat` | `fix` | `chore` | `docs` | `refactor` | `test`
- **Scope:** primary area changed — `backend`, `frontend`, `shared`, `docs`, `ci`, `agents`
- **Description:** lowercase, imperative mood, no trailing period, max 72 characters total

Good examples:
```
feat(backend): add /triage endpoint with parallel tool dispatch
chore(shared): define TriageResult and Facility types
fix(frontend): align severity labels with canonical schema
docs(adr): record decision to drop Vertex AI classifier
refactor(backend): extract llm provider into abstraction layer
```

**Never:**
- Add a Claude or any AI assistant as a git co-author
- Use `git add .` or `git add -A`
- Push — commit only, pushing is the developer's responsibility

---

## Hard Stops

Abort and report clearly if any of the following are true:

| Condition | Report |
|---|---|
| Task file not found | `⛔ Task file not found: .agents/tasks/<filename>` |
| Current branch is `main` or `preview` | `⛔ On protected branch. Create a feature branch first.` |
| Required change falls outside approved plan | `⛔ Out-of-scope change required. Flagging before proceeding.` |
| Contract change without updating `shared/types.ts` first | `⛔ Contract change detected. Update shared/types.ts first.` |
| API key or secret pattern found in staged files | `⛔ Potential secret in staged files. Aborting commit.` |