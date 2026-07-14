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
