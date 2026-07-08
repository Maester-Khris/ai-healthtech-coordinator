# Onboarding + Profile UI Redesign Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build static, presentational UI for the onboarding wizard (4 steps) and a new `/profile` page, matching the dark "command center" design system already shipped elsewhere in the app, with none of the real data/permission/backend wiring — that's a separate, later phase.

**Architecture:** A small set of reusable field primitives (radio card, toggle row, text field, select field), composed into 4 onboarding step components and reused again in a new Profile page. A wizard shell owns step navigation via local `useState` only (no real hook, no persistence). Two temporary preview routes make both screens viewable in a browser for this phase; a later workflow-integration plan replaces them with real routing/data.

**Tech Stack:** React 18, TypeScript (strict), Tailwind CSS (layout/spacing utility classes) + inline `style` objects for exact hex tokens (matches the existing convention in `SetupPage.tsx`/`GpsPermissionModal.tsx`), React Router (existing `BrowserRouter` in `App.tsx`).

## Global Constraints

- **Static UI only.** No Supabase calls, no `useProfile`/`useGeolocation`/`useNotificationPermission` wiring, no OneSignal calls, no new backend endpoints. Components use local `useState` for their own interactivity (so the screens are demoable) and nothing else. Real wiring is a separate phase owned by `2026-07-07-onboarding-flow-consolidation-design.md`.
- **Visual tokens** (from `2026-07-08-onboarding-profile-ui-redesign-design.md`): background `#061219`, surface `#0A1D27`, elevated surface `#132E3C`, border `rgba(28, 70, 89, 0.4)` (`#1C4659` at ~40%), mint accent `#48F6C1` (dark text `#061219` on solid mint fills), teal `#35A7C4`, cyan `#00D2FF`, text primary `#E2F1F5`, text muted `#85A4B1`. Font: `var(--font-sans)` (Inter) for all UI text, `var(--font-mono)` (JetBrains Mono) only for small status/metadata badges — both already defined in `webapp/src/index.css`.
- **Product name is MediCoordAI** everywhere — never "CareCommand" (a Stitch-mockup drift, not real).
- **Same CTA label and body copy on both breakpoints for a given onboarding step** — "Save and continue" on every step but the last, which reads "Finish setup."
- **Content guardrails — do not write copy resembling these:** wearable/continuous-monitoring language ("Apple Watch," "monitors your health markers 24/7," battery percentages), clinician-in-the-loop copy ("Dr. ___ reviewed your vitals"), fabricated government/insurance integrations (Ontario Health Card/OHIP sync, insurance networks), facility/campus assignment ("primary campus," "current hospital"), or emergency-contact language implying medical power of attorney. Tone reference: "MediCoordAI uses your location to find nearby health facilities."
- **No new npm dependencies.** All existing tests in this repo (`hoursUtils.test.ts`, `waitTimeUtils.test.ts`, `useAnchor.test.ts`) test pure extracted functions with plain `vitest` — there is no React Testing Library/jsdom component-rendering setup installed. This plan's only "logic" (a step-index clamp) is trivial, so no test is added for it (matches the repo's own precedent for prior UI-only onboarding tasks: "Tests required: no... verified via `tsc -b`," Sprint 7 Task 006 and Sprint 10). Verification is `cd webapp && npm run build` (runs `tsc -b`, which — unlike `tsc --noEmit` — actually typechecks this project, see Sprint 11's changelog note) plus a manual browser check at both breakpoints.
- **Breakpoint:** use the existing `useBreakpoint()` hook (`webapp/src/hooks/useBreakpoint.ts`) — returns `true` below 1024px width. Do not reimplement this.

---

### Task 1: Field primitives

**Files:**
- Create: `webapp/src/components/onboarding/fields/RadioCard.tsx`
- Create: `webapp/src/components/onboarding/fields/ToggleRow.tsx`
- Create: `webapp/src/components/onboarding/fields/TextField.tsx`
- Create: `webapp/src/components/onboarding/fields/SelectField.tsx`

**Interfaces:**
- Consumes: nothing (leaf components)
- Produces:
  - `RadioCard(props: { icon?: ReactNode; title: string; description: string; selected: boolean; onSelect: () => void })`
  - `ToggleRow(props: { label: string; caption?: string; badge?: string; checked: boolean; onChange: (checked: boolean) => void })`
  - `TextField(props: { label: string; value: string; onChange: (value: string) => void; placeholder?: string; type?: 'text' | 'tel' })`
  - `SelectField(props: { label: string; value: string; onChange: (value: string) => void; options: { value: string; label: string }[]; placeholder?: string })`

- [ ] **Step 1: Create `RadioCard.tsx`**

```tsx
import type { ReactNode } from 'react'

interface RadioCardProps {
  icon?: ReactNode
  title: string
  description: string
  selected: boolean
  onSelect: () => void
}

export function RadioCard({ icon, title, description, selected, onSelect }: RadioCardProps) {
  return (
    <button
      type="button"
      onClick={onSelect}
      className="w-full text-left px-4 py-3 rounded-xl border-2 transition-all cursor-pointer flex items-start gap-3"
      style={{
        borderColor: selected ? '#48F6C1' : 'rgba(28, 70, 89, 0.40)',
        background: selected ? 'rgba(72, 246, 193, 0.08)' : 'rgba(19, 46, 60, 0.3)',
        minHeight: 44,
      }}
    >
      {icon && (
        <span className="flex-none mt-0.5" style={{ color: selected ? '#48F6C1' : '#85A4B1' }}>
          {icon}
        </span>
      )}
      <span className="flex-1">
        <p className="text-[13px] font-bold" style={{ color: '#E2F1F5', fontFamily: 'var(--font-sans)' }}>
          {title}
        </p>
        <p className="text-[11px] mt-0.5" style={{ color: '#85A4B1', fontFamily: 'var(--font-sans)' }}>
          {description}
        </p>
      </span>
      <span
        className="flex-none w-5 h-5 rounded-full border-2 flex items-center justify-center"
        style={{ borderColor: selected ? '#48F6C1' : 'rgba(28, 70, 89, 0.6)' }}
      >
        {selected && <span className="w-2.5 h-2.5 rounded-full" style={{ background: '#48F6C1' }} />}
      </span>
    </button>
  )
}
```

- [ ] **Step 2: Create `ToggleRow.tsx`**

```tsx
interface ToggleRowProps {
  label: string
  caption?: string
  badge?: string
  checked: boolean
  onChange: (checked: boolean) => void
}

export function ToggleRow({ label, caption, badge, checked, onChange }: ToggleRowProps) {
  return (
    <div className="flex flex-col gap-1.5">
      <div className="flex items-center justify-between gap-3">
        <div className="flex items-center gap-2 flex-wrap">
          <span className="text-[14px] font-semibold" style={{ color: '#E2F1F5', fontFamily: 'var(--font-sans)' }}>
            {label}
          </span>
          {badge && (
            <span
              className="text-[9px] font-bold uppercase tracking-wide px-2 py-0.5 rounded-full"
              style={{ background: 'rgba(28, 70, 89, 0.5)', color: '#85A4B1', fontFamily: 'var(--font-mono)' }}
            >
              {badge}
            </span>
          )}
        </div>
        <button
          type="button"
          role="switch"
          aria-checked={checked}
          onClick={() => onChange(!checked)}
          className="flex-none relative rounded-full transition-colors"
          style={{ width: 44, height: 24, background: checked ? '#48F6C1' : 'rgba(28, 70, 89, 0.5)' }}
        >
          <span
            className="absolute rounded-full transition-transform"
            style={{
              width: 18,
              height: 18,
              top: 3,
              left: 3,
              background: checked ? '#061219' : '#E2F1F5',
              transform: checked ? 'translateX(20px)' : 'translateX(0)',
            }}
          />
        </button>
      </div>
      {caption && (
        <p className="text-[11px] leading-snug" style={{ color: '#85A4B1', fontFamily: 'var(--font-sans)' }}>
          {caption}
        </p>
      )}
    </div>
  )
}
```

- [ ] **Step 3: Create `TextField.tsx`**

```tsx
interface TextFieldProps {
  label: string
  value: string
  onChange: (value: string) => void
  placeholder?: string
  type?: 'text' | 'tel'
}

export function TextField({ label, value, onChange, placeholder, type = 'text' }: TextFieldProps) {
  return (
    <div className="flex flex-col gap-1.5">
      <label
        className="text-[11px] font-medium uppercase tracking-wide"
        style={{ color: '#85A4B1', fontFamily: 'var(--font-sans)' }}
      >
        {label}
      </label>
      <input
        type={type}
        value={value}
        onChange={e => onChange(e.target.value)}
        placeholder={placeholder}
        className="w-full px-4 py-3 rounded-xl text-[13px] focus:outline-none transition-all"
        style={{
          minHeight: 44,
          background: 'rgba(19, 46, 60, 0.3)',
          border: '1px solid rgba(28, 70, 89, 0.4)',
          color: '#E2F1F5',
          fontFamily: 'var(--font-sans)',
        }}
        onFocus={e => (e.currentTarget.style.borderColor = '#48F6C1')}
        onBlur={e => (e.currentTarget.style.borderColor = 'rgba(28, 70, 89, 0.4)')}
      />
    </div>
  )
}
```

- [ ] **Step 4: Create `SelectField.tsx`**

```tsx
interface SelectOption {
  value: string
  label: string
}

interface SelectFieldProps {
  label: string
  value: string
  onChange: (value: string) => void
  options: SelectOption[]
  placeholder?: string
}

export function SelectField({ label, value, onChange, options, placeholder = 'Select' }: SelectFieldProps) {
  return (
    <div className="flex flex-col gap-1.5">
      <label
        className="text-[11px] font-medium uppercase tracking-wide"
        style={{ color: '#85A4B1', fontFamily: 'var(--font-sans)' }}
      >
        {label}
      </label>
      <select
        value={value}
        onChange={e => onChange(e.target.value)}
        className="w-full px-4 py-3 rounded-xl text-[13px] focus:outline-none appearance-none"
        style={{
          minHeight: 44,
          background: 'rgba(19, 46, 60, 0.3)',
          border: '1px solid rgba(28, 70, 89, 0.4)',
          color: value ? '#E2F1F5' : '#567482',
          fontFamily: 'var(--font-sans)',
        }}
      >
        <option value="" disabled>{placeholder}</option>
        {options.map(opt => (
          <option key={opt.value} value={opt.value} style={{ color: '#061219' }}>
            {opt.label}
          </option>
        ))}
      </select>
    </div>
  )
}
```

- [ ] **Step 5: Typecheck**

Run: `cd webapp && npm run build`
Expected: build succeeds, no TypeScript errors.

- [ ] **Step 6: Commit**

```bash
git add webapp/src/components/onboarding/fields/RadioCard.tsx \
        webapp/src/components/onboarding/fields/ToggleRow.tsx \
        webapp/src/components/onboarding/fields/TextField.tsx \
        webapp/src/components/onboarding/fields/SelectField.tsx
git commit -m "feat(onboarding): add reusable field primitives for onboarding/profile UI"
```

---

### Task 2: Step indicator

**Files:**
- Create: `webapp/src/components/onboarding/StepIndicator.tsx`

**Interfaces:**
- Consumes: nothing
- Produces: `StepIndicator(props: { steps: string[]; currentIndex: number })`

- [ ] **Step 1: Create `StepIndicator.tsx`**

```tsx
interface StepIndicatorProps {
  steps: string[]
  currentIndex: number
}

export function StepIndicator({ steps, currentIndex }: StepIndicatorProps) {
  return (
    <div className="flex items-start justify-center gap-6">
      {steps.map((label, i) => (
        <div key={label} className="flex flex-col items-center gap-1.5">
          <span
            className="rounded-full flex-none"
            style={{
              width: 8,
              height: 8,
              background: i <= currentIndex ? '#48F6C1' : 'transparent',
              border: i <= currentIndex ? 'none' : '1.5px solid #567482',
            }}
          />
          <span
            className="text-[9px] font-bold uppercase tracking-wide"
            style={{ color: i === currentIndex ? '#48F6C1' : '#567482', fontFamily: 'var(--font-mono)' }}
          >
            {label}
          </span>
        </div>
      ))}
    </div>
  )
}
```

- [ ] **Step 2: Typecheck**

Run: `cd webapp && npm run build`
Expected: build succeeds.

- [ ] **Step 3: Commit**

```bash
git add webapp/src/components/onboarding/StepIndicator.tsx
git commit -m "feat(onboarding): add step progress indicator component"
```

---

### Task 3: Onboarding steps — Location and Push

**Files:**
- Create: `webapp/src/components/onboarding/steps/LocationStep.tsx`
- Create: `webapp/src/components/onboarding/steps/PushStep.tsx`

**Interfaces:**
- Consumes: `RadioCard` from `../fields/RadioCard` (Task 1)
- Produces:
  - `LocationStep(props: { value: 'always' | 'ask'; onChange: (value: 'always' | 'ask') => void; onNext: () => void })`
  - `PushStep(props: { enabled: boolean; onEnable: () => void; onNext: () => void })`

- [ ] **Step 1: Create `LocationStep.tsx`**

```tsx
import { RadioCard } from '../fields/RadioCard'

interface LocationStepProps {
  value: 'always' | 'ask'
  onChange: (value: 'always' | 'ask') => void
  onNext: () => void
}

function PinIcon() {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none">
      <path
        d="M12 22s7-6.5 7-12A7 7 0 105 10c0 5.5 7 12 7 12z"
        stroke="currentColor"
        strokeWidth="1.8"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <circle cx="12" cy="10" r="2.5" stroke="currentColor" strokeWidth="1.8" />
    </svg>
  )
}

function ClockIcon() {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none">
      <circle cx="12" cy="12" r="9" stroke="currentColor" strokeWidth="1.8" />
      <path d="M12 7v5l3 3" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  )
}

export function LocationStep({ value, onChange, onNext }: LocationStepProps) {
  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-col items-center text-center gap-2">
        <div
          className="w-11 h-11 rounded-xl flex items-center justify-center"
          style={{ background: 'rgba(72, 246, 193, 0.1)', color: '#48F6C1' }}
        >
          <PinIcon />
        </div>
        <h2 className="text-[20px] font-bold" style={{ color: '#E2F1F5', fontFamily: 'var(--font-sans)' }}>
          Location access
        </h2>
        <p className="text-[13px] leading-snug" style={{ color: '#85A4B1', fontFamily: 'var(--font-sans)' }}>
          MediCoordAI uses your location to find nearby health facilities.
        </p>
      </div>

      <div className="flex flex-col gap-2">
        <RadioCard
          icon={<PinIcon />}
          title="Always allow"
          description="We'll use your saved location each time."
          selected={value === 'always'}
          onSelect={() => onChange('always')}
        />
        <RadioCard
          icon={<ClockIcon />}
          title="Ask each time"
          description="You'll be prompted when you start a session."
          selected={value === 'ask'}
          onSelect={() => onChange('ask')}
        />
      </div>

      <button
        type="button"
        onClick={onNext}
        className="w-full py-3.5 text-[14px] font-bold rounded-xl transition-all"
        style={{ background: '#48F6C1', color: '#061219', minHeight: 44 }}
      >
        Save and continue
      </button>
    </div>
  )
}
```

- [ ] **Step 2: Create `PushStep.tsx`**

```tsx
interface PushStepProps {
  enabled: boolean
  onEnable: () => void
  onNext: () => void
}

function BellIcon() {
  return (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none">
      <path
        d="M18 8a6 6 0 10-12 0c0 7-3 9-3 9h18s-3-2-3-9"
        stroke="currentColor"
        strokeWidth="1.8"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <path d="M13.73 21a2 2 0 01-3.46 0" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  )
}

export function PushStep({ enabled, onEnable, onNext }: PushStepProps) {
  const handleEnable = () => {
    onEnable()
    onNext()
  }

  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-col items-center text-center gap-2">
        <div
          className="w-14 h-14 rounded-full flex items-center justify-center"
          style={{ background: 'rgba(72, 246, 193, 0.1)', color: '#48F6C1' }}
        >
          <BellIcon />
        </div>
        <h2 className="text-[20px] font-bold" style={{ color: '#E2F1F5', fontFamily: 'var(--font-sans)' }}>
          Push notifications
        </h2>
        <p className="text-[13px] leading-snug" style={{ color: '#85A4B1', fontFamily: 'var(--font-sans)' }}>
          Get notified the moment your care recommendation is ready.
        </p>
      </div>

      {enabled && (
        <div
          className="text-center text-[12px] font-bold py-3 rounded-xl"
          style={{ background: 'rgba(72, 246, 193, 0.08)', color: '#48F6C1', fontFamily: 'var(--font-mono)' }}
        >
          NOTIFICATIONS ENABLED
        </div>
      )}

      <button
        type="button"
        onClick={handleEnable}
        className="w-full py-3.5 text-[14px] font-bold rounded-xl transition-all"
        style={{ background: '#48F6C1', color: '#061219', minHeight: 44 }}
      >
        Enable notifications
      </button>

      <button
        type="button"
        onClick={onNext}
        className="text-[12px] font-medium text-center"
        style={{ color: '#85A4B1', fontFamily: 'var(--font-sans)' }}
      >
        Not now
      </button>
    </div>
  )
}
```

- [ ] **Step 3: Typecheck**

Run: `cd webapp && npm run build`
Expected: build succeeds.

- [ ] **Step 4: Commit**

```bash
git add webapp/src/components/onboarding/steps/LocationStep.tsx \
        webapp/src/components/onboarding/steps/PushStep.tsx
git commit -m "feat(onboarding): add Location and Push onboarding steps"
```

---

### Task 4: Onboarding steps — Emergency Contact and Medical Profile

**Files:**
- Create: `webapp/src/components/onboarding/steps/EmergencyContactStep.tsx`
- Create: `webapp/src/components/onboarding/steps/MedicalProfileStep.tsx`

**Interfaces:**
- Consumes: `TextField` (`../fields/TextField`), `SelectField` (`../fields/SelectField`), `ToggleRow` (`../fields/ToggleRow`) — all from Task 1
- Produces:
  - `EmergencyContactStep(props: { name: string; phone: string; autoAlertOptIn: boolean; onNameChange: (v: string) => void; onPhoneChange: (v: string) => void; onAutoAlertChange: (v: boolean) => void; onNext: () => void })`
  - `MedicalProfileStep(props: { allergies: string; conditions: string; bloodType: string; chatOptIn: boolean; onAllergiesChange: (v: string) => void; onConditionsChange: (v: string) => void; onBloodTypeChange: (v: string) => void; onChatOptInChange: (v: boolean) => void; onFinish: () => void })`
  - Exports `BLOOD_TYPE_OPTIONS: { value: string; label: string }[]` from `MedicalProfileStep.tsx` for reuse by the Profile page (Task 6)

- [ ] **Step 1: Create `EmergencyContactStep.tsx`**

```tsx
import { TextField } from '../fields/TextField'
import { ToggleRow } from '../fields/ToggleRow'

interface EmergencyContactStepProps {
  name: string
  phone: string
  autoAlertOptIn: boolean
  onNameChange: (value: string) => void
  onPhoneChange: (value: string) => void
  onAutoAlertChange: (value: boolean) => void
  onNext: () => void
}

export function EmergencyContactStep({
  name,
  phone,
  autoAlertOptIn,
  onNameChange,
  onPhoneChange,
  onAutoAlertChange,
  onNext,
}: EmergencyContactStepProps) {
  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-col items-center text-center gap-2">
        <h2 className="text-[20px] font-bold" style={{ color: '#E2F1F5', fontFamily: 'var(--font-sans)' }}>
          Emergency contact
        </h2>
        <p className="text-[13px] leading-snug" style={{ color: '#85A4B1', fontFamily: 'var(--font-sans)' }}>
          Who should we notify if you need urgent assistance? (optional)
        </p>
      </div>

      <div className="flex flex-col gap-3">
        <TextField label="Name" value={name} onChange={onNameChange} placeholder="Who are they to you?" />
        <TextField label="Phone number" value={phone} onChange={onPhoneChange} placeholder="+1 (416) 000-0000" type="tel" />
      </div>

      <div className="h-px" style={{ background: 'rgba(28, 70, 89, 0.4)' }} />

      <ToggleRow
        label="Automatically alert this contact"
        badge="Coming soon"
        caption="In urgent situations, we'll notify your contact with your status and location — opt in now to be notified when it's ready."
        checked={autoAlertOptIn}
        onChange={onAutoAlertChange}
      />

      <button
        type="button"
        onClick={onNext}
        className="w-full py-3.5 text-[14px] font-bold rounded-xl transition-all"
        style={{ background: '#48F6C1', color: '#061219', minHeight: 44 }}
      >
        Save and continue
      </button>
    </div>
  )
}
```

- [ ] **Step 2: Create `MedicalProfileStep.tsx`**

```tsx
import { TextField } from '../fields/TextField'
import { SelectField } from '../fields/SelectField'
import { ToggleRow } from '../fields/ToggleRow'

export const BLOOD_TYPE_OPTIONS = [
  { value: 'A+', label: 'A+' },
  { value: 'A-', label: 'A-' },
  { value: 'B+', label: 'B+' },
  { value: 'B-', label: 'B-' },
  { value: 'AB+', label: 'AB+' },
  { value: 'AB-', label: 'AB-' },
  { value: 'O+', label: 'O+' },
  { value: 'O-', label: 'O-' },
  { value: 'unknown', label: 'Unknown' },
]

interface MedicalProfileStepProps {
  allergies: string
  conditions: string
  bloodType: string
  chatOptIn: boolean
  onAllergiesChange: (value: string) => void
  onConditionsChange: (value: string) => void
  onBloodTypeChange: (value: string) => void
  onChatOptInChange: (value: boolean) => void
  onFinish: () => void
}

export function MedicalProfileStep({
  allergies,
  conditions,
  bloodType,
  chatOptIn,
  onAllergiesChange,
  onConditionsChange,
  onBloodTypeChange,
  onChatOptInChange,
  onFinish,
}: MedicalProfileStepProps) {
  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-col items-center text-center gap-2">
        <h2 className="text-[20px] font-bold" style={{ color: '#E2F1F5', fontFamily: 'var(--font-sans)' }}>
          Medical profile
        </h2>
        <p className="text-[13px] leading-snug" style={{ color: '#85A4B1', fontFamily: 'var(--font-sans)' }}>
          Optional — helps the assistant give you more relevant recommendations.
        </p>
      </div>

      <div className="flex flex-col gap-3">
        <TextField label="Allergies" value={allergies} onChange={onAllergiesChange} placeholder="e.g. Penicillin, Peanuts" />
        <TextField
          label="Pre-existing conditions"
          value={conditions}
          onChange={onConditionsChange}
          placeholder="e.g. Type II Diabetes, Hypertension"
        />
        <SelectField label="Blood type" value={bloodType} onChange={onBloodTypeChange} options={BLOOD_TYPE_OPTIONS} placeholder="Select type" />
      </div>

      <div className="h-px" style={{ background: 'rgba(28, 70, 89, 0.4)' }} />

      <ToggleRow
        label="Let the AI assistant use this during triage"
        caption="Only shared with the assistant if enabled — see Privacy Policy."
        checked={chatOptIn}
        onChange={onChatOptInChange}
      />

      <button
        type="button"
        onClick={onFinish}
        className="w-full py-3.5 text-[14px] font-bold rounded-xl transition-all"
        style={{ background: '#48F6C1', color: '#061219', minHeight: 44 }}
      >
        Finish setup
      </button>
    </div>
  )
}
```

- [ ] **Step 3: Typecheck**

Run: `cd webapp && npm run build`
Expected: build succeeds.

- [ ] **Step 4: Commit**

```bash
git add webapp/src/components/onboarding/steps/EmergencyContactStep.tsx \
        webapp/src/components/onboarding/steps/MedicalProfileStep.tsx
git commit -m "feat(onboarding): add Emergency Contact and Medical Profile onboarding steps"
```

---

### Task 5: Onboarding wizard shell

**Files:**
- Create: `webapp/src/components/onboarding/OnboardingWizard.tsx`

**Interfaces:**
- Consumes: `useBreakpoint` (`../../hooks/useBreakpoint`), `StepIndicator` (Task 2), `LocationStep`/`PushStep` (Task 3), `EmergencyContactStep`/`MedicalProfileStep` (Task 4)
- Produces: `OnboardingWizard()` — no props, default-exportable-free named export, owns all local state

- [ ] **Step 1: Create `OnboardingWizard.tsx`**

```tsx
import { useState } from 'react'
import { useBreakpoint } from '../../hooks/useBreakpoint'
import { StepIndicator } from './StepIndicator'
import { LocationStep } from './steps/LocationStep'
import { PushStep } from './steps/PushStep'
import { EmergencyContactStep } from './steps/EmergencyContactStep'
import { MedicalProfileStep } from './steps/MedicalProfileStep'

const STEP_LABELS = ['Location', 'Push', 'Emergency', 'Medical']

export function OnboardingWizard() {
  const isMobile = useBreakpoint()
  const [stepIndex, setStepIndex] = useState(0)
  const [locationPref, setLocationPref] = useState<'always' | 'ask'>('ask')
  const [pushEnabled, setPushEnabled] = useState(false)
  const [contactName, setContactName] = useState('')
  const [contactPhone, setContactPhone] = useState('')
  const [autoAlertOptIn, setAutoAlertOptIn] = useState(false)
  const [allergies, setAllergies] = useState('')
  const [conditions, setConditions] = useState('')
  const [bloodType, setBloodType] = useState('')
  const [chatOptIn, setChatOptIn] = useState(false)

  const goNext = () => setStepIndex(i => Math.min(i + 1, STEP_LABELS.length - 1))

  const steps = [
    <LocationStep key="location" value={locationPref} onChange={setLocationPref} onNext={goNext} />,
    <PushStep key="push" enabled={pushEnabled} onEnable={() => setPushEnabled(true)} onNext={goNext} />,
    <EmergencyContactStep
      key="emergency"
      name={contactName}
      phone={contactPhone}
      autoAlertOptIn={autoAlertOptIn}
      onNameChange={setContactName}
      onPhoneChange={setContactPhone}
      onAutoAlertChange={setAutoAlertOptIn}
      onNext={goNext}
    />,
    <MedicalProfileStep
      key="medical"
      allergies={allergies}
      conditions={conditions}
      bloodType={bloodType}
      chatOptIn={chatOptIn}
      onAllergiesChange={setAllergies}
      onConditionsChange={setConditions}
      onBloodTypeChange={setBloodType}
      onChatOptInChange={setChatOptIn}
      onFinish={() => { /* wired to real submission in the workflow integration phase */ }}
    />,
  ]

  const card = (
    <div
      className="w-full flex flex-col gap-6"
      style={{
        maxWidth: isMobile ? undefined : 480,
        background: '#0A1D27',
        border: '1px solid rgba(28, 70, 89, 0.4)',
        borderRadius: isMobile ? 0 : 20,
        padding: isMobile ? '32px 20px' : 32,
        boxShadow: isMobile ? undefined : '0 20px 40px -15px rgba(3, 10, 14, 0.7)',
      }}
    >
      <StepIndicator steps={STEP_LABELS} currentIndex={stepIndex} />
      {steps[stepIndex]}
    </div>
  )

  if (isMobile) {
    return (
      <div className="min-h-screen flex flex-col" style={{ background: '#061219' }}>
        <div className="flex-none flex flex-col items-center justify-center py-8 px-6">
          <h1 className="text-[18px] font-bold" style={{ color: '#E2F1F5', fontFamily: 'var(--font-sans)' }}>
            MediCoord<span style={{ color: '#48F6C1' }}>AI</span>
          </h1>
        </div>
        <div className="flex-1 flex flex-col px-1">{card}</div>
      </div>
    )
  }

  return (
    <div className="min-h-screen flex items-center justify-center" style={{ background: '#061219' }}>
      {card}
    </div>
  )
}
```

- [ ] **Step 2: Typecheck**

Run: `cd webapp && npm run build`
Expected: build succeeds.

- [ ] **Step 3: Commit**

```bash
git add webapp/src/components/onboarding/OnboardingWizard.tsx
git commit -m "feat(onboarding): add onboarding wizard shell with breakpoint-aware chrome"
```

---

### Task 6: Profile page

**Files:**
- Create: `webapp/src/pages/ProfilePage.tsx`

**Interfaces:**
- Consumes: `useBreakpoint` (`../hooks/useBreakpoint`), `RadioCard`/`TextField`/`SelectField`/`ToggleRow` (Task 1), `BLOOD_TYPE_OPTIONS` (Task 4, from `MedicalProfileStep.tsx`)
- Produces: default export `ProfilePage()` — no props

- [ ] **Step 1: Create `ProfilePage.tsx`**

```tsx
import { useState } from 'react'
import type { ReactNode } from 'react'
import { useBreakpoint } from '../hooks/useBreakpoint'
import { RadioCard } from '../components/onboarding/fields/RadioCard'
import { TextField } from '../components/onboarding/fields/TextField'
import { SelectField } from '../components/onboarding/fields/SelectField'
import { ToggleRow } from '../components/onboarding/fields/ToggleRow'
import { BLOOD_TYPE_OPTIONS } from '../components/onboarding/steps/MedicalProfileStep'

const PLACEHOLDER_DEVICES = [
  { id: 'device-1', label: 'Chrome on Windows — active' },
  { id: 'device-2', label: 'Safari on iPhone — active' },
]

function SectionCard({ title, children }: { title: string; children: ReactNode }) {
  return (
    <div
      className="flex flex-col gap-4"
      style={{ background: '#0A1D27', border: '1px solid rgba(28, 70, 89, 0.4)', borderRadius: 16, padding: 20 }}
    >
      <h2 className="text-[14px] font-bold" style={{ color: '#E2F1F5', fontFamily: 'var(--font-sans)' }}>
        {title}
      </h2>
      {children}
    </div>
  )
}

export default function ProfilePage() {
  const isMobile = useBreakpoint()
  const [locationPref, setLocationPref] = useState<'always' | 'ask'>('ask')
  const [pushEnabled, setPushEnabled] = useState(true)
  const [devices, setDevices] = useState(PLACEHOLDER_DEVICES)
  const [contactName, setContactName] = useState('Sarah Jenkins')
  const [contactPhone, setContactPhone] = useState('+1 (416) 555-0192')
  const [autoAlertOptIn, setAutoAlertOptIn] = useState(false)
  const [allergies, setAllergies] = useState('')
  const [conditions, setConditions] = useState('')
  const [bloodType, setBloodType] = useState('')
  const [chatOptIn, setChatOptIn] = useState(false)

  const removeDevice = (id: string) => setDevices(current => current.filter(device => device.id !== id))

  return (
    <div className="min-h-screen" style={{ background: '#061219' }}>
      <div
        className="mx-auto flex flex-col gap-5"
        style={{ maxWidth: isMobile ? undefined : 640, padding: isMobile ? '24px 16px 100px' : '40px 24px 120px' }}
      >
        <div className="flex items-center gap-4">
          <div
            className="rounded-full flex items-center justify-center flex-none"
            style={{ width: 56, height: 56, background: '#35A7C4', color: '#061219', fontWeight: 700, fontSize: 20 }}
          >
            U
          </div>
          <div>
            <p className="text-[13px]" style={{ color: '#48F6C1', fontFamily: 'var(--font-sans)' }}>
              user@example.com
            </p>
            <p className="text-[10px] mt-0.5" style={{ color: '#85A4B1', fontFamily: 'var(--font-mono)' }}>
              Member since May 2024
            </p>
          </div>
        </div>

        <SectionCard title="Location preference">
          <div className="flex flex-col gap-2">
            <RadioCard
              title="Always allow"
              description="We'll use your saved location each time."
              selected={locationPref === 'always'}
              onSelect={() => setLocationPref('always')}
            />
            <RadioCard
              title="Ask each time"
              description="You'll be prompted when you start a session."
              selected={locationPref === 'ask'}
              onSelect={() => setLocationPref('ask')}
            />
          </div>
        </SectionCard>

        <SectionCard title="Push notifications">
          <ToggleRow label="Push notifications" checked={pushEnabled} onChange={setPushEnabled} />
          <div className="flex flex-col gap-2">
            {devices.map(device => (
              <div
                key={device.id}
                className="flex items-center justify-between px-4 py-2.5 rounded-xl"
                style={{ background: 'rgba(19, 46, 60, 0.3)', border: '1px solid rgba(28, 70, 89, 0.4)' }}
              >
                <span className="text-[12px]" style={{ color: '#E2F1F5', fontFamily: 'var(--font-sans)' }}>
                  {device.label}
                </span>
                <button
                  type="button"
                  onClick={() => removeDevice(device.id)}
                  className="text-[11px] font-semibold"
                  style={{ color: '#FF7B93', fontFamily: 'var(--font-sans)' }}
                >
                  Remove
                </button>
              </div>
            ))}
            {devices.length === 0 && (
              <p className="text-[12px]" style={{ color: '#85A4B1', fontFamily: 'var(--font-sans)' }}>
                No devices registered.
              </p>
            )}
          </div>
        </SectionCard>

        <SectionCard title="Emergency contact">
          <TextField label="Name" value={contactName} onChange={setContactName} placeholder="Who are they to you?" />
          <TextField
            label="Phone number"
            value={contactPhone}
            onChange={setContactPhone}
            placeholder="+1 (416) 000-0000"
            type="tel"
          />
          <ToggleRow
            label="Automatically alert this contact"
            badge="Coming soon"
            caption="In urgent situations, we'll notify your contact with your status and location."
            checked={autoAlertOptIn}
            onChange={setAutoAlertOptIn}
          />
        </SectionCard>

        <SectionCard title="Medical profile">
          <TextField label="Allergies" value={allergies} onChange={setAllergies} placeholder="e.g. Penicillin, Peanuts" />
          <TextField
            label="Pre-existing conditions"
            value={conditions}
            onChange={setConditions}
            placeholder="e.g. Type II Diabetes, Hypertension"
          />
          <SelectField label="Blood type" value={bloodType} onChange={setBloodType} options={BLOOD_TYPE_OPTIONS} placeholder="Select type" />
          <ToggleRow
            label="Let the AI assistant use this during triage"
            caption="Only shared with the assistant if enabled — see Privacy Policy."
            checked={chatOptIn}
            onChange={setChatOptIn}
          />
        </SectionCard>
      </div>

      <div
        className="fixed bottom-0 left-0 right-0 flex justify-center"
        style={{
          background: 'rgba(6, 18, 25, 0.95)',
          backdropFilter: 'blur(16px)',
          borderTop: '1px solid rgba(28, 70, 89, 0.4)',
          padding: 16,
        }}
      >
        <button
          type="button"
          className="w-full font-bold rounded-xl transition-all"
          style={{ maxWidth: isMobile ? undefined : 640, background: '#48F6C1', color: '#061219', padding: '12px 0', minHeight: 44 }}
        >
          Save changes
        </button>
      </div>
    </div>
  )
}
```

- [ ] **Step 2: Typecheck**

Run: `cd webapp && npm run build`
Expected: build succeeds.

- [ ] **Step 3: Commit**

```bash
git add webapp/src/pages/ProfilePage.tsx
git commit -m "feat(profile): add static profile page with device list, contact, and medical sections"
```

---

### Task 7: Temporary preview routes + browser verification

**Files:**
- Modify: `webapp/src/App.tsx`

**Interfaces:**
- Consumes: `OnboardingWizard` (Task 5), `ProfilePage` (Task 6)
- Produces: two routes, `/preview/onboarding` and `/preview/profile`, clearly marked as temporary

- [ ] **Step 1: Add imports and temporary preview routes**

In `webapp/src/App.tsx`, add these two imports near the other page imports (after the `import ForEngineersPage from './pages/ForEngineersPage'` line):

```tsx
import { OnboardingWizard } from './components/onboarding/OnboardingWizard'
import ProfilePage from './pages/ProfilePage'
```

Then add these two routes inside the `<Routes>` block, immediately after the `/testlocation` route:

```tsx
{/* TEMPORARY — static UI preview only, removed when the workflow-integration
    phase wires real /setup and /profile routing (see
    2026-07-07-onboarding-flow-consolidation-design.md) */}
<Route path="/preview/onboarding" element={<OnboardingWizard />} />
<Route path="/preview/profile" element={<ProfilePage />} />
```

- [ ] **Step 2: Typecheck**

Run: `cd webapp && npm run build`
Expected: build succeeds.

- [ ] **Step 3: Manual browser verification**

Run: `doppler run -- npm run dev` (from `webapp/`)

Open a browser to:
- `http://localhost:5173/preview/onboarding` at a desktop width (≥1024px) — confirm the 4-dot step indicator, dark glass modal card, and all 4 steps are reachable via each step's continue button, ending on "Finish setup."
- Same URL, resized below 1024px (or via device toolbar) — confirm it switches to the full-page mobile layout with the MediCoordAI hero header, same step content.
- `http://localhost:5173/preview/profile` at both the same two widths — confirm all 5 sections render (account header, location, push + device list with working "Remove" buttons, emergency contact, medical profile), and the "Save changes" bar stays pinned to the bottom while the sections scroll.

Confirm against the content guardrails in `2026-07-08-onboarding-profile-ui-redesign-design.md`: no wearable/monitoring language, no "Dr. ___" phrasing, no OHIP/insurance-network mentions, no facility/campus assignment, "MediCoordAI" (not "CareCommand") anywhere text appears.

- [ ] **Step 4: Commit**

```bash
git add webapp/src/App.tsx
git commit -m "feat(onboarding): wire temporary preview routes for onboarding wizard and profile page"
```

---

## Self-review notes

- **Spec coverage:** all 4 onboarding steps (Task 3, 4), the wizard shell with breakpoint switching (Task 5), the profile page with all 5 sections including the device list (Task 6), and browser-verified content guardrails (Task 7) are covered. Drawer menu changes and real route wiring (`/setup` → onboarding-only, `/profile` as the real destination, removing "Test notifications") are explicitly out of scope per the redesign spec and left to the workflow-integration phase.
- **Placeholder scan:** no TBD/TODO; the one intentionally-inert callback (`onFinish` in `OnboardingWizard`) is commented explaining exactly what replaces it and when.
- **Type consistency:** `BLOOD_TYPE_OPTIONS` is defined once in `MedicalProfileStep.tsx` (Task 4) and imported by `ProfilePage.tsx` (Task 6) rather than redefined, so the option list can't drift between the two screens.
