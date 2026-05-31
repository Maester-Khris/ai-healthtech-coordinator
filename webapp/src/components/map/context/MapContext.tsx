import { createContext, useContext, type ReactNode } from 'react'
import type { TriageUIState } from '../../../../../shared/types'
import { INACTIVE_TRIAGE } from '../config/constants'

interface MapContextValue {
  activeTriage:  TriageUIState
  recommendedId: string | null
  isMobile:      boolean
}

export const MapContext = createContext<MapContextValue>({
  activeTriage:  INACTIVE_TRIAGE,
  recommendedId: null,
  isMobile:      false,
})

export function MapProvider({
  children,
  activeTriage,
  recommendedId,
  isMobile,
}: {
  children:      ReactNode
  activeTriage:  TriageUIState
  recommendedId: string | null
  isMobile:      boolean
}) {
  return (
    <MapContext.Provider value={{ activeTriage, recommendedId, isMobile }}>
      {children}
    </MapContext.Provider>
  )
}

export const useMapContext = () => useContext(MapContext)
