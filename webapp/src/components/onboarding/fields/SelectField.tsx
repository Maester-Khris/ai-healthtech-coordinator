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
