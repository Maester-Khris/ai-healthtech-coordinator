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
