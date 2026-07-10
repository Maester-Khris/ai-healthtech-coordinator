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
