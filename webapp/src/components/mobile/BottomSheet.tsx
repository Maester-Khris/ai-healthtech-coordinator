import { forwardRef, type ReactNode } from 'react'

interface BottomSheetProps {
  children: ReactNode
}

export const BottomSheet = forwardRef<HTMLDivElement, BottomSheetProps>(
  function BottomSheet({ children }, ref) {
    return (
      <div
        ref={ref}
        className="flex flex-col surface-card border-t border-stratum-border overflow-hidden"
        style={{ flexShrink: 0 }}
      >
        {/* DRAG DISABLED — revisit later */}
        {/*
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
        */}
        {/* DRAG DISABLED — revisit later */}
        {children}
      </div>
    )
  }
)
