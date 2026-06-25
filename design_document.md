# MediCoord AI: Unified Design System Specification
## Master UI/UX Reskin Document (Web & Mobile Layouts)

This design system establishes a uniform, high-end visual language for the MediCoord AI platform. It serves as the single source of truth for reskinning all application pages, ensuring a cohesive **Agentic SaaS + HealthTech** experience across both desktop viewports and mobile screens.

---

## 1. Design Philosophy & Visual Aesthetic

The core identity of MediCoord AI centers on **"Agentic Glass-Box Transparency"**. The interface must look and feel like an intelligent, real-time command center:
1. **Intelligent Autonomy:** Features should feel proactive, streaming parsing states, triage logic, and route calculation feedback interactively to the user.
2. **Desaturated Maps & Luminous Accents:** Map assets and background layers are desaturated to allow glowing, high-contrast, multi-colored data lines and pins to draw immediate focus.
3. **Frosted Glassmorphism:** Interacting overlays use blurred glass surfaces (`backdrop-blur-xl`), thin semi-translucent borders, and deep ambient drop shadows to stack layers cleanly.

---

## 2. Color Palette & Tokens (Logo-Derived)

The color palette is extracted from the brand assets, utilizing a deep slate navy base offset by high-luminosity cybernetic greens, blues, and functional status shades.

### A. Core Neutral Tokens
| Token | HEX Value | UI Role / Usage |
| :--- | :--- | :--- |
| `color-bg-base` | `#061219` | Main screen background, headers, footers |
| `color-bg-surface` | `#0A1D27` | Primary card background, command menu box, dialogs |
| `color-bg-surface-active` | `#132E3C` | Selected menu items, active list items, tab state fills |
| `color-border-subtle` | `#1C4659` | Standard 1px border lines, divider rules, text fields |
| `color-border-focus` | `#48F6C1` | Input focus indicator, parsing spinner, verification checkboxes |

### B. Core Accent & Brand Highlights
| Token | HEX Value | UI Role / Usage |
| :--- | :--- | :--- |
| `color-accent-mint` | `#48F6C1` | Primary brand accent; verified state indicators, success banners, car route paths |
| `color-accent-teal` | `#35A7C4` | Secondary accent; search tags, facility filter options, map lab pins |
| `color-accent-blue` | `#00D2FF` | **Electric Cyber Blue**; system status badges, bike transit paths, query parser chips |

### C. Triage Severity & Urgency States
| Severity Level | HEX Accent | BG Overlay | UI Usage Example |
| :--- | :--- | :--- | :--- |
| **Emergent (ESI 1-2)** | `#FF7B93` | `#FF7B93`/10 | High-urgency ER routing, triage warning cards |
| **Urgent (ESI 3)** | `#F59E0B` | `#F59E0B`/10 | Moderate clinics, urgent care route paths |
| **Non-Urgent (ESI 4-5)** | `#00D2FF` | `#00D2FF`/10 | Regular check-ups, diagnostic labs, pharmacies |

### D. Text Contrast Rules
- **Text Primary:** `#E2F1F5` (High readability, off-white)
- **Text Secondary / Muted:** `#85A4B1` (Secondary info, descriptions, timestamps)
- **Text Inverse:** `#061219` (Dark text for solid mint/blue CTA buttons)

---

## 3. Typography & Font Chart System

To guarantee visual premium consistency and prevent reliance on system defaults, MediCoord AI enforces a strict multi-tiered typography stack. Fonts must be imported explicitly via Webfont CDN (Google Fonts) with complete fallback chains.

### A. Typographic Domains

| Domain | Font Family | Google Font Source | Target Use Cases | Fallback Font Chain |
| :--- | :--- | :--- | :--- | :--- |
| **Public & Static** | `Plus Jakarta Sans` | `Plus+Jakarta+Sans:wght@300;400;500;600;700;800` | Landing Page, For Investors, For Engineers, Legal pages | `'Plus Jakarta Sans', 'Outfit', sans-serif` |
| **App & User Space** | `Inter` | `Inter:wght@300;400;500;600;700` | Sandbox Dashboard, Getting Started, Profile, Chat Panel, Settings | `'Inter', 'Plus Jakarta Sans', sans-serif` |
| **Telemetry & Logs** | `JetBrains Mono` | `JetBrains+Mono:wght@400;500;600` | Clinical metrics, system logs, code blocks, priority queue data | `'JetBrains Mono', 'Fira Code', monospace` |

---

### B. Font Sizing & CSS Tokens

```css
/* Core Font Stack Variables */
:root {
  --font-static: "Plus Jakarta Sans", "Outfit", system-ui, sans-serif;
  --font-app: "Inter", system-ui, sans-serif;
  --font-mono: "JetBrains Mono", monospace;
}
```

---

### C. Coherent Font Chart Layout

#### 1. Public & Static Pages (Plus Jakarta Sans)
- **Hero Display Title:** `text-5xl` to `text-6xl` (`48px` - `60px`), font-weight `800` (Extra Bold), tracking `-0.03em`, line-height `1.1`. Applied to landing page titles, value propositions.
- **Section Headers (H2):** `text-3xl` to `text-4xl` (`30px` - `36px`), font-weight `700` (Bold), tracking `-0.02em`, line-height `1.2`. Applied to feature sections, investor highlights.
- **Sub-headers (H3):** `text-xl` to `text-2xl` (`20px` - `24px`), font-weight `600` (Semi-Bold), tracking `-0.01em`, line-height `1.3`. Applied to card titles, pricing headers.
- **Body & Paragraphs:** `text-sm` to `text-base` (`14px` - `16px`), font-weight `400` (Regular), line-height `1.6`, text color `var(--text-secondary)`. Applied to narrative descriptions, long legal copy.

#### 2. App & User Space (Inter)
- **App Dashboard Header:** `text-xl` to `text-2xl` (`20px` - `24px`), font-weight `700` (Bold), tracking `-0.015em`. Applied to Sandbox title, primary control panels.
- **Card Titles & Tab Labels:** `text-sm` (`14px`), font-weight `600` (Semi-Bold), tracking `-0.01em`. Applied to sidebar cards, filter tab buttons, navigation buttons.
- **UI Body text:** `text-xs` to `text-sm` (`12px` - `14px`), font-weight `400` (Regular) or `500` (Medium) for active items. Applied to user chat bubbles, modal fields, settings inputs.
- **Buttons & CTAs:** `text-xs` to `text-sm` (`12px` - `14px`), font-weight `700` (Bold), tracking `0.03em` uppercase. Applied to "Launch Sandbox", "Focus Map", "Accept Cookies".
- **Form Labels & Placeholders:** `text-[11px]` to `text-xs` (`11px` - `12px`), font-weight `500` (Medium), text color `#7AA0B0`. Applied to inputs, dropdown titles, profile settings fields.

#### 3. System Metrics & Logs (JetBrains Mono)
- **Diagnostic Numbers:** `text-2xl` to `text-3xl` (`24px` - `30px`), font-weight `700` (Bold). Applied to active ETAs, write latencies, throughput numbers.
- **Log Stream lines:** `text-[11px]` to `text-xs` (`11px` - `12px`), font-weight `400` (Regular). Applied to chatbot reasoning states, database queries, terminal telemetry outputs.
- **In-flight Badges:** `text-[10px]`, font-weight `600` (Semi-Bold) uppercase tracking `0.05em`. Applied to inline capability tags, active/pending badges.

---

## 4. Responsive Grid & Layout Architectures

To ensure consistent performance, the app shifts between two distinct layout modes depending on the screen size.

### A. Desktop Viewports (min-width: 1024px)
- **Global Header:** Fixed height of `64px` (16), sticky on scroll, translucent background (`bg-[#061219]/90 backdrop-blur-md`).
- **Main Command Center:** Split-pane interface dividing width exactly into:
  - **Left Sidebar Drawer (40% width):** Floating data workspace cards, scrollable triage directory list.
  - **Right Interactive Map (60% width):** Full-height desaturated canvas container with absolute overlays, active route markers, and transit lines.
- **Visual Grid Dividers:** All columns and panes separated by a thin 1px border (`border-[#132A37]/80`).

### B. Mobile Viewports (max-width: 1023px)
- **Stacked Interface:** Map scales dynamically to a top aspect-ratio banner or is positioned as a full back-layer underneath elements.
- **Sliding Bottom Drawers:** Triage lists and log parameters slide upwards from the bottom of the viewport:
  - **Collapsed State:** Visible 48px header showing basic active ETA status and quick search bar.
  - **Expanded State:** 80% screen height drawer containing the full interactive logs and options.
- **Touch-Friendly Hitboxes:** Minimum target sizes of `44px` for toggles, chips, close buttons, and command anchors.

---

## 5. UI Component Specifications

### A. The Agentic Omni-Input Box
1. **Outer container:** Height `56px` (h-14), rounded corner borders `rounded-xl`, border styling `border-[#1C4659]/65`, background `bg-[#0A1D27]/90 backdrop-blur-xl`.
2. **Focus State:** Animates border to `border-[#48F6C1]` with a 2px outer glow (`ring-2 ring-[#48F6C1]/10`).
3. **Command Menu Keybind:** Anchor inline `K` badge (`border border-[#1C4659]/60 bg-[#0A1D27]/40 text-[#7AA0B0]`). Pressing `Ctrl+K` or `Cmd+K` reveals a quick-intent keyboard-navigable command box.
4. **Streaming Log Overlay:** Absolute card popping up below input, displaying a live processing spinner (`CircleNotch animate-spin text-[#48F6C1]`) and streaming intent tags (`[Intent: Find Care]`).

### B. Glassmorphic Data Cards
- **Background:** `bg-[#0A1D27]/80 backdrop-blur-md`
- **Border:** `1px solid border-[#1C4659]/50`
- **Hover interaction:** Scale shifts up slightly (`hover:-translate-y-0.5 hover:scale-[1.01] hover:border-[#00D2FF]/50`), transition `duration-300 transition-all`.
- **Footer detail:** Dedicated monospace panel `border-t border-[#1C4659]/30 bg-[#061219]/60 p-3 rounded-b-2xl font-mono text-[10px]`.

### C. Cookie Consent Pill Controller
- **Pill frame:** Anchored `bottom-6 left-1/2 -translate-x-1/2 w-[92%] max-w-xl bg-[#0A1D27]/95 backdrop-blur-2xl border border-[#1C4659]/80 rounded-2xl p-4.5`.
- **Inline Preference Card:** Expands downwards with height `auto` and opacity transitions, revealing toggle switches.
- **Switch Toggles:** Active state turns background to `bg-[#48F6C1]`, inactive state stays `bg-[#1C4659]/40`.

---

## 6. Map Canvas Overlay & Transit Routes

1. **Monochrome Vector Skin:** desaturated city map layer with a desaturated blue-green tint.
2. **Kinetic Route Paths:** Rendered inside SVG overlay layers using `stroke-dasharray` and `stroke-dashoffset` for kinetic path animation matching travelers:
   - Car route: `#48F6C1`
   - Bicycle route: `#00D2FF`
   - Jogger route: `#5CEBBA`
   - Family route: `#2E8EA5`
3. **Pulsating Hub Pin Ripples:** When travel paths arrive at facility locations, fire keyframe scaling overlays:
   ```css
   @keyframes ripple {
     0% { transform: scale(1) translate(-50%, -50%); opacity: 1; }
     100% { transform: scale(1.8) translate(-50%, -50%); opacity: 0; }
   }
   ```

---

## 7. Motion, Transition & Animation Parameters

All screen element changes and state transits must enforce clean, modern web animation specs.

- **Fast transitions:** `transition-all duration-200 ease-out` (Used for button hover, tag selections, command highlights).
- **Spring slides:** `type: "spring", stiffness: 300, damping: 25` (Used for slide-up command menus, side panel collapse, and banner entries).
- **Breathe Scaling loop:** Infinite keyframe cycle for background map assets (`scale(1.0)` to `scale(1.015)` over a 12-second period).
