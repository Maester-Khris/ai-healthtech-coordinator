# Task Template

Copy this file to define a new task. Name it `NNN-short-description.md`.
Tasks are executed via `/execute-task <filename>` in Claude Code.

---

## Task: <Name>

**ID:** NNN  
**Scope:** `backend` | `frontend` | `shared` | `docs` | `ci` | `full-stack`  
**Branch:** `feat/<short-description>` — create before running this task  
**Tests required:** yes | no

---

## Context
Why this task exists. What problem it solves. Link to ADR or prior decision if relevant.

## Acceptance Criteria
- [ ] Criterion one — specific and verifiable
- [ ] Criterion two
- [ ] TypeScript compiles with zero errors
- [ ] No hardcoded secrets
- [ ] New env vars added to `.env.example`
- [ ] `shared/types.ts` updated if API contract changes

## Out of Scope
List explicitly what should NOT be done in this task, even if it seems related.

## Notes for Implementation
Any decisions already made, patterns to follow, or files to read first.