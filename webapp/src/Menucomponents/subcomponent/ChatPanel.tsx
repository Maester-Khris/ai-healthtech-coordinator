const SUGGESTIONS = [
  'I have a fever and sore throat',
  'Chest pain and shortness of breath',
  'Twisted my ankle — it\'s swollen',
]

export function ChatPanel() {
  return (
    <div className="flex flex-col h-full bg-white">
      {/* Panel header */}
      <div className="flex-none px-5 py-3 border-b border-gray-200">
        <div className="flex items-center justify-between">
          <div>
            <h2 className="text-[14px] font-semibold text-gray-900 leading-tight">Health assistant</h2>
            <p className="text-[12px] text-gray-500 leading-tight">Describe your symptoms</p>
          </div>
          <div className="flex items-center gap-1.5">
            <span
              className="w-2 h-2 rounded-full inline-block"
              style={{ backgroundColor: '#1D9E75' }}
            />
            <span className="text-[12px] text-gray-600">Online</span>
          </div>
        </div>
      </div>

      {/* Empty state */}
      <div className="flex-1 flex flex-col items-center justify-center px-6 gap-5 overflow-hidden">
        {/* Avatar ring */}
        <div
          className="w-14 h-14 rounded-full flex items-center justify-center flex-none"
          style={{ backgroundColor: '#E6F1FB', border: '2px solid #B5D4F4' }}
        >
          <svg width="28" height="28" viewBox="0 0 28 28" fill="none" xmlns="http://www.w3.org/2000/svg">
            <rect x="7" y="10" width="14" height="10" rx="2" stroke="#185FA5" strokeWidth="1.5" fill="none" />
            <circle cx="10.5" cy="14.5" r="1.5" fill="#185FA5" />
            <circle cx="17.5" cy="14.5" r="1.5" fill="#185FA5" />
            <path d="M10.5 18h7" stroke="#185FA5" strokeWidth="1.5" strokeLinecap="round" />
            <path d="M14 10V7" stroke="#185FA5" strokeWidth="1.5" strokeLinecap="round" />
            <path d="M11 7h6" stroke="#185FA5" strokeWidth="1.5" strokeLinecap="round" />
          </svg>
        </div>

        <div className="text-center">
          <h3 className="text-[15px] font-semibold text-gray-900">How are you feeling?</h3>
          <p className="text-[13px] text-gray-500 mt-1">Tell me your symptoms and I'll find the nearest care.</p>
        </div>

        {/* Suggestion chips */}
        <div className="flex flex-col gap-2 w-full">
          {SUGGESTIONS.map((s) => (
            <button
              key={s}
              className="w-full text-left px-4 py-2.5 text-[13px] text-gray-700 bg-gray-50 border border-gray-200 rounded-lg hover:bg-gray-100 transition-colors"
            >
              {s}
            </button>
          ))}
        </div>
      </div>

      {/* Input area */}
      <div className="flex-none border-t border-gray-200 px-4 py-3">
        <div className="flex items-end gap-2">
          <textarea
            className="flex-1 resize-none text-[13px] text-gray-900 border border-gray-300 rounded-lg px-3 py-2 focus:outline-none focus:ring-1 focus:border-[#185FA5] placeholder-gray-400"
            style={{ '--tw-ring-color': '#185FA5' } as React.CSSProperties}
            placeholder="Describe how you feel…"
            rows={2}
          />
          <button
            className="flex-none w-9 h-9 rounded-lg flex items-center justify-center"
            style={{ backgroundColor: '#185FA5' }}
          >
            <svg width="16" height="16" viewBox="0 0 16 16" fill="none" xmlns="http://www.w3.org/2000/svg">
              <path d="M8 13V3M3 8l5-5 5 5" stroke="white" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
            </svg>
          </button>
        </div>
        <p className="text-[11px] text-gray-400 mt-1.5">
          Location access will be requested on first message
        </p>
      </div>
    </div>
  )
}
