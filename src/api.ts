import { useCallback, useEffect, useRef, useState } from 'react'
import type { Envelope, SourceMeta } from '../shared/types.ts'
import { useApp } from './state.tsx'

export interface ApiState<T> { data: T | null; sources: SourceMeta[]; loading: boolean; error: string | null; reload: () => void }

/** Endpoints that take ?days= (forecast days ahead). */
const FORECAST_PATHS = ['risk/', 'risk-grid', 'summary', 'air/', 'place/', 'places/']

interface Loaded<T> { data: T | null; sources: SourceMeta[]; loading: boolean; error: string | null; /** path|mode the data belongs to */ key: string | null }

// ---- One shared, short-lived response cache ----
// Several components ask for the same thing (the community view and the assistant both read place/:id; the
// map remounts on every screen and asks for five lists again). On a phone connection each repeat costs
// seconds and data. Answers are kept by full URL (so by mode and look-ahead too) for CACHE_MS, and requests
// already on the wire are shared. The server keeps its own 10-minute cache, so this never hides newer data
// for long. reload() always goes to the network.
const CACHE_MS = 60_000
const CACHE_MAX = 40
const cache = new Map<string, { at: number; env: Envelope<unknown> }>()
const inflight = new Map<string, Promise<Envelope<unknown>>>()

function peek<T>(url: string): Envelope<T> | null {
  const hit = cache.get(url)
  if (!hit) return null
  if (Date.now() - hit.at > CACHE_MS) { cache.delete(url); return null }
  return hit.env as Envelope<T>
}

function getJson<T>(url: string, fresh: boolean): Promise<Envelope<T>> {
  const pending = fresh ? undefined : inflight.get(url)
  if (pending) return pending as Promise<Envelope<T>>
  const p: Promise<Envelope<unknown>> = fetch(url).then(async (res) => {
    const body = await res.json().catch(() => null)
    if (!res.ok) throw new Error(body?.error ?? `Request failed (${res.status})`)
    const env = body as Envelope<unknown>
    cache.delete(url) // re-insert so the Map stays ordered oldest first
    cache.set(url, { at: Date.now(), env })
    if (cache.size > CACHE_MAX) cache.delete(cache.keys().next().value as string)
    return env
  }).finally(() => { if (inflight.get(url) === p) inflight.delete(url) })
  inflight.set(url, p)
  return p as Promise<Envelope<T>>
}

/**
 * GET /api/<path> in the current mode (and forecast horizon, for forecast endpoints). Pass null to skip.
 * Re-runs when path, mode or horizon changes.
 *
 * Data is only returned for the path and mode it was fetched for. Without this, switching from the
 * example scenario to live data would keep showing made-up numbers under a "Live data" header until the
 * live response arrived, and opening another community would briefly show the previous one's risk.
 * (A look-ahead change keeps the old data while loading: same place, same mode.)
 */
export function useApi<T>(path: string | null): ApiState<T> {
  const { mode, regions, horizon } = useApp()
  const [state, setState] = useState<Loaded<T>>({ data: null, sources: [], loading: !!path, error: null, key: null })
  const [tick, setTick] = useState(0)
  const lastTick = useRef(0)
  const ready = regions.length > 0
  const key = path ? `${path}|${mode}` : null

  useEffect(() => {
    if (!path || !ready) return
    // reload() bumps the tick: that run skips the cache and any request already on the wire.
    const fresh = tick !== lastTick.current
    lastTick.current = tick
    const days = FORECAST_PATHS.some((p) => path.startsWith(p)) ? `&days=${horizon}` : ''
    const url = `/api/${path}${path.includes('?') ? '&' : '?'}mode=${mode}${days}`
    const k = `${path}|${mode}`
    const hit = fresh ? null : peek<T>(url)
    if (hit) { setState({ data: hit.data, sources: hit.sources ?? [], loading: false, error: null, key: k }); return }
    let live = true
    setState((s) => ({ ...s, loading: true, error: null }))
    getJson<T>(url, fresh)
      .then((env) => { if (live) setState({ data: env.data, sources: env.sources ?? [], loading: false, error: null, key: k }) })
      .catch((e) => { if (live) setState({ data: null, sources: [], loading: false, error: e.message === 'Failed to fetch' ? 'The Before the Smoke API is not responding.' : e.message, key: k }) })
    return () => { live = false }
  }, [path, mode, horizon, tick, ready])

  const reload = useCallback(() => setTick((t) => t + 1), [])
  const current = state.key === key
  return { data: current ? state.data : null, sources: current ? state.sources : [], loading: current ? state.loading : !!path, error: current ? state.error : null, reload }
}
