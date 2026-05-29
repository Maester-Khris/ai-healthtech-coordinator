import type { ReactNode } from 'react'

interface BottomSheetProps {
  height: number
  isDragging: boolean
  onTouchStart: (e: React.TouchEvent) => void
  onTouchMove: (e: React.TouchEvent) => void
  onTouchEnd: () => void
  showHint?: boolean
  children: ReactNode
}

export function BottomSheet({
  height,
  isDragging,
  onTouchStart,
  onTouchMove,
  onTouchEnd,
  showHint = false,
  children,
}: BottomSheetProps) {
  return (
    <div
      className="flex flex-col bg-white border-t border-gray-200 shadow-[0_-2px_12px_rgba(0,0,0,0.08)] overflow-hidden"
      style={{
        height,
        flexShrink: 0,
        transition: isDragging ? 'none' : 'height 0.25s ease',
      }}
    >
      {/* Drag handle */}
      <div
        onTouchStart={onTouchStart}
        onTouchMove={onTouchMove}
        onTouchEnd={onTouchEnd}
        className="flex-none flex flex-col items-center gap-1 pt-2 pb-1 select-none"
        style={{ touchAction: 'none', cursor: 'grab', minHeight: showHint ? 32 : 20 }}
      >
        <div className="w-7 h-[3px] bg-gray-300 rounded-full" />
        {showHint && (
          <span className="text-[9px] text-gray-400">↑ drag to expand</span>
        )}
      </div>
      {children}
    </div>
  )
}
