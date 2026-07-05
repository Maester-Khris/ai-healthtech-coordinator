// webapp/src/components/mobile/BottomNavBar.tsx
import { MapPin, Buildings, FirstAid, ChatCircle } from '@phosphor-icons/react'

export type MobileTab = 'map' | 'facilities' | 'triage' | 'chat'

interface BottomNavBarProps {
  activeTab: MobileTab
  onTabChange: (tab: MobileTab) => void
}

const TABS: Array<{ id: MobileTab; label: string; Icon: typeof MapPin }> = [
  { id: 'map',        label: 'MAP',        Icon: MapPin    },
  { id: 'facilities', label: 'FACILITIES', Icon: Buildings  },
  { id: 'triage',    label: 'TRIAGE',     Icon: FirstAid   },
  { id: 'chat',      label: 'CHAT',       Icon: ChatCircle },
]

export function BottomNavBar({ activeTab, onTabChange }: BottomNavBarProps) {
  return (
    <nav
      style={{
        position: 'fixed',
        bottom: 0, left: 0, right: 0,
        height: 64,
        background: 'rgba(6,18,25,0.97)',
        backdropFilter: 'blur(20px)',
        borderTop: '1px solid rgba(28,70,89,0.50)',
        paddingBottom: 'env(safe-area-inset-bottom)',
        display: 'grid',
        gridTemplateColumns: 'repeat(4, 1fr)',
        zIndex: 50,
      }}
    >
      {TABS.map(({ id, label, Icon }) => {
        const isActive = activeTab === id
        const color = isActive ? '#48F6C1' : '#85A4B1'
        return (
          <button
            key={id}
            onClick={() => onTabChange(id)}
            className="flex flex-col items-center justify-center gap-1 h-full relative border-none bg-transparent cursor-pointer"
            style={{ minHeight: 44 }}
            aria-label={label}
          >
            {isActive && (
              <span
                className="absolute top-0 left-2 right-2"
                style={{ height: 2, background: '#48F6C1', borderRadius: 1 }}
              />
            )}
            <Icon size={20} color={color} weight={isActive ? 'fill' : 'regular'} />
            <span
              className="font-mono text-[9px] uppercase tracking-wide"
              style={{ color }}
            >
              {label}
            </span>
          </button>
        )
      })}
    </nav>
  )
}
