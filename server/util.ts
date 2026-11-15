import type { IntegrationStatus, SourceMeta, DataKind } from '../shared/types.ts'

const TTL = Number(process.env.CACHE_TTL_SECONDS ?? 600) * 1000
const cache = new Map<string, { at: number; value: unknown }>()
const inflight = new Map<string, Promise<unknown>>()

/** Cache + de-duplicate concurrent calls. Failures are not cached. */
export async function cached<T>(key: string, fn: () => Promise<T>, ttl = TTL): Promise<T> {
  const hit = cache.get(key)
  if (hit && Date.now() - hit.at < ttl) return hit.value as T
  const pending = inflight.get(key)
  if (pending) return pending as Promise<T>
  const p = fn().then((v) => { cache.set(key, { at: Date.now(), value: v }); return v }).finally(() => inflight.delete(key))
  inflight.set(key, p)
  return p
}

export class UpstreamError extends Error {
  constructor(public integration: string, message: string) { super(message) }
}

// --- integration registry: what is configured and whether the last call worked ---
const registry = new Map<string, IntegrationStatus>()
export function registerIntegration(s: Omit<IntegrationStatus, 'lastOk' | 'lastError'>) {
  registry.set(s.id, { ...s, lastOk: null, lastError: null })
}
export const integrations = () => [...registry.values()]

/** Fetch with timeout; records success/failure per integration. Never logs URLs (they may contain keys). */
export async function fetchUpstream(integration: string, url: string, as: 'json' | 'text' = 'json', timeoutMs = 15000): Promise<any> {
  const st = registry.get(integration)
  try {
    const res = await fetch(url, { signal: AbortSignal.timeout(timeoutMs), headers: { 'User-Agent': 'BeforeTheSmoke/0.1 (NASA Space Apps prototype)' } })
    if (!res.ok) throw new Error(`HTTP ${res.status}`)
    const body = as === 'json' ? await res.json() : await res.text()
    if (st) { st.lastOk = new Date().toISOString(); st.lastError = null }
    return body
  } catch (e: any) {
    const msg = e?.name === 'TimeoutError' ? 'timed out' : (e?.cause?.code ?? e?.message ?? 'request failed')
    if (st) st.lastError = `${new Date().toISOString()} — ${msg}`
    throw new UpstreamError(integration, `${st?.name ?? integration}: ${msg}`)
  }
}

export const src = (id: string, label: string, kind: DataKind, url?: string, note?: string): SourceMeta =>
  ({ id, label, kind, url, note, fetchedAt: new Date().toISOString() })

export const num = (v: unknown): number | null => {
  if (v == null || v === '') return null
  const n = Number(v)
  return Number.isFinite(n) ? n : null
}

/** Great-circle distance in km. */
export function km(aLat: number, aLon: number, bLat: number, bLon: number): number {
  const r = Math.PI / 180, dLat = (bLat - aLat) * r, dLon = (bLon - aLon) * r
  const h = Math.sin(dLat / 2) ** 2 + Math.cos(aLat * r) * Math.cos(bLat * r) * Math.sin(dLon / 2) ** 2
  return 12742 * Math.asin(Math.sqrt(h))
}

/** Minimal CSV parser (handles quoted fields). Returns rows keyed by trimmed, lower-cased header. */
export function parseCsv(text: string): Record<string, string>[] {
  const rows: string[][] = []
  let row: string[] = [], cell = '', q = false
  for (let i = 0; i < text.length; i++) {
    const c = text[i]
    if (q) { if (c === '"' && text[i + 1] === '"') { cell += '"'; i++ } else if (c === '"') q = false; else cell += c }
    else if (c === '"') q = true
    else if (c === ',') { row.push(cell); cell = '' }
    else if (c === '\n') { row.push(cell); rows.push(row); row = []; cell = '' }
    else if (c !== '\r') cell += c
  }
  if (cell || row.length) { row.push(cell); rows.push(row) }
  const head = (rows.shift() ?? []).map((h) => h.trim().toLowerCase())
  return rows.filter((r) => r.length >= head.length - 1 && r.some((c) => c.trim())).map((r) => Object.fromEntries(head.map((h, i) => [h, (r[i] ?? '').trim()])))
}

const COMPASS8 = ['N', 'NE', 'E', 'SE', 'S', 'SW', 'W', 'NW'] as const
/** 8-point compass direction of the initial great-circle bearing from a to b. */
export function compass8(aLat: number, aLon: number, bLat: number, bLon: number): (typeof COMPASS8)[number] {
  const r = Math.PI / 180, dLon = (bLon - aLon) * r
  const y = Math.sin(dLon) * Math.cos(bLat * r)
  const x = Math.cos(aLat * r) * Math.sin(bLat * r) - Math.sin(aLat * r) * Math.cos(bLat * r) * Math.cos(dLon)
  const deg = (Math.atan2(y, x) / r + 360) % 360
  return COMPASS8[Math.round(deg / 45) % 8]
}
