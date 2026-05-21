# /start-sprint

Create a new feature branch from `preview`, update CHANGELOG.md to mark the sprint
as started, and commit the changelog entry.

## Invocation
```
/start-sprint "<sprint title>" <branch-name>
# example: /start-sprint "integrating observability" feat/observability
```

Both arguments are required. If either is missing, stop and report:
```
⛔ Both arguments required.
Usage: /start-sprint "<sprint title>" <branch-name>
```

---

## Step 1 — Validate arguments

- `SPRINT_TITLE` = first argument (quoted string) — e.g. `"integrating observability"`
- `BRANCH_NAME` = second argument — e.g. `feat/observability`

Validate `BRANCH_NAME` prefix. Must be one of:
`feat/`, `fix/`, `refactor/`, `chore/`, `docs/`

If prefix is invalid, stop and report:
```
⛔ Invalid branch name '<BRANCH_NAME>'.
Must start with: feat/, fix/, refactor/, chore/, or docs/
```

---

## Step 2 — Confirm starting point is `preview`

```bash
git branch --show-current
```

If the current branch is not `preview`, switch to it first:

```bash
git switch preview
git pull origin preview
```

If `git switch preview` fails (preview doesn't exist locally), stop and report:
```
⛔ Branch 'preview' not found locally.
Run: git fetch origin && git switch preview
```

If already on `preview`, just pull:
```bash
git pull origin preview
```

---

## Step 3 — Create and push feature branch

```bash
git checkout -b <BRANCH_NAME>
git push -u origin <BRANCH_NAME>
```

If the branch already exists remotely, stop and report:
```
⛔ Branch '<BRANCH_NAME>' already exists on origin.
Choose a different branch name or delete the existing one first.
```

Confirm branch is active:
```bash
git branch --show-current
# expected: <BRANCH_NAME>
```

---

## Step 4 — Update CHANGELOG.md

Read `CHANGELOG.md`. Locate the next planned sprint entry — it will have the marker:

```
**Not started.**
```

or

```
Not started.
```

Find the first section that matches `SPRINT_TITLE` (case-insensitive, partial match allowed).
If no match is found, find the first section marked "Not started" regardless of title.

Replace the status marker with:

```
**Started — <today's date YYYY-MM-DD> · branch: `<BRANCH_NAME>`**
```

Example — before:
```markdown
## [Next — Sprint 5] · Observability + Alerting

**Not started. Blocked on: nothing — can begin immediately on `preview` branch.**
```

After:
```markdown
## [Next — Sprint 5] · Observability + Alerting

**Started — 2026-05-15 · branch: `feat/observability`**
```

If `CHANGELOG.md` does not exist, stop and report:
```
⛔ CHANGELOG.md not found in repo root. Create it before starting a sprint.
```

---

## Step 5 — Commit the changelog update

```bash
git add CHANGELOG.md
git commit -m "chore(changelog): start sprint — <SPRINT_TITLE>"
```

This is the only file staged. Do not stage anything else.
Do not add Claude or any AI assistant as co-author.

---

## Step 6 — Report outcome

```
✓ Sprint started

Title:   <SPRINT_TITLE>
Branch:  <BRANCH_NAME>
Base:    preview
Commit:  <commit hash>

CHANGELOG.md updated — sprint marked as started.

Next steps:
  Run tasks with: /execute-task <task-filename>
  Close sprint with: /end-sprint "<pr message>"
```

---

## Hard Stops

| Condition | Action |
|---|---|
| Missing argument | Stop before any git command |
| Invalid branch prefix | Stop before any git command |
| `preview` branch not found locally | Stop after fetch suggestion |
| Branch already exists on remote | Stop after branch creation attempt |
| `CHANGELOG.md` not found | Stop before committing |
| No matching sprint section found in CHANGELOG | Warn, ask user to confirm which section to update, then proceed |