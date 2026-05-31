import { useEffect, useRef } from 'react'
import { useMap } from 'react-leaflet'

export function MapSizeGuard({ sizeVersion }: { sizeVersion: number }) {
  const map = useMap()
  const isFirstRef = useRef(true)

  useEffect(() => {
    if (isFirstRef.current) {
      // Fix B: initial mount — give the DOM 100ms to paint at its real height
      isFirstRef.current = false
      const t = setTimeout(() => map.invalidateSize(), 100)
      return () => clearTimeout(t)
    }
    // Fix C: triggered by sizeVersion increment after tab-switch / expand-collapse.
    // The 150ms delay is already held by the caller; call immediately here.
    map.invalidateSize()
  }, [map, sizeVersion])

  return null
}
