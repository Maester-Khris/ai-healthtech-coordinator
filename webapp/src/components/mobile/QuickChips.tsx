const SUGGESTIONS = [
  'I have a fever and sore throat',
  'Chest pain and shortness of breath',
  'Twisted my ankle — it\'s swollen',
] as const

interface QuickChipsProps {
  onSelect: (text: string) => void
  disabled?: boolean
}

export function QuickChips({ onSelect, disabled = false }: QuickChipsProps) {
  return (
    <div className="flex flex-col gap-2 w-full">
      {SUGGESTIONS.map(s => (
        <button
          key={s}
          onClick={() => { if (!disabled) onSelect(s) }}
          disabled={disabled}
          className="w-full text-left px-4 py-3 text-[13px] font-medium text-stratum-text bg-white border border-stratum-border rounded-stratum-md hover:border-stratum-accent-2 hover:bg-stratum-bg hover:text-stratum-text transition-all disabled:opacity-50 disabled:cursor-not-allowed"
          style={{ minHeight: 44 }}
        >
          {s}
        </button>
      ))}
    </div>
  )
}
