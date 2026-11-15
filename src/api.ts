import { useCallback, useEffect, useState } from 'react'
import type { Envelope, SourceMeta } from '../shared/types.ts'
import { useApp } from './state.tsx'

export interface ApiState<T> { data: T | null; sources: SourceMeta[]; loading: boolean; error: string | null; reload: () => void }

/** Endpoints that take ?days= (forecast days ahead). */
const FORECAST_PATHS = ['risk/', 'risk-grid', 'summary', 'air/']

/** GET /api/<path> in the current mode (and forecast horizon, for forecast endpoints). Pass null to skip. Re-runs when path, mode or horizon changes. */
export function useApi<T>(path: string | null): ApiState<T> {
  const { mode, regions, horizon } = useApp()
  const [state, setState] = useState<{ data: T | null; sources: SourceMeta[]; loading: boolean; error: string | null }>({ data: null, sources: [], loading: !!path, error: null })
  const [tick, setTick] = useState(0)
  const ready = regions.length > 0

  useEffect(() => {
    if (!path || !ready) return
    const ctrl = new AbortController()
    setState((s) => ({ ...s, loading: true, error: null }))
    const days = FORECAST_PATHS.some((p) => path.startsWith(p)) ? `&days=${horizon}` : ''
    fetch(`/api/${path}${path.includes('?') ? '&' : '?'}mode=${mode}${days}`, { signal: ctrl.signal })
      .then(async (res) => {
        const body = await res.json().catch(() => null)
        if (!res.ok) throw new Error(body?.error ?? `Request failed (${res.status})`)
        const env = body as Envelope<T>
        setState({ data: env.data, sources: env.sources ?? [], loading: false, error: null })
      })
      .catch((e) => { if (e.name !== 'AbortError') setState({ data: null, sources: [], loading: false, error: e.message === 'Failed to fetch' ? 'The Before the Smoke API is not responding.' : e.message }) })
    return () => ctrl.abort()
  }, [path, mode, horizon, tick, ready])

  const reload = useCallback(() => setTick((t) => t + 1), [])
  return { ...state, reload }
}
