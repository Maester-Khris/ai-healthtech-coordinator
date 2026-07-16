# Task: SEO Foundations (robots/sitemap/canonical/schema/per-route meta/content depth)

**ID:** 012
**Scope:** `frontend`
**Branch:** `feat/seo-foundations` — create before running this task (cut from `preview`)
**Tests required:** no (static assets + a small hook; verify via build + manual check, not unit tests)

---

## Context

SEOptimer audit of `medicoord.nknext.dev` (2026-07-15, `artifacts/seoanalyze.png`) scored the site C+ overall: On-Page SEO A-, GEO F, Links F, Usability C+, Performance A+. Reading the actual code (not just the audit tool) surfaced the real root causes:

- No `webapp/public/robots.txt` exists. `webapp/vercel.json` rewrites every path to `/index.html`, so `/robots.txt` currently returns the SPA shell with a `200` — which is why the audit tool believes one "exists." Same will be true of `/sitemap.xml` today.
- `webapp/index.html` has no `<link rel="canonical">`.
- Only `SoftwareApplication` JSON-LD is present. No `Organization`/`Identity` schema (GEO flag), no `LocalBusiness` schema (Local SEO flag — this is a Toronto-specific service, per `.agents/product-marketing.md`).
- All 11 routes in `webapp/src/App.tsx` (`/`, `/privacy`, `/cookies`, `/data-disclosure`, `/for-investors`, `/for-engineers`, `/for-engineers/:slug`, ...) share the exact same static `<title>`/meta description/JSON-LD from `index.html` — there is no per-route head management (`react-helmet` etc. not in `package.json`). Case studies and the investors page are effectively invisible as distinct content to search/AI.
- No analytics tool detected.
- Homepage text content is thin (443 words) — flagged as "thin content" by the audit.

This task covers everything that does **not** require touching the build/rendering pipeline. See task 013 for the prerendering work (GEO score, mobile performance) — that's a separate, riskier change and is out of scope here.

## Acceptance Criteria

- [ ] `webapp/public/robots.txt` added: allow all, `Sitemap:` directive pointing at the production sitemap URL, explicit allow for `GPTBot`, `ChatGPT-User`, `PerplexityBot`, `ClaudeBot`, `anthropic-ai`, `Google-Extended`, `Bingbot`.
- [ ] `webapp/public/sitemap.xml` added listing public marketing routes only (`/`, `/privacy`, `/cookies`, `/data-disclosure`, `/for-investors`, `/for-engineers`, plus known case-study slugs) — not the authenticated app routes.
- [ ] `<link rel="canonical" href="https://medicoordai.com/">` added to `webapp/index.html` (confirm production domain with user before hardcoding — see Notes).
- [ ] JSON-LD in `index.html` extended to a `@graph` with `Organization` (name, url, logo, sameAs if any real profiles exist — do not fabricate social links) and `LocalBusiness`/`MedicalBusiness`-appropriate type with Toronto service area, alongside the existing `SoftwareApplication` entry.
- [ ] Visible address/phone (or clear "no physical location — web service" framing if there isn't one — do not fabricate a business address) added somewhere crawlable on the homepage/footer to satisfy NAP consistency, matching whatever the `LocalBusiness` schema claims.
- [ ] A small `useDocumentHead(title, description)` hook added (plain `useEffect` + `document.title` / meta tag `setAttribute`, no new npm dependency) and wired into each page component so routes have distinct titles/descriptions. Confirm this is acceptable to the user before wiring — see Notes.
- [ ] Analytics tool wired in (GA4 or whatever is already decided elsewhere in the project — check before adding a new one) guarded by the existing Doppler env var pattern.
- [ ] Homepage content expanded past the "thin content" threshold with genuinely useful additions: an FAQ block (+ `FAQPage` schema) and a "how it works" step block (+ `HowTo` schema), not filler text.
- [ ] `npm run build` succeeds, `tsc -b` clean (per project memory: `tsc --noEmit` is a known false-negative in this repo — use `tsc -b`).
- [ ] Manual check: `robots.txt` and `sitemap.xml` served as their real static content (not the SPA shell) after `vite build` + preview.

## Out of Scope

- Prerendering / SSR for any route (task 013).
- Backlink / link-building strategy (off-site, not a code task).
- Facebook Pixel, X Cards, social profile links (low priority per audit, no current social presence to link).
- DMARC/SPF DNS records (no transactional email sending in Phase 1 scope — revisit if that changes).
- Any change to `/app`, `/setup`, `/profile`, `/sandbox` (authenticated, non-indexable routes).
- Fixing mobile PageSpeed score (52) — largely a rendering-pipeline problem, covered by task 013.

## Notes for Implementation

- Confirm production canonical domain (`medicoordai.com`, taken from the existing `og:url`/schema `url` field in `index.html`) before hardcoding it anywhere.
- Don't invent business details: if there's no public-facing office/phone, say so explicitly in the schema/footer copy rather than fabricating NAP data — fabricated LocalBusiness schema is a Google guidelines violation risk.
- The `useDocumentHead` hook only helps crawlers/agents that execute JS (Googlebot, GPTBot). It does not fix the fundamental CSR-invisibility problem for non-rendering bots or the GEO score — that's task 013's job. Don't oversell this task's impact on the GEO `F` grade.
- Read `.agents/product-marketing.md` before writing any new copy (FAQ, LocalBusiness description) — it has the positioning, tone, and differentiators already worked out.
