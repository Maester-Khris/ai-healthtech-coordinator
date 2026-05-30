interface SymptomInputProps {
  value: string
  onChange: (v: string) => void
  onSend: () => void
  disabled?: boolean
  placeholder?: string
  className?: string
}

export function SymptomInput({
  value,
  onChange,
  onSend,
  disabled = false,
  placeholder = 'Describe how you feel…',
  className = '',
}: SymptomInputProps) {
  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault()
      onSend()
    }
  }

  return (
    <div
      className={`flex items-center gap-2 bg-gray-50 border border-gray-200 px-3 py-2 ${className}`}
      style={{ borderRadius: 20 }}
    >
      <textarea
        value={value}
        onChange={e => onChange(e.target.value)}
        onKeyDown={handleKeyDown}
        disabled={disabled}
        rows={1}
        placeholder={placeholder}
        className="flex-1 bg-transparent resize-none text-[13px] text-gray-900 focus:outline-none placeholder-gray-400 disabled:cursor-not-allowed leading-5"
        style={{ minHeight: 24 }}
      />
      <button
        onClick={onSend}
        disabled={disabled || !value.trim()}
        className={`w-8 h-8 rounded-full flex items-center justify-center flex-none transition-all ${
          !disabled && value.trim()
            ? 'bg-blue-600 text-white'
            : 'bg-gray-200 text-gray-400 cursor-not-allowed'
        }`}
      >
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none">
          <path
            d="M22 2L11 13M22 2l-7 20-4-9-9-4 20-7z"
            stroke="currentColor"
            strokeWidth="2"
            strokeLinecap="round"
            strokeLinejoin="round"
          />
        </svg>
      </button>
    </div>
  )
}
