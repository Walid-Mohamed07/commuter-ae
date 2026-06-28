'use client';

import { createContext, useContext, type ReactNode } from 'react';
import { useMapState } from './useMapState';

type MapContextType = ReturnType<typeof useMapState>;

const MapContext = createContext<MapContextType | null>(null);

export function MapProvider({ children }: { children: ReactNode }) {
  const mapState = useMapState();
  return <MapContext.Provider value={mapState}>{children}</MapContext.Provider>;
}

export function useMap() {
  const ctx = useContext(MapContext);
  if (!ctx) throw new Error('useMap must be used inside MapProvider');
  return ctx;
}
