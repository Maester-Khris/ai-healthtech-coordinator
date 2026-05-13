const SUGGESTIONS = [
  'I have a fever and sore throat',
  'Chest pain and shortness of breath',
  'Twisted my ankle — it\'s swollen',
]

export function ChatPanel() {
  return (
    <div className="flex flex-col h-full bg-slate-50/50 relative">
      {/* Panel header */}
      <div className="flex-none px-6 py-4 border-b border-gray-100 bg-white shadow-sm z-20 relative">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-blue-50 flex items-center justify-center border border-blue-100 shadow-sm">
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
                <path d="M12 4V20M4 12H20" stroke="#2563EB" strokeWidth="2.5" strokeLinecap="round" />
                <circle cx="12" cy="12" r="8" stroke="#2563EB" strokeWidth="2" strokeLinecap="round" strokeDasharray="4 4" />
              </svg>
            </div>
            <div>
              <h2 className="text-[15px] font-bold text-gray-900 tracking-tight leading-tight">AI Health Assistant</h2>
              <p className="text-xs font-semibold text-blue-600 mt-0.5">Ready to assist you</p>
            </div>
          </div>
          <div className="flex items-center gap-2 px-3 py-1.5 bg-emerald-50 rounded-full border border-emerald-100/50 shadow-sm">
            <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
            <span className="text-[11px] font-bold text-emerald-700 tracking-wide uppercase">Online</span>
          </div>
        </div>
      </div>

      {/* Empty state */}
      <div className="flex-1 flex flex-col items-center justify-center px-8 gap-6 overflow-hidden relative">
        {/* Background Decoration */}
        <div className="absolute inset-0 bg-[radial-gradient(#e5e7eb_1px,transparent_1px)] [background-size:16px_16px] opacity-40"></div>

        <div className="text-center z-10 flex flex-col items-center">
          <div className="w-16 h-16 rounded-2xl bg-gradient-to-tr from-blue-600 to-blue-400 flex items-center justify-center shadow-lg shadow-blue-500/30 mb-5 text-white">
            <svg width="32" height="32" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
              <path d="M8 10h8M8 14h4M21 12c0 4.97-4.03 9-9 9-2.07 0-3.98-.7-5.5-1.88L3 20l.88-3.5C2.7 14.98 2 13.07 2 12c0-4.97 4.03-9 9-9s9 4.03 9 9z" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
            </svg>
          </div>
          <h3 className="text-xl font-bold text-gray-900 tracking-tight">How are you feeling?</h3>
          <p className="text-sm font-medium text-gray-500 mt-2 max-w-[240px]">
            Describe your symptoms or ask a health-related question.
          </p>
        </div>

        {/* Suggestion chips */}
        <div className="flex flex-col gap-3 w-full z-10 mt-2">
          {SUGGESTIONS.map((s) => (
            <button
              key={s}
              className="group w-full flex items-center gap-3 text-left px-4 py-3 text-sm font-medium text-gray-700 bg-white border border-gray-200 rounded-xl hover:border-blue-300 hover:bg-blue-50 hover:text-blue-700 transition-all shadow-sm"
            >
              <div className="w-7 h-7 rounded-full bg-gray-100 group-hover:bg-white flex items-center justify-center flex-none text-gray-400 group-hover:text-blue-500 transition-colors shadow-sm">
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
                  <path d="M12 2L15.09 8.26L22 9.27L17 14.14L18.18 21.02L12 17.77L5.82 21.02L7 14.14L2 9.27L8.91 8.26L12 2Z" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
                </svg>
              </div>
              <span className="truncate">{s}</span>
            </button>
          ))}
        </div>
      </div>

      {/* Input area */}
      <div className="flex-none bg-white px-4 py-3 z-20 border-t border-gray-100 shadow-[0_-4px_10px_-2px_rgba(0,0,0,0.03)] relative">
        <div className="relative flex items-center bg-gray-50 border border-gray-200 rounded-xl p-1 focus-within:bg-white focus-within:ring-2 focus-within:ring-blue-500/20 focus-within:border-blue-400 transition-all shadow-sm">
          {/* Idea/Prompt Icon */}
          <div className="pl-2.5 pr-1 text-blue-500">
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
              <path d="M9 21h6m-3-18c-3.866 0-7 3.134-7 7 0 2.21 1.028 4.185 2.632 5.487C9.28 16.035 9.8 16.924 9.8 17.9V19a2 2 0 002 2h4a2 2 0 002-2v-1.1c0-.976.52-1.865 1.168-2.413C20.972 14.185 22 12.21 22 10c0-3.866-3.134-7-7-7z" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
            </svg>
          </div>
          <textarea
            className="flex-1 bg-transparent resize-none text-[13px] font-medium text-gray-900 px-2 py-2 focus:outline-none placeholder-gray-400"
            placeholder="Type your health concern here..."
            rows={1}
          />
          <div className="pr-1 pl-1">
            <button
              className="w-8 h-8 rounded-lg flex items-center justify-center bg-blue-600 hover:bg-blue-700 text-white transition-all shadow-md shadow-blue-500/20 active:scale-95"
            >
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
                <path d="M22 2L11 13M22 2l-7 20-4-9-9-4 20-7z" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
              </svg>
            </button>
          </div>
        </div>
        <p className="text-[10px] font-semibold text-center text-gray-400 mt-2 flex items-center justify-center gap-1.5">
          <svg width="10" height="10" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
            <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
          </svg>
          Secure & confidential. Location requested on first message.
        </p>
      </div>
    </div>
  )
}
