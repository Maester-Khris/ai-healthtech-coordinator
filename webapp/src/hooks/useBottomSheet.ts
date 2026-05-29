import { useState, useRef, useCallback } from 'react'

export type SheetState = 'collapsed' | 'expanded'

interface UseBottomSheetReturn {
  sheetState: SheetState
  dragOffset: number
  isDragging: boolean
  handleTouchStart: (e: React.TouchEvent) => void
  handleTouchMove: (e: React.TouchEvent) => void
  handleTouchEnd: () => void
  expand: () => void
  collapse: () => void
}

const SNAP_THRESHOLD = 80

export function useBottomSheet(): UseBottomSheetReturn {
  const [sheetState, setSheetState] = useState<SheetState>('collapsed')
  const [dragOffset, setDragOffset] = useState(0)
  const [isDragging, setIsDragging] = useState(false)
  const startYRef = useRef(0)
  const dragOffsetRef = useRef(0)

  const handleTouchStart = useCallback((e: React.TouchEvent) => {
    startYRef.current = e.touches[0].clientY
    setIsDragging(true)
  }, [])

  const handleTouchMove = useCallback((e: React.TouchEvent) => {
    // positive = dragged up (toward top of screen), negative = dragged down
    const offset = startYRef.current - e.touches[0].clientY
    dragOffsetRef.current = offset
    setDragOffset(offset)
  }, [])

  const handleTouchEnd = useCallback(() => {
    setIsDragging(false)
    // positive offset = dragged up = expand map
    // negative offset = dragged down = collapse map (grow sheet)
    if (dragOffsetRef.current > SNAP_THRESHOLD) setSheetState('expanded')
    else if (dragOffsetRef.current < -SNAP_THRESHOLD) setSheetState('collapsed')
    dragOffsetRef.current = 0
    setDragOffset(0)
  }, [])

  const expand = useCallback(() => setSheetState('expanded'), [])
  const collapse = useCallback(() => setSheetState('collapsed'), [])

  return {
    sheetState,
    dragOffset,
    isDragging,
    handleTouchStart,
    handleTouchMove,
    handleTouchEnd,
    expand,
    collapse,
  }
}
