import { Link } from 'react-router-dom'

interface WebNavBarProps {
  rightContent?: React.ReactNode
}

export function WebNavBar({ rightContent }: WebNavBarProps) {
  return (
    <header className="flex-none flex items-center justify-between px-8 bg-white border-b border-gray-200 shadow-sm z-10" style={{ height: 64 }}>
      <Link to="/" className="flex items-center gap-3 no-underline">
        <div className="flex items-center justify-center w-10 h-10 rounded-xl flex-none overflow-hidden shadow-md">
          <img src="/logo.png" alt="MediCoord AI" className="w-full h-full object-cover" />
        </div>
        <div className="leading-tight flex flex-col">
          <span className="text-lg font-bold text-gray-900 tracking-tight">
            MediCoord<span className="text-blue-600">AI</span>
          </span>
          <span className="text-[11px] font-semibold text-gray-500 uppercase tracking-wider">
            Health Tech Platform
          </span>
        </div>
      </Link>

      {rightContent && (
        <div className="flex items-center gap-4">
          {rightContent}
        </div>
      )}
    </header>
  )
}
