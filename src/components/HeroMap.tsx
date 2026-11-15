import { useEffect, useLayoutEffect, useMemo, useRef, useState, type ReactNode } from 'react'
import { Circle, CircleMarker, MapContainer, Marker, Pane, Popup, Rectangle, TileLayer, Tooltip, WMSTileLayer, ZoomControl, useMap } from 'react-leaflet'
import { useNavigate, useSearchParams } from 'react-router-dom'
import L from 'leaflet'
import { Flame, Play, Square } from 'lucide-react'
import type { ActiveFire, CommunityExposure, Hotspot, RiskGrid, RiskLevel, SourceMeta } from '../../shared/types.ts'
import { LEVEL_COLORS, levelFor, levelLabel } from '../../shared/risk.ts'
import { useApi } from '../api.ts'
import { useApp } from '../state.tsx'
import { InfoPopover, LevelMeter, placeName } from './ui.tsx'

// The map behind home and the community view. The panel is the answer; the map is context
// (docs/design/critique-and-direction.md §2 "Map and panel"). It rests on the shared day from
// state.tsx (null = today) and never moves it on its own: playback is opt-in and ends on today.

const GIBS_WMS = 'https://gibs.earthdata.nasa.gov/wms/epsg3857/best/wms.cgi'
const NASA_DATE = '2026-07-14'
const NASA_REGION = 'thunder-bay'
const NASA_FALLBACK = { lat: 49.4, lon: -89.6 }
const NASA_ZOOM = 7
const INK = '#1b1f1d'
const FIRE_RED = '#A8231C'
const HEAT_ORANGE = '#ee6a1a'
const PANEL_W = 440 // the home panel sits flush left over the map on md+
const STEP_MS = 1200
const MAX_PLAY = 7
const HOME = { lat: 58, lon: -96 }
const FOCUS_ZOOM = 8
const RINGS_KM = [10, 25]

const ESRI = 'https://server.arcgisonline.com/ArcGIS/rest/services/Canvas'

type GridDay = RiskGrid['days'][number]
/** GET /api/places/levels (server/ranked.ts). Declared here so this file does not depend on the server module. */
interface PlaceLevels {
  days: GridDay[]
  places: { id: string; name: string; kind: string; province: string; lat: number; lon: number; scores: (number | null)[] }[]
}
export interface MapFocus { id: string; name: string; lat: number; lon: number }

const reducedMotion = () => !!window.matchMedia?.('(prefers-reduced-motion: reduce)').matches
const validScore = (v: number | null | undefined): v is number => v != null && !Number.isNaN(v)

// ---- Words for dates, sizes and places (voice guide: docs/plans/2026-11-14-community-hub.md) ----

/** 'YYYY-MM-DD' read as a local date, so the weekday doesn't slip a day west of UTC. */
const localDate = (iso: string) => {
  const [y, m, d] = iso.slice(0, 10).split('-').map(Number)
  return new Date(y, (m || 1) - 1, d || 1)
}
/** A bare date stays a local calendar day; a full timestamp is shown in local time. */
const anyDate = (iso: string) => (iso.length > 10 && !Number.isNaN(Date.parse(iso)) ? new Date(iso) : localDate(iso))
const month = (d: Date) => d.toLocaleDateString('en-US', { month: 'long' })
/** "Sunday 15 November" */
const longDay = (d: Date) => `${d.toLocaleDateString('en-US', { weekday: 'long' })} ${d.getDate()} ${month(d)}`
/** "10:34 p.m." */
const clock = (d: Date) => {
  const h = d.getHours(), m = String(d.getMinutes()).padStart(2, '0')
  return `${h % 12 || 12}:${m} ${h >= 12 ? 'p.m.' : 'a.m.'}`
}
/** Exact index of a date in a list of days. A miss draws nothing for that layer, never a different day. */
const dayIndex = (days: GridDay[] | undefined, date: string | null) => (!days?.length || date == null ? -1 : days.findIndex((d) => d.date === date))
type DayKind = GridDay['kind']
/** Kind of a date by the data's own calendar (not the browser's clock), so the words match the panel. */
const kindOf = (day: string, days: GridDay[] | undefined): DayKind => {
  const k = days?.find((d) => d.date === day)?.kind
  if (k) return k
  const t = days?.find((d) => d.kind === 'today')?.date
  return !t || day === t ? 'today' : day > t ? 'forecast' : 'historical'
}
/** "Showing today", "Showing Sunday 15 November (expected)", "Showing Wednesday 11 November (past)" */
const showingLine = (day: string | null, days: GridDay[] | undefined) => {
  if (day == null) return 'Showing today'
  const k = kindOf(day, days)
  if (k === 'today') return 'Showing today'
  return `Showing ${longDay(localDate(day))} (${k === 'forecast' ? 'expected' : 'past'})`
}
/** "today", "on Sunday 15 November (expected)", "on Wednesday 11 November" */
const whenWords = (day: string | null, days: GridDay[] | undefined) => {
  if (day == null) return 'today'
  const k = kindOf(day, days)
  if (k === 'today') return 'today'
  return `on ${longDay(localDate(day))}${k === 'forecast' ? ' (expected)' : ''}`
}

/** Fire size as people picture it: "About 137 square kilometres". */
const fireSize = (ha: number | null | undefined) => {
  if (ha == null || Number.isNaN(ha)) return 'Size not reported'
  if (ha < 100) return 'Less than 1 square kilometre'
  const km2 = Math.round(ha / 100)
  return `About ${km2.toLocaleString('en-US')} square kilometre${km2 === 1 ? '' : 's'}`
}
const STATUS: Record<string, string> = {
  OC: 'Out of control: the fire is still spreading.',
  BH: 'Being held: not expected to spread past its edges for now.',
  UC: 'Under control: not expected to spread any further.',
  EX: 'Out: the fire is out.',
}

const toRad = (d: number) => (d * Math.PI) / 180
const distanceKm = (a: { lat: number; lon: number }, b: { lat: number; lon: number }) => {
  const dLat = toRad(b.lat - a.lat), dLon = toRad(b.lon - a.lon)
  const h = Math.sin(dLat / 2) ** 2 + Math.cos(toRad(a.lat)) * Math.cos(toRad(b.lat)) * Math.sin(dLon / 2) ** 2
  return 6371 * 2 * Math.asin(Math.sqrt(h))
}
const COMPASS = ['north', 'north-east', 'east', 'south-east', 'south', 'south-west', 'west', 'north-west']
/** Direction you would travel from `from` to reach `to`. */
const direction = (from: { lat: number; lon: number }, to: { lat: number; lon: number }) => {
  const y = Math.sin(toRad(to.lon - from.lon)) * Math.cos(toRad(to.lat))
  const x = Math.cos(toRad(from.lat)) * Math.sin(toRad(to.lat)) - Math.sin(toRad(from.lat)) * Math.cos(toRad(to.lat)) * Math.cos(toRad(to.lon - from.lon))
  const deg = ((Math.atan2(y, x) * 180) / Math.PI + 360) % 360
  return COMPASS[Math.round(deg / 45) % 8]
}
/** "13 km south-west of Whitesand First Nation" */
const whereFrom = (p: { lat: number; lon: number }, focus: MapFocus) => {
  const km = distanceKm(focus, p)
  if (km < 1) return `Less than 1 km from ${focus.name}`
  return `${Math.round(km)} km ${direction(focus, p)} of ${focus.name}`
}

/** Last line of a popup: where the data came from and when, in words. Example data says so instead. */
const fromLine = (s: SourceMeta | undefined, sim: boolean) => {
  if (sim || s?.kind === 'simulated') return 'Example scenario, not real conditions.'
  if (!s) return null
  const who = s.id === 'cwfis-active' || s.id === 'cwfis-hotspots' ? 'Canada’s wildfire information system'
    : s.id.startsWith('firms') ? 'NASA’s fire satellites (FIRMS)' : s.label
  const at = new Date(s.fetchedAt)
  return Number.isNaN(at.getTime()) ? `From ${who}.` : `From ${who}. Updated ${at.getDate()} ${month(at)}, ${clock(at)}`
}

// ---- Map symbols, built once ----

const FLAME_SVG = '<svg xmlns="http://www.w3.org/2000/svg" width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="#ffffff" stroke-width="2.25" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M8.5 14.5A2.5 2.5 0 0 0 11 12c0-1.38-.5-2-1-3-1.072-2.143-.224-4.054 2-6 .5 2.5 2 4.9 4 6.5 2 1.6 3 3.5 3 5.5a7 7 0 1 1-14 0c0-1.153.433-2.294 1-3a2.5 2.5 0 0 0 2.5 2.5z"/></svg>'
const FLAME_ICON = L.divIcon({ className: 'hero-fire-icon', html: FLAME_SVG, iconSize: [22, 22], iconAnchor: [11, 11], popupAnchor: [0, -10], tooltipAnchor: [12, 0] })
const HEAT_ICON = L.divIcon({ className: 'hero-heat-icon', html: '', iconSize: [6, 6], iconAnchor: [3, 3], tooltipAnchor: [4, 0] })
const ringIcon = (km: number) => L.divIcon({ className: 'hero-ring-label', html: `${km} km`, iconSize: [56, 20], iconAnchor: [28, 10] })
const RING_ICONS = Object.fromEntries(RINGS_KM.map((k) => [k, ringIcon(k)])) as Record<number, L.DivIcon>

/** The body of every map popup: a title, a few short sentences, then where the data came from. */
function Card({ title, sub, children, from }: { title: string; sub?: string; children?: ReactNode; from?: string | null }) {
  return <div className="w-[248px] font-sans text-[15px] leading-snug text-fg">
    <div className="text-[16px] font-semibold">{title}</div>
    {sub && <div className="mt-0.5 text-[14px] text-mute">{sub}</div>}
    {children && <div className="mt-2 space-y-1">{children}</div>}
    {from && <div className="mt-2.5 border-t border-line pt-2 text-[14px] text-mute">{from}</div>}
  </div>
}

/** Moves the map when the target changes: jumps on first load, flies (0.8 s) after that.
 *  `shift` pushes the target right by that many pixels, clear of a panel lying over the map's left edge. */
function FlyTo({ lat, lon, zoom, shift }: { lat: number; lon: number; zoom: number; shift: number }) {
  const map = useMap()
  const first = useRef(true)
  useEffect(() => {
    const center = map.unproject(map.project([lat, lon], zoom).subtract([shift, 0]), zoom)
    if (first.current) { first.current = false; map.setView(center, zoom, { animate: false }); return }
    map.flyTo(center, zoom, { duration: 0.8, animate: !reducedMotion() })
  }, [lat, lon, zoom, shift, map])
  return null
}

export default function HeroMap({ focus = null }: { focus?: { id: string; name: string; lat: number; lon: number } | null }) {
  const { regions, mode, day, setDay, horizon } = useApp()
  const navigate = useNavigate()
  const [query] = useSearchParams()
  const [nasa, setNasa] = useState(() => query.get('nasa') === '1')
  const [keyOpen, setKeyOpen] = useState(false)
  const sim = mode === 'sim'

  const fires = useApi<ActiveFire[]>('fires/active')
  const hotspots = useApi<Hotspot[]>('fires/hotspots')
  const communities = useApi<CommunityExposure[]>('communities')
  const levelsApi = useApi<PlaceLevels>('places/levels')
  const gridApi = useApi<RiskGrid>('risk-grid')
  // Anything missing or malformed falls back silently: no field, or neutral community discs.
  const grid = gridApi.data && gridApi.data.days?.length && gridApi.data.cells?.length ? gridApi.data : null
  const levels = levelsApi.data && levelsApi.data.days?.length && levelsApi.data.places?.length ? levelsApi.data : null

  // Does a panel lie over the map's left edge (home on md+)? Then overlays and targets move clear of it.
  // Layout follows the map's own size, not the window: on home and the community view the map is a column.
  const box = useRef<HTMLDivElement>(null)
  const [underPanel, setUnderPanel] = useState(false)
  const [size, setSize] = useState({ w: 0, h: 0 })
  useLayoutEffect(() => {
    const check = () => {
      const r = box.current?.getBoundingClientRect()
      if (!r) return
      setUnderPanel(window.innerWidth >= 768 && r.left < 120 && r.width > PANEL_W + 200)
      setSize((s) => (s.w === Math.round(r.width) && s.h === Math.round(r.height) ? s : { w: Math.round(r.width), h: Math.round(r.height) }))
    }
    check()
    const ro = typeof ResizeObserver !== 'undefined' ? new ResizeObserver(check) : null
    if (ro && box.current) ro.observe(box.current)
    window.addEventListener('resize', check)
    return () => { ro?.disconnect(); window.removeEventListener('resize', check) }
  }, [])
  const clear = underPanel ? 'md:left-[456px]' : ''
  const visibleW = underPanel ? size.w - PANEL_W : size.w
  const wideBar = visibleW >= 720 // caption and the long toggle label fit on one row
  const roomyKey = visibleW >= 480 && size.h >= 460 // room for the open legend without hiding the map

  // ---- The shared day, and opt-in playback ----
  // One shown date for every layer. The community levels (same scoring as the panel) set the calendar;
  // the risk field is looked up by that date, so field, discs and caption never show different days.
  const knownDays = levels?.days ?? grid?.days
  const shown = day ?? knownDays?.find((d) => d.kind === 'today')?.date ?? null
  const gi = dayIndex(grid?.days, shown)
  const li = dayIndex(levels?.days, shown)
  const playList = useMemo(() => (knownDays ?? []).filter((d) => d.kind === 'forecast').map((d) => d.date).slice(0, Math.min(horizon, MAX_PLAY)), [knownDays, horizon])
  const [playing, setPlaying] = useState(false)
  const expected = useRef<string | null | undefined>(undefined)
  const playingRef = useRef(false)
  playingRef.current = playing
  const canPlay = !reducedMotion() && playList.length > 0

  useEffect(() => {
    if (!playing) return
    const seq: (string | null)[] = [...playList, null]
    let i = 0, timer = 0
    const step = () => {
      const v = seq[i++]
      expected.current = v
      setDay(v)
      if (i < seq.length) timer = window.setTimeout(step, STEP_MS)
      else { expected.current = undefined; setPlaying(false) }
    }
    step()
    return () => window.clearTimeout(timer)
    // The run is fixed when it starts; a change of look-ahead mid-run does not restart it.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [playing])
  // Someone picked a day in the panel mid-run: their choice wins, playback stops there.
  useEffect(() => {
    if (playingRef.current && expected.current !== undefined && day !== expected.current) { expected.current = undefined; setPlaying(false) }
  }, [day])
  // Never leave the screen on a future day because the map was playing when it went away.
  useEffect(() => () => { if (playingRef.current) setDay(null) }, [setDay])
  const stop = () => { expected.current = undefined; setPlaying(false); setDay(null) }
  const showNasa = (on: boolean) => { if (on && playingRef.current) stop(); setNasa(on) }

  // ---- Where the map looks ----
  const nasaRegion = regions.find((r) => r.id === NASA_REGION) ?? NASA_FALLBACK
  const narrow = (size.w || window.innerWidth) < 700
  const target = nasa ? { lat: nasaRegion.lat, lon: nasaRegion.lon, zoom: NASA_ZOOM }
    : focus ? { lat: focus.lat, lon: focus.lon, zoom: FOCUS_ZOOM }
    : { lat: HOME.lat, lon: HOME.lon, zoom: narrow ? 3 : 4 }
  const shift = underPanel ? PANEL_W / 2 : 0

  // ---- Layers ----
  const cellBounds = useMemo(() => (grid?.cells ?? []).map((c) => [
    [c.lat - grid!.cellLat / 2, c.lon - grid!.cellLon / 2],
    [c.lat + grid!.cellLat / 2, c.lon + grid!.cellLon / 2],
  ] as [[number, number], [number, number]]), [grid])

  const focusLevel = useMemo<RiskLevel | null>(() => {
    if (!focus || !levels || li < 0) return null
    const v = levels.places.find((p) => p.id === focus.id)?.scores[li]
    return validScore(v) ? levelFor(v) : null
  }, [focus, levels, li])

  // Heat spotted by satellites: live data has thousands across Canada, so show the ones near the
  // community, or all of them only when there are few (the example scenario).
  const heat = useMemo(() => {
    const all = hotspots.data ?? []
    if (focus) return all.filter((h) => distanceKm(focus, h) <= 150).slice(0, 400)
    return all.length <= 300 ? all : []
  }, [hotspots.data, focus])

  const evacuated = (c: CommunityExposure) => c.reported.some((r) => r.includes('July 2026'))
  const fireSrc = fires.sources[0]
  const fireTitle = sim ? 'Example fire (not real)' : 'Wildfire reported by fire crews'

  const placePopup = (p: { id: string; name: string; province: string }, level: RiskLevel | null, link: boolean) =>
    <Popup className="hero-popup" pane="popupPane">
      <Card title={p.name} sub={placeName(p.province) || undefined}
        from={level ? (sim ? 'Example scenario, not real conditions.' : 'Our estimate, not an official fire danger rating.') : null}>
        {level
          ? <div className="flex items-center gap-2"><LevelMeter level={level} size="sm" /><span><span className="font-semibold">{levelLabel(level)}</span> fire risk {whenWords(day, knownDays)}</span></div>
          : null}
        {link && <button type="button" onClick={() => navigate(`/c/${encodeURIComponent(p.id)}`)}
          className="mt-2 inline-flex min-h-10 items-center rounded-md bg-action px-3.5 text-[15px] font-semibold text-white hover:bg-action-deep focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-fg">
          Open {p.name}
        </button>}
      </Card>
    </Popup>

  const btn = (active: boolean) => `inline-flex h-9 items-center rounded-full px-4 text-[14px] font-medium whitespace-nowrap transition-colors focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-fg ${active ? 'bg-fg text-white' : 'text-mute hover:text-fg'}`

  return <div ref={box} className="relative h-full w-full">
    <MapContainer center={[HOME.lat, HOME.lon]} zoom={4} minZoom={3} maxZoom={11} zoomControl={false} maxBounds={[[38, -170], [85, -40]]}
      className="h-full w-full" style={{ height: '100%', borderRadius: 0, background: '#f4f4f1' }}>
      {size.w > 0 && <FlyTo lat={target.lat} lon={target.lon} zoom={target.zoom} shift={shift} />}
      <TileLayer url={`${ESRI}/World_Light_Gray_Base/MapServer/tile/{z}/{y}/{x}`} maxZoom={16} zIndex={1} attribution="Tiles © Esri" />
      {!nasa && <TileLayer key="esri-ref" url={`${ESRI}/World_Light_Gray_Reference/MapServer/tile/{z}/{y}/{x}`} maxZoom={16} zIndex={2} />}
      <ZoomControl position="bottomright" />

      {nasa && <>
        <WMSTileLayer key="gibs-true" zIndex={3} url={GIBS_WMS} params={{ layers: 'MODIS_Terra_CorrectedReflectance_TrueColor', format: 'image/jpeg', version: '1.3.0', time: NASA_DATE } as any} opacity={1} attribution="Imagery: NASA GIBS / EOSDIS" />
        <WMSTileLayer key="gibs-fire" zIndex={4} url={GIBS_WMS} params={{ layers: 'VIIRS_NOAA20_Thermal_Anomalies_375m_All', format: 'image/png', transparent: true, version: '1.3.0', time: NASA_DATE } as any} />
      </>}

      {/* Fixed panes keep zones under rings under heat under fires under communities, whatever loads first.
          The zones pane has its own SVG renderer, so the soft-edge blur in styles.css applies to it alone. */}
      <Pane name="hero-zones" style={{ zIndex: 340 }}>
        {!nasa && grid && gi >= 0 && grid.cells.map((c, i) => {
          const v = c.scores[gi]
          const shown = validScore(v) && levelFor(v) !== 'Low'
          return <Rectangle key={i} bounds={cellBounds[i]} interactive={false}
            pathOptions={{ className: 'risk-cell', stroke: false, weight: 0, fillColor: shown ? LEVEL_COLORS[levelFor(v)] : '#ffffff', fillOpacity: shown ? 0.45 : 0 }} />
        })}
      </Pane>

      <Pane name="hero-rings" style={{ zIndex: 400 }}>
        {focus && !nasa && RINGS_KM.map((km) => <Circle key={km} center={[focus.lat, focus.lon]} radius={km * 1000} interactive={false}
          pathOptions={{ color: INK, weight: 1.25, opacity: 0.4, fill: false, dashArray: '5 5' }} />)}
        {focus && !nasa && RINGS_KM.map((km) => <Marker key={`l${km}`} position={[focus.lat + km / 111.2, focus.lon]} icon={RING_ICONS[km]} interactive={false} keyboard={false} />)}
      </Pane>

      <Pane name="hero-heat" style={{ zIndex: 420 }}>
        {!nasa && heat.map((h, i) => <Marker key={`${h.lat},${h.lon},${i}`} position={[h.lat, h.lon]} icon={HEAT_ICON} keyboard={false}>
          <Tooltip pane="tooltipPane" className="hero-tip">{sim ? 'Example heat spot (not real)' : 'Heat spotted by satellites'}</Tooltip>
        </Marker>)}
      </Pane>

      <Pane name="hero-fires" style={{ zIndex: 430 }}>
        {!nasa && (fires.data ?? []).map((f) => <Marker key={f.id} position={[f.lat, f.lon]} icon={FLAME_ICON} title={fireTitle} alt={fireTitle}>
          <Popup className="hero-popup" pane="popupPane">
            <Card title={fireTitle} from={fromLine(fireSrc, sim)}>
              {STATUS[f.stage] && <div>{STATUS[f.stage]}</div>}
              <div>{fireSize(f.hectares)}</div>
              {f.startDate && <div>Reported {longDay(anyDate(f.startDate))}{!sim && f.agency ? ` by ${placeName(f.agency)} fire crews` : ''}</div>}
              {focus && <div>{whereFrom(f, focus)}</div>}
            </Card>
          </Popup>
        </Marker>)}
      </Pane>

      <Pane name="hero-communities" style={{ zIndex: 450 }}>
        {/* Map view: every community filled with its level on the shared day (Low = sand). */}
        {!nasa && levels && li >= 0 && levels.places.filter((p) => p.id !== focus?.id).map((p) => {
          const v = p.scores[li]
          const level = validScore(v) ? levelFor(v) : null
          return <CircleMarker key={p.id} center={[p.lat, p.lon]} radius={6}
            pathOptions={{ color: INK, weight: 1.5, opacity: 1, fillColor: level ? LEVEL_COLORS[level] : '#ffffff', fillOpacity: 1 }}>
            <Tooltip pane="tooltipPane" className="hero-tip">{p.name}</Tooltip>
            {placePopup(p, level, true)}
          </CircleMarker>
        })}
        {/* No levels yet: the short list of communities, neutral discs. */}
        {!nasa && !levels && (communities.data ?? []).filter((c) => c.id !== focus?.id).map((c) =>
          <CircleMarker key={c.id} center={[c.lat, c.lon]} radius={6}
            pathOptions={{ color: INK, weight: 1.5, opacity: 1, fillColor: '#ffffff', fillOpacity: 1 }}>
            <Tooltip pane="tooltipPane" className="hero-tip">{c.name}</Tooltip>
            {placePopup(c, null, true)}
          </CircleMarker>)}
        {/* Satellite photo: the Nations evacuated in July 2026, always named. */}
        {nasa && (communities.data ?? []).map((c) => {
          const lab = evacuated(c)
          const left = c.id === 'collins'
          return <CircleMarker key={`${c.id}${lab ? '-label' : ''}`} center={[c.lat, c.lon]} radius={6}
            pathOptions={{ color: '#ffffff', weight: 1.5, fillColor: INK, fillOpacity: 1 }}>
            {lab
              ? <Tooltip pane="tooltipPane" permanent direction={left ? 'left' : 'right'} offset={left ? [-8, 0] : [8, 0]} className="community-label">{c.name}</Tooltip>
              : <Tooltip pane="tooltipPane" className="hero-tip">{c.name}</Tooltip>}
            <Popup className="hero-popup" pane="popupPane">
              <Card title={c.name} sub={placeName(c.province) || undefined}>
                {c.reported.length > 0 && <div>{c.reported.join('. ')}.</div>}
              </Card>
            </Popup>
          </CircleMarker>
        })}
        {/* The community being viewed: always drawn and named, even before any data arrives. */}
        {focus && !nasa && <CircleMarker key={`focus-${focus.id}`} center={[focus.lat, focus.lon]} radius={8}
          pathOptions={{ color: INK, weight: 2, opacity: 1, fillColor: focusLevel ? LEVEL_COLORS[focusLevel] : '#ffffff', fillOpacity: 1 }}>
          <Tooltip pane="tooltipPane" permanent direction="right" offset={[10, 0]} className="community-label">{focus.name}</Tooltip>
          {placePopup({ id: focus.id, name: focus.name, province: levels?.places.find((p) => p.id === focus.id)?.province ?? '' }, focusLevel, false)}
        </CircleMarker>}
      </Pane>
    </MapContainer>

    {/* Top bar. Phone: layer toggle first, caption below, both on the left (the page may put a close button top right).
        Wider: caption left, toggle right. */}
    <div className={`pointer-events-none absolute inset-x-3 top-3 z-[1000] flex items-start gap-2 ${wideBar ? 'flex-row justify-between' : 'flex-col-reverse'} ${clear}`}>
      {!nasa
        ? <div aria-live="polite" className="pointer-events-auto flex max-w-full flex-wrap items-center gap-x-3 gap-y-1 rounded-2xl bg-white/95 px-3.5 py-1.5 text-[15px] font-semibold text-fg shadow-md">
          <span>{showingLine(day, knownDays)}</span>
          {canPlay && (playing
            ? <button type="button" onClick={stop} className="inline-flex h-8 items-center gap-1.5 rounded-full border border-fg px-3 text-[14px] font-medium hover:bg-fg/5 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-fg">
              <Square size={12} fill="currentColor" aria-hidden />Stop
            </button>
            : <button type="button" onClick={() => setPlaying(true)} className="inline-flex h-8 items-center gap-1.5 rounded-full border border-fg px-3 text-[14px] font-medium hover:bg-fg/5 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-fg">
              <Play size={12} fill="currentColor" aria-hidden />{playList.length === 1 ? 'Play the next day' : `Play the next ${playList.length} days`}
            </button>)}
        </div>
        : null}
      <div className={`pointer-events-auto flex flex-col gap-1.5 ${wideBar ? 'ml-auto items-end' : 'items-start'}`}>
        <div role="group" aria-label="Map view" className="flex gap-1 rounded-full bg-white p-1 shadow-lg">
          <button type="button" aria-pressed={!nasa} onClick={() => showNasa(false)} className={btn(!nasa)}>Map</button>
          <button type="button" aria-pressed={nasa} onClick={() => showNasa(true)} className={btn(nasa)}>
            {wideBar ? 'Satellite photo, 14 July 2026' : 'Satellite photo'}
          </button>
        </div>
        {nasa && <p className="rounded-full bg-white/95 px-3 py-1 text-[14px] text-fg shadow-sm">A real NASA photo from this summer’s fires.</p>}
      </div>
    </div>

    {/* Legend: bottom left of the visible map. Collapsed behind "Map key" on small maps. */}
    <div aria-label="Map key" className={`absolute bottom-4 left-3 z-[1000] max-w-[calc(100%-80px)] rounded-xl bg-white/95 text-[14px] text-fg shadow-md ${clear}`}>
      {!roomyKey && <button type="button" aria-expanded={keyOpen} onClick={() => setKeyOpen((o) => !o)}
        className="px-3 py-2 text-[14px] font-semibold focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-fg">
        {keyOpen ? 'Hide map key' : 'Map key'}
      </button>}
      <div className={`${keyOpen || roomyKey ? 'flex' : 'hidden'} flex-col items-start gap-0.5 px-2.5 pb-2 ${roomyKey ? 'pt-2' : ''}`}>
        {!nasa && <>
          <p className="px-1 font-semibold">Fire risk (our estimate)</p>
          {(['Moderate', 'High', 'Critical'] as RiskLevel[]).map((l) => <InfoPopover key={l} k={`level.${l}`} className="px-1 py-0.5 hover:bg-fg/5">
            <LevelMeter level={l} size="sm" />{levelLabel(l)}
          </InfoPopover>)}
          <p className="px-1 text-mute">Low risk is not shaded</p>
          <span aria-hidden className="my-1 h-px w-full bg-line" />
          <InfoPopover k={sim ? 'simulatedScenario' : 'activeFire'} className="px-1 py-0.5 hover:bg-fg/5">
            <span aria-hidden className="hero-fire-key"><Flame size={11} strokeWidth={2.5} color="#ffffff" /></span>{fireTitle}
          </InfoPopover>
          {heat.length > 0 && <InfoPopover k="hotspot" className="px-1 py-0.5 hover:bg-fg/5">
            <span aria-hidden className="mx-[6px] h-1.5 w-1.5 shrink-0" style={{ background: HEAT_ORANGE }} />Heat spotted by satellites
          </InfoPopover>}
          <InfoPopover k="community" className="px-1 py-0.5 hover:bg-fg/5">
            <span aria-hidden className="mx-[3px] h-3 w-3 shrink-0 rounded-full border-[1.5px] border-fg" style={{ background: LEVEL_COLORS.High }} />Community
          </InfoPopover>
        </>}
        {nasa && <>
          <InfoPopover k="nasaTrueColour" className="px-1 py-0.5 hover:bg-fg/5">
            <span aria-hidden className="h-3 w-3 shrink-0 rounded-sm bg-[linear-gradient(135deg,#3d6b3a,#a9b3a0_55%,#f4f4f1)]" />Satellite photo, 14 July 2026
          </InfoPopover>
          <InfoPopover k="nasaThermal" className="px-1 py-0.5 hover:bg-fg/5">
            <span aria-hidden className="mx-0.5 h-2 w-2 shrink-0 rounded-[2px] bg-[#ff3b1f]" />Heat seen by satellite that day
          </InfoPopover>
          <InfoPopover k="community" className="px-1 py-0.5 hover:bg-fg/5">
            <span aria-hidden className="h-3 w-3 shrink-0 rounded-full border-[1.5px] border-white bg-fg shadow-[0_0_0_1px_#1b1f1d]" />Community (named: evacuated in July 2026)
          </InfoPopover>
        </>}
      </div>
    </div>
  </div>
}
