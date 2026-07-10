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
