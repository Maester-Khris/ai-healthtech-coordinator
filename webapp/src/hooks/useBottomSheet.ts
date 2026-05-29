import { useState, useRef, useCallback, useLayoutEffect } from 'react'

export type SheetState = 'collapsed' | 'expanded'

const MIN_SHEET_H = 70
const SNAP_THRESHOLD = 80

interface UseBottomSheetOptions {
  mapRef: React.RefObject<HTMLDivElement | null>
  sheetRef: React.RefObject<HTMLDivElement | null>
  availH: number
  initialMapH: number
}

interface UseBottomSheetReturn {
  sheetState: SheetState
  handleTouchStart: (e: React.TouchEvent) => void
  handleTouchMove: (e: React.TouchEvent) => void
  handleTouchEnd: () => void
}

export function useBottomSheet({
  mapRef,
  sheetRef,
  availH,
  initialMapH,
}: UseBottomSheetOptions): UseBottomSheetReturn {
  const [sheetState, setSheetState] = useState<SheetState>('collapsed')

  const startYRef = useRef(0)
  const startMapHRef = useRef(initialMapH)
  const sheetStateRef = useRef<SheetState>('collapsed')

  // Keep latest values accessible inside stable callbacks without re-creating them
  const availHRef = useRef(availH)
  const initialMapHRef = useRef(initialMapH)
  availHRef.current = availH
  initialMapHRef.current = initialMapH

  // Set heights synchronously before paint whenever layout dimensions change
  useLayoutEffect(() => {
    const mapEl = mapRef.current
    const sheetEl = sheetRef.current
    if (!mapEl || !sheetEl) return
    if (sheetStateRef.current === 'expanded') {
      mapEl.style.height = (availH - MIN_SHEET_H) + 'px'
      sheetEl.style.height = MIN_SHEET_H + 'px'
    } else {
      mapEl.style.height = initialMapH + 'px'
      sheetEl.style.height = (availH - initialMapH) + 'px'
    }
  }, [availH, initialMapH, mapRef, sheetRef])

  const snapTo = useCallback((state: SheetState) => {
    const mapEl = mapRef.current
    const sheetEl = sheetRef.current
    if (!mapEl || !sheetEl) return
    const aH = availHRef.current
    const iH = initialMapHRef.current
    mapEl.style.transition = 'height 0.25s ease'
    sheetEl.style.transition = 'height 0.25s ease'
    if (state === 'expanded') {
      mapEl.style.height = (aH - MIN_SHEET_H) + 'px'
      sheetEl.style.height = MIN_SHEET_H + 'px'
    } else {
      mapEl.style.height = iH + 'px'
      sheetEl.style.height = (aH - iH) + 'px'
    }
    // Remove transitions after snap so they don't interfere with the next drag
    setTimeout(() => {
      if (mapRef.current) mapRef.current.style.transition = ''
      if (sheetRef.current) sheetRef.current.style.transition = ''
    }, 260)
    sheetStateRef.current = state
    setSheetState(state)
  }, [mapRef, sheetRef])

  const handleTouchStart = useCallback((e: React.TouchEvent) => {
    startYRef.current = e.touches[0].clientY
    const mapEl = mapRef.current
    startMapHRef.current = mapEl
      ? parseFloat(mapEl.style.height) || initialMapHRef.current
      : initialMapHRef.current
  }, [mapRef])

  const handleTouchMove = useCallback((e: React.TouchEvent) => {
    // deltaY > 0 means finger moved down; deltaY < 0 means finger moved up
    const deltaY = e.touches[0].clientY - startYRef.current
    const aH = availHRef.current
    const iH = initialMapHRef.current
    // Subtracting deltaY: moving up (negative delta) grows the map
    const newMapH = Math.max(iH, Math.min(aH - MIN_SHEET_H, startMapHRef.current - deltaY))
    const mapEl = mapRef.current
    const sheetEl = sheetRef.current
    if (mapEl) mapEl.style.height = newMapH + 'px'
    if (sheetEl) sheetEl.style.height = (aH - newMapH) + 'px'
  }, [mapRef, sheetRef])

  const handleTouchEnd = useCallback(() => {
    const mapEl = mapRef.current
    const currentMapH = mapEl
      ? parseFloat(mapEl.style.height) || initialMapHRef.current
      : initialMapHRef.current
    // Positive delta = map grew (finger moved up) → snap to expanded
    // Negative delta = map shrank (finger moved down) → snap to collapsed
    const mapDelta = currentMapH - startMapHRef.current
    if (mapDelta > SNAP_THRESHOLD) {
      snapTo('expanded')
    } else if (mapDelta < -SNAP_THRESHOLD) {
      snapTo('collapsed')
    } else {
      snapTo(sheetStateRef.current)
    }
  }, [mapRef, snapTo])

  return { sheetState, handleTouchStart, handleTouchMove, handleTouchEnd }
}
