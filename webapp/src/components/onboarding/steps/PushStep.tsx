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
