# Task: Prerender public marketing routes (GEO score, mobile performance)

**ID:** 013
**Scope:** `frontend` | `ci`
**Branch:** `feat/seo-prerender` — create before running this task (cut from `preview`), keep separate from `feat/seo-foundations`
**Tests required:** yes — at minimum a build-time check that each prerendered route's output HTML contains the route's expected `<title>` and main content string

---

## Context

Depends on task 012 being merged first (per-route `useDocumentHead` hook and canonical schema need to exist before prerendering has anything correct to snapshot).

The webapp is a pure CSR SPA: `webapp/index.html` renders `<div id="root">` and everything is injected by `webapp/src/main.tsx` / React. This is the actual root cause of two separate bad scores in the SEOptimer audit (`artifacts/seoanalyze.png`):

- **GEO grade F** — "Rendering Percentage: 1134%", meaning virtually all page content only exists after JS execution. The `ai-seo` skill is explicit that AI agents/crawlers that don't fully render JS see a blank page.
- **Mobile PageSpeed 52** (vs. 85 desktop) — First Contentful Paint 5.1s, Largest Contentful Paint 12.2s. On mobile CPU/network throttling, nothing can paint until the JS bundle downloads, parses, and executes, because there's no server-rendered content to show first.

Tech stack is Vite + React (non-negotiable per project CLAUDE.md — no framework migration to Next.js etc.). The fix here is a **build-time prerender step**, not a runtime SSR server: snapshot the fully-rendered HTML for public marketing routes only, so crawlers/agents/browsers get real content immediately, while the app remains a CSR SPA for everything behind it.

## Acceptance Criteria

- [ ] Evaluate and pick one lightweight prerender approach (do not add a heavy SSR framework):
  - Option A: `vite-react-ssg` used only for the static-output build step
  - Option B: a `puppeteer`/`playwright` post-build script that renders each target route in the built app and writes the resulting HTML to `dist/<route>/index.html`
  - Record the choice and why in the PR description.
- [ ] Routes prerendered: `/`, `/privacy`, `/cookies`, `/data-disclosure`, `/for-investors`, `/for-engineers`, `/for-engineers/:slug` for every known case-study slug. Authenticated/app routes (`/app`, `/setup`, `/profile`, `/sandbox`, `/test-notif`, `/testlocation`) are explicitly **not** prerendered — they stay CSR-only and are excluded from the sitemap.
- [ ] `webapp/vercel.json` rewrite rule updated so a static prerendered file at a matching path is served directly instead of falling through to the SPA `index.html` rewrite (static files already take precedence on Vercel — verify this holds once prerendered directories exist, don't assume).
- [ ] React hydrates cleanly on top of the prerendered HTML on first load (no hydration mismatch warnings in console for any prerendered route).
- [ ] Build-time check added (per "Tests required" above): fails the build if a prerendered route's HTML doesn't contain its expected `<title>` and a known content anchor string.
- [ ] Re-run (or ask user to re-run) the SEOptimer/PageSpeed check against a preview deploy of this branch and record before/after GEO + mobile PageSpeed numbers in the PR description.
- [ ] `npm run build` succeeds, `tsc -b` clean.

## Out of Scope

- Anything already covered by task 012 (robots.txt, sitemap.xml, canonical, schema, per-route head hook, analytics, homepage content depth) — this task assumes 012 is done and just adds the build-time snapshot layer on top of it.
- Prerendering or SSR for authenticated app routes.
- Full SSR / framework migration.
- Image/asset optimization beyond whatever prerendering incidentally improves (separate concern if mobile score is still low after this).

## Notes for Implementation

- This is explicitly the riskier, build-pipeline-touching half of the SEO work — that's why it's a separate branch/task from 012, per user instruction to keep git hygiene clean while on `main`.
- Whichever tool is picked, keep the footprint minimal: this only needs to snapshot ~6-10 static marketing routes, not turn the whole app into an SSG site.
- Confirm the `for-engineers` case-study slugs come from wherever they're currently sourced (check `caseStudies.ts` per existing Sonar CPD exclusion in recent commit history) before hardcoding a route list.
- If neither prerender option turns out to be a clean fit for the current Vite config, stop and report back rather than reaching for a bigger dependency — this task should not turn into a rewrite.
