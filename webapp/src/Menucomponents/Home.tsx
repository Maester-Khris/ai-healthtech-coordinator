import { MapPanel } from './subcomponent/MapPanel'
import { ChatPanel } from './subcomponent/ChatPanel'

export default function Home() {
  return (
    <div className="flex flex-col h-screen bg-white">
      {/* Header */}
      <header className="h-[52px] flex-none flex items-center justify-between px-6 border-b border-gray-200 bg-white z-10">
        {/* Logo + wordmark */}
        <div className="flex items-center gap-3">
          <div
            className="flex items-center justify-center w-8 h-8 rounded-md flex-none"
            style={{ backgroundColor: '#185FA5' }}
          >
            <svg width="18" height="18" viewBox="0 0 18 18" fill="none" xmlns="http://www.w3.org/2000/svg">
              <path d="M9 2v14M2 9h14" stroke="white" strokeWidth="2.5" strokeLinecap="round" />
            </svg>
          </div>
          <div className="leading-tight">
            <span className="text-[15px] font-semibold text-gray-900">MediCoord AI</span>
            <span className="ml-2 text-[12px] text-gray-400">City-wide health coordination</span>
          </div>
        </div>

        {/* Nav — empty for now */}
        <nav className="flex-1" />

        {/* Actions */}
        <div className="flex items-center gap-2">
          <button className="px-4 py-1.5 text-[13px] font-medium text-gray-700 border border-gray-300 rounded-md hover:bg-gray-50 transition-colors">
            Sign in
          </button>
          <button
            className="px-4 py-1.5 text-[13px] font-medium text-white rounded-md hover:opacity-90 transition-opacity"
            style={{ backgroundColor: '#185FA5' }}
          >
            Get started
          </button>
        </div>
      </header>

      {/* Body — 70/30 split */}
      <div className="flex flex-1 overflow-hidden">
        {/* Map panel — 70% */}
        <div className="flex-none overflow-hidden" style={{ width: '70%' }}>
          <MapPanel />
        </div>

        {/* Divider */}
        <div className="w-px bg-gray-200 flex-none" />

        {/* Chat panel — 30% */}
        <div className="flex-1 overflow-hidden">
          <ChatPanel />
        </div>
      </div>
    </div>
  )
}
