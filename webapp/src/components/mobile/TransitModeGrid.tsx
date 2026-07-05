// webapp/src/components/mobile/TransitModeGrid.tsx
import { Car, Bicycle, Person } from '@phosphor-icons/react'
import type { RouteResult } from '@shared/types'

export type TransitMode = 'drive' | 'cycle' | 'walk'

interface TransitCell {
  mode: TransitMode
  Icon: typeof Car
  label: string
}

const CELLS: TransitCell[] = [
  { mode: 'drive', Icon: Car,     label: 'DRIVE' },
  { mode: 'cycle', Icon: Bicycle, label: 'CYCLE' },
  { mode: 'walk',  Icon: Person,  label: 'WALK'  },
]

const CELL_STYLE: Record<TransitMode, { bg: string; border: string; color: string }> = {
  drive: { bg: 'rgba(72,246,193,0.15)',  border: 'rgba(72,246,193,0.60)',  color: '#48F6C1' },
  cycle: { bg: 'rgba(0,210,255,0.10)',   border: 'rgba(0,210,255,0.40)',   color: '#00D2FF' },
  walk: { bg: 'rgba(28,70,89,0.30)',    border: 'rgba(28,70,89,0.50)',    color: '#85A4B1' },
}

interface TransitModeGridProps {
  routes: RouteResult[]
  activeMode: TransitMode
  onModeChange: (mode: TransitMode) => void
}

export function TransitModeGrid({ routes, activeMode, onModeChange }: TransitModeGridProps) {
  const driveRoute = routes[0]

  const getEta = (mode: TransitMode): string => {
    if (mode === 'drive' && driveRoute) return `${driveRoute.etaMinutes}min`
    if (mode === 'cycle' && driveRoute) return `${Math.round(driveRoute.etaMinutes * 2.5)}min`
    if (mode === 'walk'  && driveRoute) return `${Math.round(driveRoute.etaMinutes * 6)}min`
    return '—'
  }

  return (
    <div className="grid grid-cols-3 gap-2 mt-3">
      {CELLS.map(({ mode, Icon, label }) => {
        const isActive = activeMode === mode
        const style = isActive ? CELL_STYLE[mode] : CELL_STYLE.walk
        return (
          <button
            key={mode}
            onClick={() => onModeChange(mode)}
            className="flex flex-col items-center justify-center gap-1 rounded-xl cursor-pointer border-none"
            style={{
              height: 56,
              background: style.bg,
              border: `1px solid ${style.border}`,
            }}
          >
            <Icon size={20} color={style.color} />
            <span className="font-mono text-[11px] font-bold" style={{ color: style.color }}>
              {getEta(mode)}
            </span>
            <span className="font-mono text-[9px] uppercase tracking-wide" style={{ color: style.color }}>
              {label}
            </span>
          </button>
        )
      })}
    </div>
  )
}
