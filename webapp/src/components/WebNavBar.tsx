import { Link } from 'react-router-dom'

interface WebNavBarProps {
  rightContent?: React.ReactNode
}

export function WebNavBar({ rightContent }: WebNavBarProps) {
  return (
    <header
      className="flex-none flex items-center justify-between px-8 z-10 sticky top-0"
      style={{
        height: 64,
        background: 'rgba(6, 18, 25, 0.92)',
        backdropFilter: 'blur(12px)',
        WebkitBackdropFilter: 'blur(12px)',
        borderBottom: '1px solid rgba(19, 42, 55, 0.80)',
      }}
    >
      <Link to="/app" className="flex items-center gap-3 no-underline">
        <div
          className="flex items-center justify-center w-9 h-9 rounded-lg flex-none overflow-hidden shadow-md"
          style={{ border: '1px solid rgba(28, 70, 89, 0.5)' }}
        >
          <img src="/logo.png" alt="MediCoord AI" className="w-full h-full object-cover" />
        </div>
        <div className="leading-tight flex flex-col">
          <span
            className="text-label-md font-bold tracking-wide uppercase"
            style={{ color: '#E2F1F5' }}
          >
            MediCoord<span style={{ color: '#48F6C1' }}>AI</span>
          </span>
          <span
            className="text-mono-meta uppercase tracking-widest"
            style={{ color: '#7AA0B0', fontSize: 9 }}
          >
            Health Coordination
          </span>
        </div>
      </Link>

      <div className="flex items-center gap-4 ml-auto">
        <Link
          to="/sandbox"
          className="flex items-center gap-1.5 no-underline transition-colors"
          style={{
            padding: '5px 10px',
            fontSize: 12,
            fontWeight: 600,
            color: '#7AA0B0',
            border: '0.5px solid rgba(28, 70, 89, 0.6)',
            borderRadius: 6,
          }}
          onMouseEnter={e => {
            (e.currentTarget as HTMLElement).style.color = '#E2F1F5'
            ;(e.currentTarget as HTMLElement).style.borderColor = 'rgba(245,158,11,0.4)'
          }}
          onMouseLeave={e => {
            (e.currentTarget as HTMLElement).style.color = '#7AA0B0'
            ;(e.currentTarget as HTMLElement).style.borderColor = 'rgba(28, 70, 89, 0.6)'
          }}
        >
          <i className="ti ti-flask" style={{ fontSize: 13, color: '#F59E0B' }} />
          Sandbox
        </Link>
        {rightContent && <div className="flex items-center gap-4">{rightContent}</div>}
      </div>
    </header>
  )
}
