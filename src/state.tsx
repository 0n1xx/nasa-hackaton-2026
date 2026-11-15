import { createContext, useContext, useEffect, useMemo, useState, type ReactNode } from 'react'
import type { Mode, Region, StatusData } from '../shared/types.ts'

interface AppState {
  regions: Region[]
  region: Region | null
  setRegionId: (id: string) => void
  mode: Mode
  setMode: (m: Mode) => void
  status: StatusData | null
  bootError: string | null
}
const Ctx = createContext<AppState | null>(null)
export const useApp = () => { const c = useContext(Ctx); if (!c) throw new Error('AppProvider missing'); return c }

const stored = (k: string) => { try { return localStorage.getItem(k) } catch { return null } }
const store = (k: string, v: string) => { try { localStorage.setItem(k, v) } catch { /* private mode */ } }

export function AppProvider({ children }: { children: ReactNode }) {
  const [regions, setRegions] = useState<Region[]>([])
  const [regionId, setRegionIdRaw] = useState(stored('bw.region') ?? 'thunder-bay')
  const [mode, setModeRaw] = useState<Mode | null>((stored('bw.mode') as Mode | null))
  const [status, setStatus] = useState<StatusData | null>(null)
  const [bootError, setBootError] = useState<string | null>(null)

  useEffect(() => {
    Promise.all([fetch('/api/regions').then((r) => r.json()), fetch('/api/status').then((r) => r.json())])
      .then(([r, s]) => { setRegions(r.data); setStatus(s); setModeRaw((m) => m ?? s.defaultMode) })
      .catch(() => setBootError('The Before the Smoke API is not responding. Start it with "npm run dev".'))
  }, [])

  const value = useMemo<AppState>(() => ({
    regions, region: regions.find((r) => r.id === regionId) ?? regions[0] ?? null,
    setRegionId: (id) => { setRegionIdRaw(id); store('bw.region', id) },
    mode: mode ?? 'live', setMode: (m) => { setModeRaw(m); store('bw.mode', m) },
    status, bootError,
  }), [regions, regionId, mode, status, bootError])

  return <Ctx.Provider value={value}>{children}</Ctx.Provider>
}
