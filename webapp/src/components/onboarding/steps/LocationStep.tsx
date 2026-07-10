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
