import { Link } from 'react-router-dom'

interface WebNavBarProps {
  rightContent?: React.ReactNode
}

export function WebNavBar({ rightContent }: WebNavBarProps) {
  return (
    <header className="flex-none flex items-center justify-between px-8 bg-stratum-bg border-b border-stratum-border z-10" style={{ height: 64 }}>
      <Link to="/app" className="flex items-center gap-3 no-underline">
        <div className="flex items-center justify-center w-10 h-10 rounded-stratum-control flex-none overflow-hidden shadow-md">
          <img src="/logo.png" alt="MediCoord AI" className="w-full h-full object-cover" />
        </div>
        <div className="leading-tight flex flex-col">
          <span className="text-lg font-bold text-stratum-text tracking-tight">
            MediCoord<span className="text-stratum-accent">AI</span>
          </span>
          <span className="text-label-md text-stratum-text-muted uppercase tracking-wider">
            Health Tech Platform
          </span>
        </div>
      </Link>

      <div className="flex items-center gap-4 ml-auto">
        <Link
          to="/sandbox"
          className="flex items-center gap-1.5 px-3 py-1.5 text-[12px] font-semibold text-stratum-text-muted hover:text-stratum-text rounded-stratum-md transition-colors no-underline"
          style={{ border: "0.5px solid var(--color-stratum-border)" }}
        >
          <i className="ti ti-flask" style={{ fontSize: 13, color: "#EF9F27" }} />
          Sandbox
        </Link>
        {rightContent && <div className="flex items-center gap-4">{rightContent}</div>}
      </div>
    </header>
  )
}
