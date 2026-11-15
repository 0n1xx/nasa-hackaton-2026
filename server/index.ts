import express, { type Request, type Response, type NextFunction } from 'express'
import compression from 'compression'
import { existsSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import path from 'node:path'
import type { Mode, StatusData } from '../shared/types.ts'
import { REGIONS } from './data/regions.ts'
import { HISTORY } from './data/history.ts'
import * as svc from './services.ts'
import { parseHorizon } from '../shared/horizon.ts'
import { riskGrid } from './grid.ts'
import { climateHistory } from './climate.ts'
import { placeReport } from './place.ts'
import { searchCommunities } from './directory.ts'
import { placeLevels, rankedPlaces } from './ranked.ts'
import { assistantReply } from './assistant.ts'
import { integrations, src, UpstreamError } from './util.ts'

const app = express()
app.disable('x-powered-by')
// gzip for the API's JSON and the built UI: the lists the map reads shrink about tenfold, which is most of
// the wait on a phone connection.
app.use(compression())
const PORT = Number(process.env.PORT ?? 8787)
const DEFAULT_MODE: Mode = process.env.DEFAULT_MODE === 'sim' ? 'sim' : 'live'

const mode = (req: Request): Mode => (req.query.mode === 'sim' ? 'sim' : req.query.mode === 'live' ? 'live' : DEFAULT_MODE)
const intParam = (v: unknown, def: number, lo: number, hi: number) => {
  if (v === undefined) return def
  const n = Number(v)
  if (!Number.isInteger(n) || n < lo || n > hi) throw new svc.BadRequest(`Parameter must be a whole number from ${lo} to ${hi}`)
  return n
}
const dateParam = (v: unknown) => {
  if (v === undefined || v === '') return undefined
  if (typeof v !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(v) || Number.isNaN(Date.parse(v)) || Date.parse(v) > Date.now()) throw new svc.BadRequest('date must be YYYY-MM-DD and not in the future')
  return v
}
/** ?days= forecast horizon; an invalid value is a 400, not a 500. */
const horizon = (req: Request) => { try { return parseHorizon(req.query.days) } catch (e) { throw new svc.BadRequest((e as Error).message) } }
const route = (fn: (req: Request) => Promise<unknown> | unknown) => (req: Request, res: Response, next: NextFunction) => Promise.resolve().then(() => fn(req)).then((body) => res.json(body)).catch(next)

app.get('/api/status', route((): StatusData => ({ defaultMode: DEFAULT_MODE, integrations: integrations(), serverTime: new Date().toISOString() })))
app.get('/api/regions', route(() => ({ data: REGIONS, sources: [] })))
app.get('/api/history', route(() => ({ data: HISTORY, sources: [src('history', 'National statistics compiled from CIFFC / NRCan publications', 'historical', 'https://cwfis.cfs.nrcan.gc.ca/report', 'Bundled reference table; see notes for what is verified')] })))
app.get('/api/fires/active', route((req) => svc.activeFires(mode(req))))
app.get('/api/fires/hotspots', route((req) => svc.hotspots(mode(req), intParam(req.query.days, 1, 1, 5), dateParam(req.query.date))))
app.get('/api/summary', route((req) => svc.regionSummaries(mode(req), horizon(req))))
app.get('/api/risk/:id', route((req) => svc.regionRisk(mode(req), req.params.id, horizon(req))))
app.get('/api/air-trends', route((req) => svc.airTrends(mode(req))))
app.get('/api/air/:id', route((req) => svc.regionAir(mode(req), req.params.id, intParam(req.query.pastDays, 7, 1, 92), horizon(req))))
app.get('/api/communities', route((req) => svc.communities(mode(req))))
app.get('/api/communities/search', route((req) => searchCommunities(typeof req.query.q === 'string' ? req.query.q : '')))
app.get('/api/place/:id', route((req) => placeReport(mode(req), req.params.id, horizon(req))))
app.get('/api/risk-grid', route((req) => riskGrid(mode(req), horizon(req))))
app.get('/api/climate-history/:id', route((req) => climateHistory(mode(req), req.params.id)))
app.get('/api/places/ranked', route((req) => rankedPlaces(mode(req), horizon(req), intParam(req.query.limit, 8, 1, 50))))
app.get('/api/places/levels', route((req) => placeLevels(mode(req), horizon(req))))
app.post('/api/assistant', express.json({ limit: '64kb' }), route((req) => assistantReply({ messages: Array.isArray(req.body?.messages) ? req.body.messages : [], communityId: typeof req.body?.communityId === 'string' ? req.body.communityId : null, mode: mode(req), days: horizon(req), visitor: req.ip ?? req.socket.remoteAddress ?? 'unknown' }).then((data) => ({ data, sources: [] }))))
app.use('/api', (_req, res) => res.status(404).json({ error: 'Unknown API route' }))

// In production (after `npm run build`) the same server also serves the UI.
const dist = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../dist')
if (existsSync(dist)) {
  // Files under /assets carry a content hash in their name, so a browser may keep them for good.
  app.use('/assets', express.static(path.join(dist, 'assets'), { immutable: true, maxAge: '1y' }))
  // A missing asset is a 404, never the HTML page under a .js name (an old tab after a new build).
  app.use('/assets', (_req, res) => res.status(404).end())
  app.use(express.static(dist))
  app.get('*', (_req, res) => res.sendFile(path.join(dist, 'index.html')))
}

app.use((err: any, _req: Request, res: Response, _next: NextFunction) => {
  if (err instanceof svc.BadRequest) return res.status(400).json({ error: err.message })
  if (err instanceof svc.NotFound) return res.status(404).json({ error: err.message })
  if (err instanceof UpstreamError) return res.status(502).json({ error: `Could not reach a data provider — ${err.message}`, integration: err.integration })
  console.error('[api]', err?.message ?? err)
  res.status(500).json({ error: err?.message ?? 'Unexpected server error' })
})

app.listen(PORT, () => console.log(`Before the Smoke API on http://localhost:${PORT}  (default mode: ${DEFAULT_MODE})`))
