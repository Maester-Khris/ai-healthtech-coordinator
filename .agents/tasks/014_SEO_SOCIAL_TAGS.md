# Task: Social sharing meta tags (og:image, Twitter Cards, domain fix)

**ID:** 014
**Scope:** `frontend`
**Branch:** override — running directly on `preview`, not a `feat/` branch (explicit user instruction for this task only, does not change the general branching rule for future work)
**Tests required:** yes — extend the existing `assertBuildTimeCheck` in `webapp/scripts/prerender.mjs` (already checks title/description/rootHtml/h1) to also assert `og:image` and canonical/og:url use the correct domain per route

---

## Context

Reported: sharing the site link on LinkedIn shows no logo/preview image. Root cause confirmed by reading the actual template and prerender pipeline (not just the reported symptom):

- `webapp/index.html` has `og:title`, `og:description`, `og:type`, `og:url` — **no `og:image`** (one of only four *required* properties in the OG protocol spec, not an optional one).
- No Twitter Card tags anywhere (`twitter:card`, `twitter:title`, `twitter:description`, `twitter:image`) — same failure class, separate tag namespace some platforms (X/Twitter) don't fall back to `og:*` for.
- No `og:site_name`, and no `og:image:width`/`og:image:height`/`og:image:alt` (recommended alongside `og:image`, not required, but should ship together).
- **Confirmed domain bug** (verified against the live Vercel project via API, not assumed): the real production domain is `medicoord.nknext.dev` (project `medicoordai`, team `nkops-projects` — this is the actual domain in Vercel's `domains` list). `index.html`'s static `og:url`/canonical correctly uses it. But `webapp/scripts/prerender.mjs:19` hardcodes `https://medicoordai.com${route}` for every prerendered route's canonical/og:url — a domain that isn't registered on this Vercel account at all. Every prerendered page (`/`, `/privacy`, `/cookies`, `/data-disclosure`, `/for-investors`, `/for-engineers`, every `/for-engineers/:slug`) currently ships a wrong canonical/og:url.
- No dedicated social-image asset exists. `webapp/public/` only has `logo.png`/`logo-512.png` — square app icons (correctly used for favicon/apple-touch-icon/manifest already), not sized for a social card (~1200×630, ~1.91:1 aspect ratio LinkedIn/Facebook expect).
- Per-route image injection isn't wired even structurally: `webapp/src/entry-server.tsx`'s `render()` only returns `{ title, description, rootHtml }`; `prerender.mjs`'s `injectTemplate()` only swaps `title`/`description`/`og:title`/`og:description`/`og:url`/`canonical` — there's no image field anywhere in that pipeline to extend once a tag exists.
- No per-case-study image: even once general `og:image` support exists, each `/for-engineers/:slug` case study currently has no way to use its own cover/diagram image instead of one shared site-wide default.

No architecture/design work needed here — this is template content + a small build-script extension, not an interface or system design change.

## Acceptance Criteria

- [ ] One dedicated social-card image added at `webapp/public/og-image.png` (or per-case-study equivalents — see next item), 1200×630, reusing existing brand assets/colors (don't just upscale `logo.png` — center it on a proper 1200×630 canvas with brand background, or ask for a designed asset if one exists elsewhere in the repo/artifacts).
- [ ] `webapp/index.html` gets the full required + recommended tag set:
  - `<meta property="og:image" content="https://medicoord.nknext.dev/og-image.png" />`
  - `<meta property="og:image:width" content="1200" />`
  - `<meta property="og:image:height" content="630" />`
  - `<meta property="og:image:alt" content="MediCoord AI" />`
  - `<meta property="og:site_name" content="MediCoord AI" />`
  - `<meta name="twitter:card" content="summary_large_image" />`
  - `<meta name="twitter:title" content="..." />` (mirrors `og:title`)
  - `<meta name="twitter:description" content="..." />` (mirrors `og:description`)
  - `<meta name="twitter:image" content="https://medicoord.nknext.dev/og-image.png" />`
- [ ] `webapp/src/hooks/useDocumentHead.ts` extended to also set `twitter:title`/`twitter:description` per route (mirroring the existing `og:title`/`og:description` per-route behavior), so client-side navigation keeps them in sync too.
- [ ] `webapp/src/entry-server.tsx`'s `render()` return type extended to also read back whatever image value is set per route (default: the site-wide `og-image.png`; case studies may override — see next item), so the prerender step has something to inject.
- [ ] `webapp/scripts/prerender.mjs`'s `injectTemplate()` extended to replace `og:image`, `twitter:image`, `twitter:title`, `twitter:description` per route (same regex-replace pattern already used for the other tags).
- [ ] **Domain fix**: `prerender.mjs:19`'s hardcoded `https://medicoordai.com` replaced with `https://medicoord.nknext.dev` — this is a live bug fix (currently wrong on every prerendered page), not a new feature.
- [ ] Case-study pages (`/for-engineers/:slug`): decide and implement one of — (a) ship with the site-wide default `og-image.png` for now (acceptable, simplest, matches "no design work" framing), or (b) if `caseStudies.ts` already has a per-case-study cover/diagram image, wire that through as the per-route override. Default to (a) unless a suitable per-case-study image asset already exists — don't create new per-case-study art as part of this task.
- [ ] `npm run build` succeeds, `tsc -b` clean, and the extended `assertBuildTimeCheck` fails the build if any prerendered route is missing `og:image` or has the wrong domain in `canonical`/`og:url`.
- [ ] Manual check: paste the production URL into a LinkedIn Post Inspector (or Facebook Sharing Debugger) equivalent check and confirm the image renders (LinkedIn/Facebook cache old previews aggressively — may need their inspector's "scrape again" action, not just a fresh share, to see the fix).

## Out of Scope

- `og:locale` — optional, defaults to `en_US`, not worth adding until the site is actually localized.
- Prerendering/meta tags for authenticated app routes (`/app`, `/setup`, `/profile`, `/sandbox`) — unchanged from tasks 012/013's existing exclusion.
- Commissioning new per-case-study cover art — only wire the plumbing if suitable images already exist (see acceptance criteria above).
- Any change to `robots.txt`, `sitemap.xml`, JSON-LD schema, or analytics — already covered by task 012.

## Notes for Implementation

- This task runs directly on `preview`, per explicit instruction — not the usual `feat/` branch + PR flow tasks 012/013 used. Commit directly, don't create a feature branch for this one.
- The domain fix (`medicoordai.com` → `medicoord.nknext.dev` in `prerender.mjs`) was confirmed against the live Vercel project via the Vercel API (`medicoordai` project, `nkops-projects` team) — not a guess. `medicoordai.com` is not a domain registered on this account at all.
- LinkedIn/Facebook cache Open Graph data aggressively per URL — after deploying, use each platform's inspector/debugger tool to force a re-scrape rather than assuming a fresh share will show the new image immediately.
- Keep the image-injection extension symmetric with the existing title/description pattern already in `entry-server.tsx`/`prerender.mjs` — same shape, just one more field, not a new mechanism.
