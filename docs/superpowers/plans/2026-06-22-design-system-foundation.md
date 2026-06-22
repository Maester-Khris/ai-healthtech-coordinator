# Design System Foundation — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Land the merged design-system tokens (`ui-design/DESIGN-SYSTEM.md`) as real Tailwind v4 `@theme` tokens and `@utility` classes in `webapp/src/index.css`, so sub-projects 2–4 (landing/legal pages, web re-skin, mobile re-skin) have working utility classes to consume.

**Architecture:** Tailwind v4 generates utility classes directly from CSS custom properties declared in an `@theme` block (`--color-{name}` → `bg-{name}`/`text-{name}`/etc., `--radius-{name}` → `rounded-{name}`, `--font-{name}` → `font-{name}`). Composite multi-property presets (typography scales, the skeuomorphic card/bezel material) use Tailwind v4's `@utility` directive. Everything lands in the single existing `webapp/src/index.css` — no new files, matching the codebase's existing single-stylesheet convention.

**Tech Stack:** Tailwind CSS v4.1.8 (`@tailwindcss/vite` plugin, already installed), Google Fonts (Inter, JetBrains Mono — link-tag loading, same pattern already used for the dead Ubuntu font), Vite 6, Playwright MCP/CLI for visual verification.

## Global Constraints

- Token values must match `ui-design/DESIGN-SYSTEM.md` exactly (colors, type scale, spacing, radius).
- New token names must not collide with the existing legacy push-notification CSS vars in `webapp/src/index.css` (`--color-primary`, `--color-primary-light`, `--color-primary-dark`, `--color-background-info`, `--color-text-info`, `--color-surface`, `--color-text-primary`, `--color-text-secondary`, `--color-border`, `--color-step-bg`, `--color-warning-bg`, `--color-warning`, `--color-success-bg`, `--color-success`) — those vars are still consumed by `components/pwa/*` and stay untouched until sub-project 3 re-skins those components.
- No new npm dependencies (Tailwind v4 and Google Fonts link-tag loading are already in use).
- This sub-project does not touch any component file — `index.css` and `index.html` only.

---

### Task 1: Font loading + base @theme tokens

**Files:**
- Modify: `webapp/index.html:11` (Google Fonts link)
- Modify: `webapp/index.html:10` (theme-color meta)
- Modify: `webapp/src/index.css` (full rewrite — see step 3)

**Interfaces:**
- Produces (CSS custom properties / Tailwind utilities consumed by later tasks and by sub-projects 2–4):
  - Colors: `--color-stratum-bg`, `--color-stratum-surface`, `--color-stratum-accent`, `--color-stratum-accent-2`, `--color-stratum-accent-3`, `--color-stratum-neutral`, `--color-stratum-text`, `--color-stratum-text-muted`, `--color-stratum-border` → utilities `bg-stratum-bg`, `text-stratum-text`, `border-stratum-border`, etc.
  - Severity: `--color-severity-routine`, `--color-severity-moderate`, `--color-severity-urgent`, `--color-severity-emergent` → `bg-severity-emergent`, `text-severity-urgent`, etc.
  - Sandbox: `--color-sandbox-bg`, `--color-sandbox-surface`, `--color-sandbox-text`, `--color-sandbox-text-muted`, `--color-sandbox-border` → `bg-sandbox-bg`, `text-sandbox-text`, etc.
  - Fonts: `--font-sans` (Inter), `--font-mono` (JetBrains Mono) → `font-sans`, `font-mono` utilities (these override Tailwind's built-in default font stack keys).
  - Radius: `--radius-xs` (2px) through `--radius-bezel` (15px) → `rounded-xs` … `rounded-bezel`.
  - Spacing: `--spacing-card-padding` (16px), `--spacing-section-padding-sm` (24px), `--spacing-section-padding-lg` (56px) → `p-card-padding`, `gap-card-padding`, `p-section-padding-sm`, etc.

- [ ] **Step 1: Replace the dead Ubuntu Google Fonts link and theme-color meta in `webapp/index.html`**

Find this line (currently line 10-11):
```html
  <meta name="theme-color" content="#185FA5">
  <link href="https://fonts.googleapis.com/css2?family=Ubuntu&family=Ubuntu+Mono&display=swap" rel="stylesheet">
```

Replace with:
```html
  <meta name="theme-color" content="#EAE5DF">
  <link href="https://fonts.googleapis.com/css2?family=Inter:wght@200;300;400;500;600&family=JetBrains+Mono:wght@500;600&display=swap" rel="stylesheet">
```

- [ ] **Step 2: Verify no code references the dead fonts before deleting their CSS**

Run: `cd webapp && grep -rn "quicksand\|fredoka\|Ubuntu" src --include="*.tsx" --include="*.ts" -i`
Expected: no output (already confirmed empty during planning — this step re-confirms before deletion in case something changed).

- [ ] **Step 3: Rewrite `webapp/src/index.css`**

Replace the entire file content with:

```css
@import "tailwindcss";

/* ============================================================
   MediCoord AI — Design System tokens
   Source of truth: ui-design/DESIGN-SYSTEM.md
   Stratum (light, warm, "calculated skeuomorphism") is the base
   palette/material everywhere except Sandbox, which uses Aura's
   dark palette (see --color-sandbox-* below).
   ============================================================ */
@theme {
  /* Stratum base palette */
  --color-stratum-bg: #EAE5DF;
  --color-stratum-surface: #A3907A;
  --color-stratum-accent: #A3907A;
  --color-stratum-accent-2: #8C8273;
  --color-stratum-accent-3: #A1AE7A;
  --color-stratum-neutral: #7A756D;
  --color-stratum-text: #3D3A35;
  --color-stratum-text-muted: #7A756D;
  --color-stratum-border: #DCD6CC;

  /* Severity ramp — reserved for severity states only (markers, badges, triage cards) */
  --color-severity-routine: #6B8F71;
  --color-severity-moderate: #C9A227;
  --color-severity-urgent: #D17A3D;
  --color-severity-emergent: #B6453E;

  /* Sandbox dark palette (Aura) — /sandbox only */
  --color-sandbox-bg: #050505;
  --color-sandbox-surface: #18181B;
  --color-sandbox-text: #FFFFFF;
  --color-sandbox-text-muted: #A1A1AA;
  --color-sandbox-border: #27272A;

  /* Fonts */
  --font-sans: "Inter", ui-sans-serif, system-ui, -apple-system, sans-serif;
  --font-mono: "JetBrains Mono", ui-monospace, "SFMono-Regular", Menlo, monospace;

  /* Radius family */
  --radius-xs: 2px;
  --radius-sm: 3px;
  --radius-md: 4px;
  --radius-control: 5px;
  --radius-lg: 6px;
  --radius-xl: 8px;
  --radius-bezel: 15px;

  /* Named spacing additions */
  --spacing-card-padding: 16px;
  --spacing-section-padding-sm: 24px;
  --spacing-section-padding-lg: 56px;
}

html, body, #root {
  height: 100%;
  margin: 0;
}

body {
  font-family: var(--font-sans);
  font-size: 16px;
  background-color: var(--color-stratum-bg);
  color: var(--color-stratum-text);
}

.contact-form input, .contact-form textarea, .contact-form select{
  background-color: white!important;
  padding: 10px;
}

/* =========== Helper =================
  Hide scrollbar for Chrome, Safari and Opera 
  Media query
*/
.no-scrollbar::-webkit-scrollbar {
  display: none;
}

/* Hide scrollbar for IE, Edge and Firefox */
.no-scrollbar {
  -ms-overflow-style: none; /* IE and Edge */
  scrollbar-width: none; /* Firefox */
}

/* ETA route tooltips on triage map */
.eta-tooltip, .eta-tooltip-permanent {
  background: rgba(255,255,255,0.92);
  border: 0.5px solid #cbd5e1;
  border-radius: 6px;
  padding: 3px 8px;
  font-size: 12px;
  color: #334;
  box-shadow: none;
}
.eta-tooltip-permanent {
  font-weight: 500;
}

/* =========== Animation =================
*/
@keyframes floating-object {
  0% {
    transform: translateY(-20px); /* Starts 20px above initial position */
  }
  50% {
    transform: translateY(0px); /* Floats down to initial position */
  }
  100% {
    transform: translateY(-20px); /* Floats back up */
  }
}
.animate-floating {
  animation: floating-object 3s ease-in-out infinite;
}

/* =========== Helper =================
  Carousel slide
*/
.slick-slider{
  border-radius: 10px!important;
  padding: 0px;
}
.slick-list,
.slick-track,
.slick-slide,
.slick-slide > div {
  height: 100% !important;
}
.slick-slide>div {padding: 0 10px;}
.slick-list {
  margin: 0 -10px;
}

/* ================= loader ================= */

@keyframes spin {
  to { transform: rotate(360deg); }
}

@keyframes userMenuOpen {
  from { opacity: 0; transform: scale(0.95); }
  to   { opacity: 1; transform: scale(1); }
}

/* Push notification design system variables — legacy, migrates to the
   design-system tokens above when components in sub-project 3
   (web re-skin) are re-skinned. Intentionally left untouched here. */
:root {
  --color-primary: #185FA5;
  --color-primary-light: #EBF3FC;
  --color-primary-dark: #0E3D6E;
  --color-background-info: #EBF3FC;
  --color-text-info: #185FA5;
  --color-surface: #ffffff;
  --color-text-primary: #111827;
  --color-text-secondary: #6B7280;
  --color-border: #E5E7EB;
  --color-step-bg: #F9FAFB;
  --color-warning-bg: #FEF3E2;
  --color-warning: #E8813A;
  --color-success-bg: #ECFDF5;
  --color-success: #059669;
}
```

Note what this removes from the original file: the Quicksand/Fredoka `@import` lines, the `.quicksand`/`.fredoka` classes, the old `body { font-family: "Quicksand"... }` rule, the hardcoded `#ddd` placeholder background, and the three `@tailwind base/components/utilities;` directives (Tailwind v3 syntax — superseded by `@import "tailwindcss"` in v4; keeping both is dead/incorrect leftover from an incomplete v3→v4 migration).

- [ ] **Step 4: Build and verify the new utilities compile**

Run: `cd webapp && npx vite build`
Expected: build succeeds with no CSS errors, output ends with `✓ built in`.

- [ ] **Step 5: Grep the generated CSS for the new utility classes**

Run: `cd webapp && grep -o "\.bg-stratum-bg\|\.text-severity-emergent\|\.bg-sandbox-bg\|\.rounded-control\|\.font-mono" dist/assets/*.css | sort -u`
Expected output (order may vary):
```
.bg-sandbox-bg
.bg-stratum-bg
.font-mono
.rounded-control
.text-severity-emergent
```
If any line is missing, the corresponding `@theme` entry has a typo — fix and re-run.

- [ ] **Step 6: Commit**

```bash
git add webapp/index.html webapp/src/index.css
git commit -m "feat(design-system): add Stratum/severity/sandbox theme tokens, replace dead fonts"
```

---

### Task 2: Composite typography and material utilities

**Files:**
- Modify: `webapp/src/index.css` (insert after the `@theme` block from Task 1, before the `html, body, #root` rule)

**Interfaces:**
- Consumes: `--font-sans`, `--font-mono`, `--color-stratum-bg`, `--color-stratum-border`, `--color-sandbox-surface`, `--color-sandbox-border` from Task 1.
- Produces: utility classes `text-display-lg`, `text-display-md`, `text-body-md`, `text-label-md`, `text-mono-meta`, `surface-card`, `shell-bezel`, `surface-sandbox-card` — consumed by sub-projects 2–4.

- [ ] **Step 1: Insert composite typography utilities**

In `webapp/src/index.css`, immediately after the closing `}` of the `@theme` block (before `html, body, #root {`), insert:

```css
/* Composite typography presets (ui-design/DESIGN-SYSTEM.md — Typography) */
@utility text-display-lg {
  font-family: var(--font-sans);
  font-size: 96px;
  font-weight: 200;
  line-height: 1;
  letter-spacing: -0.025em;
  text-transform: uppercase;
}
@utility text-display-md {
  font-family: var(--font-sans);
  font-size: 48px;
  font-weight: 300;
  line-height: 1.1;
  text-transform: uppercase;
}
@utility text-body-md {
  font-family: var(--font-sans);
  font-size: 16px;
  font-weight: 400;
  line-height: 1.5;
}
@utility text-label-md {
  font-family: var(--font-sans);
  font-size: 14px;
  font-weight: 500;
  line-height: 1.3;
}
@utility text-mono-meta {
  font-family: var(--font-mono);
  font-size: 12px;
  font-weight: 500;
  line-height: 1.2;
}

/* Material — "calculated skeuomorphism" (ui-design/DESIGN-SYSTEM.md — Material) */
@utility surface-card {
  background: linear-gradient(to bottom, #FDFBF7, var(--color-stratum-bg));
  backdrop-filter: blur(12px);
  box-shadow: 0 1px 2px 0 rgba(0, 0, 0, 0.08), inset 0 1px 0 0 #ffffff;
}
@utility shell-bezel {
  position: relative;
  border-radius: var(--radius-lg);
  padding: 1px;
  background: linear-gradient(to bottom, #ffffff, #fdfbf7, #dcd6cc);
}
@utility surface-sandbox-card {
  background: var(--color-sandbox-surface);
  border: 1px solid var(--color-sandbox-border);
}
```

- [ ] **Step 2: Build and verify**

Run: `cd webapp && npx vite build`
Expected: build succeeds, no CSS errors.

- [ ] **Step 3: Grep the generated CSS for the new utility classes**

Run: `cd webapp && grep -o "\.text-display-lg\|\.surface-card\|\.shell-bezel\|\.surface-sandbox-card" dist/assets/*.css | sort -u`
Expected output:
```
.shell-bezel
.surface-card
.surface-sandbox-card
.text-display-lg
```

- [ ] **Step 4: Commit**

```bash
git add webapp/src/index.css
git commit -m "feat(design-system): add composite typography and material utility classes"
```

---

### Task 3: Visual verification and final build check

**Files:** none modified — verification only.

**Interfaces:** none.

- [ ] **Step 1: Full production build (type-check + bundle)**

Run: `cd webapp && npm run build`
Expected: exits 0, `tsc -b` reports no errors, `vite build` completes.

- [ ] **Step 2: Start the dev server**

Run: `cd webapp && npm run dev` (run in background or a separate terminal — this step just needs the server reachable on its printed local URL, typically `http://localhost:5173`)

- [ ] **Step 3: Playwright check — confirm the new background and font are actually rendering**

Use the Playwright MCP/CLI to navigate to the dev server URL and evaluate:
```js
({
  bg: getComputedStyle(document.body).backgroundColor,
  font: getComputedStyle(document.body).fontFamily,
})
```
Expected: `bg` resolves to `rgb(234, 229, 223)` (i.e. `#EAE5DF`), `font` includes `Inter`. Take a screenshot of the page for visual confirmation alongside the computed-style check (this is the existing app shell, so the screenshot will mostly show the old component styling — sub-projects 2–4 are where every screen visually changes — but the page background and any unstyled text should now read in the new palette/font).

- [ ] **Step 4: Stop the dev server**

Stop the background dev server process.

- [ ] **Step 5: Commit (only if any fix-up was needed in steps 1–3; otherwise skip — no code changes in this task)**

If verification revealed no issues, there is nothing to commit for this task.

---

## Self-Review Notes

- **Spec coverage:** Colors (base + severity + sandbox) → Task 1. Typography → Task 2. Spacing/radius → Task 1. Material → Task 2. Iconography (Tabler, already loaded, no change needed) → out of scope, correctly omitted. Rollout sequence / sub-project boundaries → respected (no component files touched).
- **Placeholder scan:** none found — every step has literal code/commands/expected output.
- **Type consistency:** token names used in Task 2 (`var(--font-sans)`, `var(--color-stratum-bg)`, `var(--color-sandbox-surface)`, `var(--color-sandbox-border)`) match exactly what Task 1 defines.
