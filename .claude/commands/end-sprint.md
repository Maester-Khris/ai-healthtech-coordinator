# /end-sprint

Commit all unstaged work on the current feature branch, push, and open a PR to `preview`.

## Invocation
```
/end-sprint "<pr message>"
# example: /end-sprint "facilities prefetch with in-memory cache and ETag"
```

The PR message argument is required. If not provided, stop and report:
`⛔ PR message required. Usage: /end-sprint "<message>"`

---

## Step 1 — Branch check

```bash
git branch --show-current
```

Store the result as `CURRENT_BRANCH`.

**If `CURRENT_BRANCH` is `main` or `preview`:**
Stop immediately. Do not stage, commit, or push anything.
Report:
```
⛔ On protected branch '<CURRENT_BRANCH>'.
/end-sprint must be run from a feature branch (feat/, fix/, refactor/, chore/, docs/).
```

**If `CURRENT_BRANCH` is any other value:** proceed.

---

## Step 2 — Inspect working tree

```bash
git status --short
```

Three possible states:

**A — Nothing to commit (clean tree):**
```
# git status --short returns empty output
```
Skip Steps 3 and 4. Proceed directly to Step 5 (push).

**B — Unstaged or untracked changes present:**
Proceed to Step 3.

**C — Already staged but not committed:**
Proceed to Step 4 directly (skip `git add`).

---

## Step 3 — Stage all changes on this branch

```bash
# Stage all modified and untracked files
# /end-sprint is an explicit sprint termination — git add . is permitted here
# because the intent is to commit everything remaining
git add .

# Confirm what was staged
git diff --staged --stat
```

Report what was staged before committing.

---

## Step 4 — Commit staged changes

Infer the commit type from the branch name prefix:

| Branch prefix | Commit type |
|---|---|
| `feat/` | `feat` |
| `fix/` | `fix` |
| `refactor/` | `refactor` |
| `chore/` | `chore` |
| `docs/` | `docs` |
| anything else | `chore` |

Extract the scope from the branch name — the part after the `/`:
`feat/backend-api` → scope `backend-api`
`refactor/home-ui` → scope `home-ui`

```bash
git commit -m "<type>(<scope>): end-sprint snapshot — <CURRENT_BRANCH>"
```

Example for branch `feat/facilities-prefetch`:
```bash
git commit -m "feat(facilities-prefetch): end-sprint snapshot — feat/facilities-prefetch"
```

**Never add Claude or any AI assistant as co-author.**

---

## Step 5 — Push branch

```bash
git push -u origin <CURRENT_BRANCH>
```

If the branch already has upstream tracking, `git push` without arguments is fine.
If push fails, report the error and stop — do not attempt to force push.

---

## Step 6 — Open PR to `preview`

```bash
gh pr create \
  --base preview \
  --head <CURRENT_BRANCH> \
  --title "<type>(<scope>): <pr message>" \
  --body "Sprint close: <pr message>

Branch: \`<CURRENT_BRANCH>\`
Target: \`preview\`

## Changes
> Summarise the main changes committed in this sprint in 2-4 bullet points
> based on what was staged and committed in Steps 3-4 and any prior commits
> on this branch. Read the git log to generate this accurately.

\`\`\`bash
git log preview..<CURRENT_BRANCH> --oneline
\`\`\`

## Checklist
- [ ] TypeScript compiles clean
- [ ] No hardcoded secrets
- [ ] Ready for preview deployment"
```

The `--title` uses the same conventional commit format as the commit message.
The `--body` bullet points are generated from `git log preview..<CURRENT_BRANCH> --oneline`
— read the actual log, do not invent or guess what changed.

---

## Step 7 — Report outcome

```
✓ Sprint closed

Branch:  <CURRENT_BRANCH>
Commit:  <commit hash if new commit was made, or "none — tree was clean">
Pushed:  yes
PR:      <URL returned by gh pr create>
Target:  preview

Next steps:
  1. Review and merge the PR in GitHub
  2. git switch preview && git pull origin preview
  3. git branch -d <CURRENT_BRANCH>
  4. git push origin --delete <CURRENT_BRANCH>
  5. git checkout -b <next-branch> && git push -u origin <next-branch>
```

---

## Hard Stops

| Condition | Action |
|---|---|
| No PR message argument | Stop before doing anything |
| Branch is `main` or `preview` | Stop before doing anything |
| Push fails | Stop after push attempt — do not open PR |
| `gh` CLI not authenticated | Report: `⛔ GitHub CLI not authenticated. Run: gh auth login` |
| `gh pr create` fails because PR already exists | Report the existing PR URL and stop |