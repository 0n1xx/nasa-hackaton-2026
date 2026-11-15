// One community directory for search and /api/place, so every id search returns can be opened.
//
// Two lists, merged at start-up:
// - server/data/communities.ts: the hand-checked list (with public reported events). Takes precedence.
// - server/data/communities-isc.json: Indigenous Services Canada "First Nation Location" open data
//   (638 First Nations, OGL-Canada). Optional: if the file is missing or unreadable we run on the manual list.
// An ISC entry is dropped as a duplicate when it lies within 15 km of a manual entry whose name shares a
// distinctive word (generic words like "First", "Nation", "Lake" do not count), or when it is listed in
// SAME_AS below. Its name is kept as a search alias of the manual entry.
import { existsSync, readFileSync } from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import type { CommunityMatch, DirectoryCommunity, Envelope, SourceMeta } from '../shared/types.ts'
import { COMMUNITIES } from './data/communities.ts'
import { nearestRegion } from './data/regions.ts'
import { km, src } from './util.ts'

const ISC_FILE = path.resolve(path.dirname(fileURLToPath(import.meta.url)), 'data/communities-isc.json')
const DUPLICATE_KM = 15
/** ISC entries that are the same Nation as a manual entry under a different name. */
const SAME_AS: Record<string, string> = {
  'isc-276': 'pimicikamak', // Cross Lake Band of Indians = Pimicikamak Cree Nation
}
/** Words too common to show two names are the same community. Used only for de-duplication. */
const GENERIC = new Set(['first', 'nation', 'nations', 'band', 'indian', 'indians', 'the', 'of', 'and', 'des', 'de', 'du', 'la', 'le', 'les',
  'cree', 'dene', 'lake', 'river', 'settlement', 'metis', 'anishinaabe', 'anishinaabek', 'anishinabe', 'ojibway', 'ojibwe', 'independent',
  'premiere', 'conseil', 'communaute', 'village', 'tribe', 'tribal'])

interface IscFile {
  source: string; sourceUrl: string; licence: string; pointMeaning: string; retrieved: string
  communities: { id: string; bandNumber: number; name: string; lat: number; lon: number; province: string }[]
}

/** Lowercase, strip diacritics (and ł), drop apostrophes and glottal-stop marks, other punctuation to spaces, collapse spaces. */
export function normalizeName(s: string): string {
  return s.normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/[łŁ]/g, 'l').toLowerCase()
    .replace(/['’‘ʼ`´:?ʔ]/g, '').replace(/[^a-z0-9]+/g, ' ').trim()
}
const words = (s: string) => new Set(normalizeName(s).split(' ').filter((w) => w.length >= 3 && !GENERIC.has(w)))

function loadIsc(): IscFile | null {
  if (!existsSync(ISC_FILE)) return null
  try {
    const j = JSON.parse(readFileSync(ISC_FILE, 'utf8')) as IscFile
    return Array.isArray(j?.communities) ? j : null
  } catch (e) {
    console.warn('[directory] could not read communities-isc.json:', (e as Error).message)
    return null
  }
}

function build() {
  const isc = loadIsc()
  const manual: DirectoryCommunity[] = COMMUNITIES.map((c) => ({ ...c, source: 'manual', bandNumber: null, aliases: [] }))
  const byId = new Map(manual.map((c) => [c.id, c]))
  const manualWords = manual.map((c) => words(c.name))
  const extra: DirectoryCommunity[] = []
  for (const r of isc?.communities ?? []) {
    if (!r?.id || !r.name || !Number.isFinite(r.lat) || !Number.isFinite(r.lon)) continue
    const w = words(r.name)
    const dupIdx = SAME_AS[r.id] ? manual.findIndex((m) => m.id === SAME_AS[r.id])
      : manual.findIndex((m, i) => km(m.lat, m.lon, r.lat, r.lon) <= DUPLICATE_KM && [...w].some((x) => manualWords[i].has(x)))
    if (dupIdx >= 0) {
      const m = manual[dupIdx]
      m.aliases.push(r.name)
      m.bandNumber ??= r.bandNumber ?? null
      continue
    }
    if (byId.has(r.id)) continue
    const c: DirectoryCommunity = {
      id: r.id, name: r.name, kind: 'First Nation', province: r.province, regionId: nearestRegion(r.lat, r.lon)?.id ?? null,
      lat: r.lat, lon: r.lon, reported: [], source: 'isc', bandNumber: r.bandNumber ?? null, aliases: [],
    }
    byId.set(c.id, c)
    extra.push(c)
  }
  const all = [...manual, ...extra]
  // Search terms per entry: full name, name without the parenthetical, each parenthetical, aliases, id.
  const terms = new Map(all.map((c) => {
    const parens = [...c.name.matchAll(/\(([^)]+)\)/g)].map((m) => m[1])
    const base = c.name.replace(/\([^)]*\)/g, ' ')
    return [c.id, [...new Set([c.name, base, ...parens, ...c.aliases, c.id].map(normalizeName).filter(Boolean))]]
  }))
  return { all, byId, terms, isc }
}

const DIR = build()

export const allCommunities = (): readonly DirectoryCommunity[] => DIR.all
export const communityById = (id: string): DirectoryCommunity | undefined => DIR.byId.get(id)

/** Source line for a community's location (for the place response and search). */
export function locationSource(c: Pick<DirectoryCommunity, 'source'>): SourceMeta {
  if (c.source === 'isc' && DIR.isc) {
    return src('isc-first-nations', 'Community location: Indigenous Services Canada open data (OGL-Canada)', 'reference', DIR.isc.sourceUrl,
      `${DIR.isc.licence} ${DIR.isc.pointMeaning} Retrieved ${DIR.isc.retrieved}.`)
  }
  return src('communities', 'Community locations (approximate, public)', 'reference', 'https://open.canada.ca/data/en/dataset/b6567c5c-8339-4055-99fa-63f92114d9e4', 'Hand-checked demonstration list with rounded coordinates')
}

/**
 * Match tiers, best first: 0 exact name (or alternate name), 1 name starts with the query,
 * 2 a word starts with the query (e.g. "coll" → "Namaygoosisagagun (Collins) First Nation"), 3 substring.
 * Within a tier the hand-checked list comes first, then shorter names, then A–Z.
 */
function tier(terms: string[], q: string): number {
  let best = 4
  for (const t of terms) {
    if (t === q) return 0
    if (t.startsWith(q)) best = Math.min(best, 1)
    else if (` ${t}`.includes(` ${q}`)) best = Math.min(best, 2)
    else if (t.includes(q)) best = Math.min(best, 3)
  }
  return best
}

export function searchCommunities(query: string, limit = 10): Envelope<CommunityMatch[]> {
  const q = normalizeName(String(query ?? '').slice(0, 100))
  const sources = [locationSource({ source: 'manual' }), ...(DIR.isc ? [locationSource({ source: 'isc' })] : [])]
  if (!q) return { data: [], sources }
  const hits = DIR.all.map((c) => ({ c, t: tier(DIR.terms.get(c.id)!, q) })).filter((h) => h.t < 4)
  hits.sort((a, b) => a.t - b.t || (a.c.source === b.c.source ? 0 : a.c.source === 'manual' ? -1 : 1) || a.c.name.length - b.c.name.length || a.c.name.localeCompare(b.c.name))
  return { data: hits.slice(0, limit).map(({ c }) => ({ id: c.id, name: c.name, kind: c.kind, province: c.province, regionId: c.regionId, source: c.source })), sources }
}
