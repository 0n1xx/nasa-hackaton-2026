import { useEffect, useMemo, useRef, useState } from 'react'
import { CircleMarker, MapContainer, TileLayer, Tooltip, WMSTileLayer, useMap } from 'react-leaflet'
import { Link, useSearchParams } from 'react-router-dom'
import type { ActiveFire, CommunityExposure, HistoryData, Hotspot, RegionSummary, SourceMeta } from '../../shared/types.ts'
import { aqiBand } from '../../shared/aqi.ts'
import { LEVEL_COLORS } from '../../shared/risk.ts'
import { useApi } from '../api.ts'
import { useApp } from '../state.tsx'
import { AqiPill, Btn, InfoPopover, KindBadge, RiskPill, Sources, fmt, fmtTime } from './ui.tsx'
import { stageLabel } from '../explain.ts'

const GIBS_WMS = 'https://gibs.earthdata.nasa.gov/wms/epsg3857/best/wms.cgi'

/** The demo moment: real NASA imagery from the week of the July 2026 First Nations evacuations in Northwestern Ontario.
 *  The map button, the date picker and /map?date=2026-07-14 all go through enterNasa() below, so they behave the same. */
export const NASA_DATE = '2026-07-14'
export const NASA_LABEL = 'NASA imagery: 14 July 2026'
const NASA_REGION = 'thunder-bay'
const NASA_MONTH = 'July 2026' // communities whose public reports mention this month get a name label in the NASA view

const STAGE: Record<string, { label: string; color: string; k: string }> = {
  OC: { label: 'Out of control', color: LEVEL_COLORS.Critical, k: 'fireStage.OC' }, BH: { label: 'Being held', color: LEVEL_COLORS.High, k: 'fireStage.BH' },
  UC: { label: 'Under control', color: LEVEL_COLORS.Moderate, k: 'fireStage.UC' }, OTHER: { label: 'Other or monitored', color: '#8a968f', k: 'activeFire' },
}
const stageOf = (s: string) => STAGE[s] ?? STAGE.OTHER
const C = { hot: '#ec8a4b', hotStrong: '#c9302c', historic: '#75827c', firstNation: '#13211b', metis: '#2f6690' }

type LayerId = 'fires' | 'hotspots' | 'air' | 'communities' | 'historic' | 'gibsTrue' | 'gibsFire' | 'gibsAod'
type GroupId = 'fire' | 'places' | 'nasa'
const GROUPS: { id: GroupId; label: string }[] = [
  { id: 'fire', label: 'Fire and smoke' }, { id: 'places', label: 'Communities and history' }, { id: 'nasa', label: 'NASA satellite imagery' },
]
const LAYERS: { id: LayerId; label: string; group: GroupId }[] = [
  { id: 'fires', label: 'Active fires', group: 'fire' }, { id: 'hotspots', label: 'Satellite detections', group: 'fire' },
  { id: 'air', label: 'Air quality (PM2.5)', group: 'fire' },
  { id: 'communities', label: 'Communities', group: 'places' }, { id: 'historic', label: 'Historic large fires', group: 'places' },
  { id: 'gibsTrue', label: 'True colour', group: 'nasa' }, { id: 'gibsFire', label: 'Thermal anomalies', group: 'nasa' },
  { id: 'gibsAod', label: 'Aerosol (smoke)', group: 'nasa' },
]
const defaultLayers = (compact: boolean): Record<LayerId, boolean> =>
  ({ fires: true, hotspots: true, air: !compact, communities: true, historic: false, gibsTrue: false, gibsFire: false, gibsAod: false })

type Selected =
  | { t: 'fire'; d: ActiveFire } | { t: 'hotspot'; d: Hotspot } | { t: 'community'; d: CommunityExposure }
  | { t: 'region'; d: RegionSummary } | { t: 'historic'; d: HistoryData['historicFires'][number] }

/** Flies when the target changes, or when `n` is bumped (so the NASA button re-centres even if the region is unchanged). */
function FlyTo({ lat, lon, zoom, n }: { lat: number; lon: number; zoom: number; n: number }) {
  const map = useMap()
  useEffect(() => { map.flyTo([lat, lon], zoom, { duration: 0.9 }) }, [lat, lon, zoom, n, map])
  return null
}

/** Short map label that matches news naming: "Namaygoosisagagun (Collins) First Nation" becomes "Collins". */
const shortName = (name: string) => {
  const m = name.match(/\(([^),]+)\)/)
  return (m ? m[1] : name).replace(/ First Nations?\b/, '').trim()
}

const yesterday = () => new Date(Date.now() - 86400000).toISOString().slice(0, 10)

export default function MapView({ height = '70vh', compact = false, initialDate = '' }: { height?: string; compact?: boolean; initialDate?: string }) {
  const { region, setRegionId, mode, status } = useApp()
  const [on, setOn] = useState<Record<LayerId, boolean>>(() => defaultLayers(compact))
  const [date, setDate] = useState('')
  const [nasa, setNasa] = useState(false)
  const [flyN, setFlyN] = useState(0)
  const [days, setDays] = useState(1)
  const [stage, setStage] = useState<'all' | 'OC'>('all')
  const [minHa, setMinHa] = useState(0)
  const [sinceYear, setSinceYear] = useState(2011)
  const [sel, setSel] = useState<Selected | null>(null)
  const saved = useRef<Record<LayerId, boolean> | null>(null) // layers to restore on "Back to today"
  const scrollOnEnter = useRef(false)
  const enteredAt = useRef(0) // "Back to today" appears where the NASA button was; ignore a nervous double-click
  const card = useRef<HTMLDivElement>(null)
  const [query, setQuery] = useSearchParams()

  const firmsOn = status?.integrations.find((i) => i.id === 'firms')?.configured ?? false
  const past = !!date && mode === 'live'
  const fires = useApi<ActiveFire[]>('fires/active')
  const hotspots = useApi<Hotspot[]>(`fires/hotspots?days=${days}${past ? `&date=${date}` : ''}`)
  const communities = useApi<CommunityExposure[]>('communities')
  const summary = useApi<RegionSummary[]>('summary')
  const history = useApi<HistoryData>('history')
  const gibsDate = date || yesterday()

  /** Real NASA imagery for 14 July 2026 over Thunder Bay District. Markers that are not from that date are switched off. */
  const enterNasa = (scroll: boolean) => {
    if (!saved.current) saved.current = on
    setDate(NASA_DATE)
    setOn((o) => ({ ...o, gibsTrue: true, gibsFire: true, gibsAod: false, fires: false, hotspots: false, air: false, communities: true }))
    setSel(null)
    setNasa(true)
    setRegionId(NASA_REGION)
    setFlyN((n) => n + 1)
    scrollOnEnter.current = scroll
    enteredAt.current = Date.now()
  }
  const backToToday = () => {
    setDate('')
    setNasa(false)
    if (saved.current) { setOn(saved.current); saved.current = null; setSel(null) }
    if (query.has('date')) setQuery((p) => { const n = new URLSearchParams(p); n.delete('date'); return n }, { replace: true }) // so a reload stays on today
  }
  const pickDate = (v: string) => {
    if (v === NASA_DATE) return enterNasa(false)
    if (!v) return backToToday()
    if (!date) setOn((o) => ({ ...o, gibsTrue: true, gibsFire: true }))
    setNasa(false)
    setDate(v)
  }

  // /map?date=… arrives here. 14 July 2026 gets exactly the same view as the button.
  useEffect(() => {
    if (initialDate === NASA_DATE) enterNasa(false)
    else if (initialDate) { setDate(initialDate); setOn((o) => ({ ...o, gibsTrue: true, gibsFire: true })) }
  }, [initialDate]) // eslint-disable-line react-hooks/exhaustive-deps

  // After the button click, bring the whole map into view (it can sit below the fold on a projector).
  useEffect(() => {
    if (!nasa || !scrollOnEnter.current) return
    scrollOnEnter.current = false
    const reduce = window.matchMedia?.('(prefers-reduced-motion: reduce)').matches
    card.current?.scrollIntoView({ behavior: reduce ? 'auto' : 'smooth', block: 'start' })
  }, [nasa])

  const shownFires = useMemo(() => (fires.data ?? []).filter((f) => (stage === 'all' || f.stage === 'OC') && f.hectares >= minHa), [fires.data, stage, minHa])
  const shownHistoric = useMemo(() => (history.data?.historicFires ?? []).filter((f) => f.year >= sinceYear), [history.data, sinceYear])
  const labelled = useMemo(() => (nasa ? (communities.data ?? []).filter((c) => c.reported.some((r) => r.includes(NASA_MONTH))) : []), [nasa, communities.data])
  const labelSide = (c: CommunityExposure) => (labelled.some((o) => o.id !== c.id && o.lon > c.lon && o.lon - c.lon < 1 && Math.abs(o.lat - c.lat) < 0.3) ? 'left' : 'right')
  const toggle = (id: LayerId) => setOn((o) => ({ ...o, [id]: !o[id] }))
  const sources = [...(on.fires && !past ? fires.sources : []), ...(on.hotspots ? hotspots.sources : []), ...(on.air ? summary.sources.filter((s) => s.id.includes('air')) : []), ...(on.communities ? communities.sources.filter((s) => s.id === 'communities') : [])]

  // What the viewer is looking at in the NASA view, kept true to the layers actually switched on.
  const seeing = on.gibsTrue && on.gibsFire ? 'Real MODIS true-colour imagery with VIIRS fire detections from that day.'
    : on.gibsTrue ? 'Real MODIS true-colour imagery from that day.' : on.gibsFire ? 'Real VIIRS fire detections from that day.'
      : 'The NASA layers are switched off. Turn on True colour or Thermal anomalies to see that day.'
  const notThatDay = mode === 'sim'
    ? (on.fires || on.hotspots || on.air ? 'Simulated markers on the map are not from this date.' : 'Simulated markers are hidden because they are not from this date.')
    : `Today’s fire reports are hidden because they are not from this date.${on.air ? ' The PM2.5 rings show today’s air, not this date.' : ''}`

  return <div className="grid grid-cols-1 gap-x-6 gap-y-4 lg:grid-cols-[minmax(0,1fr)_300px]">
    <div className="min-w-0">
      <div ref={card} className="scroll-mt-3">
      {!compact && <div aria-live="polite" className={`mb-2 flex flex-col gap-3 rounded-[10px] border px-4 py-3 sm:flex-row sm:items-center sm:justify-between ${nasa ? 'border-ember/45 bg-ember/[0.06]' : 'border-line bg-ink-900'}`}>
        {nasa
          ? <div className="min-w-0">
            <p className="flex items-center gap-2 text-[15px] font-semibold"><span className="h-2 w-2 shrink-0 rounded-full bg-ember" aria-hidden />{NASA_LABEL}</p>
            <p className="mt-0.5 text-[13px] leading-snug text-mute">{seeing} {notThatDay}</p>
          </div>
          : <p className="min-w-0 text-[13.5px] leading-snug text-mute"><span className="font-medium text-fg">Real NASA satellite imagery from 14 July 2026.</span> Northwestern Ontario, during the July 2026 evacuations of five First Nations.</p>}
        {nasa
          ? <div className="shrink-0"><Btn onClick={() => { if (Date.now() - enteredAt.current > 800) backToToday() }}>Back to today</Btn></div>
          : <button type="button" onClick={() => enterNasa(true)} className="inline-flex min-h-11 shrink-0 items-center justify-center rounded-md bg-ember-deep px-5 text-[15px] font-semibold whitespace-nowrap text-white hover:bg-[#a63f12]">Show {NASA_LABEL}</button>}
      </div>}

      <div className="relative overflow-hidden rounded-[10px] border border-line" style={{ height, minHeight: 320 }}>
        <MapContainer center={[region?.lat ?? 56, region?.lon ?? -96]} zoom={compact ? 4 : region?.zoom ?? 4} minZoom={3} maxZoom={11} preferCanvas scrollWheelZoom={!compact} style={{ height: '100%' }} maxBounds={[[38, -170], [85, -40]]}>
          {!compact && region && <FlyTo lat={region.lat} lon={region.lon} zoom={region.zoom} n={flyN} />}
          <TileLayer url="https://tile.openstreetmap.org/{z}/{x}/{y}.png" attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors' />
          {/* Explicit zIndex so fire detections always sit on top of the true-colour imagery, whatever order they were switched on. */}
          {on.gibsTrue && <WMSTileLayer key={`t${gibsDate}`} zIndex={2} url={GIBS_WMS} params={{ layers: 'MODIS_Terra_CorrectedReflectance_TrueColor', format: 'image/jpeg', version: '1.3.0', time: gibsDate } as any} opacity={0.85} attribution="Imagery: NASA GIBS / EOSDIS" />}
          {on.gibsAod && <WMSTileLayer key={`a${gibsDate}`} zIndex={3} url={GIBS_WMS} params={{ layers: 'MODIS_Combined_Value_Added_AOD', format: 'image/png', transparent: true, version: '1.3.0', time: gibsDate } as any} opacity={0.7} attribution="NASA GIBS" />}
          {on.gibsFire && <WMSTileLayer key={`f${gibsDate}`} zIndex={4} url={GIBS_WMS} params={{ layers: 'VIIRS_NOAA20_Thermal_Anomalies_375m_All', format: 'image/png', transparent: true, version: '1.3.0', time: gibsDate } as any} attribution="NASA GIBS" />}

          {on.historic && shownHistoric.map((f) => <CircleMarker key={f.id} center={[f.lat, f.lon]} radius={6 + Math.sqrt(f.hectares) / 60} pathOptions={{ color: C.historic, weight: 1.2, fillOpacity: 0.08, dashArray: '3 3' }} eventHandlers={{ click: () => setSel({ t: 'historic', d: f }) }}><Tooltip>{f.name} ({f.year})</Tooltip></CircleMarker>)}
          {on.air && (summary.data ?? []).map((s) => { const b = aqiBand(s.air.usAqi); return <CircleMarker key={s.region.id} center={[s.region.lat, s.region.lon]} radius={26} pathOptions={{ color: b?.color ?? '#7f8c99', weight: 1.5, fillOpacity: 0.16 }} eventHandlers={{ click: () => { setSel({ t: 'region', d: s }); setRegionId(s.region.id) } }}><Tooltip>{s.region.short}: PM2.5 {fmt(s.air.pm25, 0)} µg/m³</Tooltip></CircleMarker> })}
          {on.hotspots && (hotspots.data ?? []).map((h, i) => <CircleMarker key={i} center={[h.lat, h.lon]} radius={h.frp == null ? 2 : Math.min(6, 1.6 + Math.sqrt(h.frp) / 3.2)} pathOptions={{ stroke: false, fillColor: h.frp != null && h.frp > 60 ? C.hotStrong : C.hot, fillOpacity: 0.8 }} eventHandlers={{ click: () => setSel({ t: 'hotspot', d: h }) }} />)}
          {on.fires && !past && shownFires.map((f) => <CircleMarker key={f.id} center={[f.lat, f.lon]} radius={Math.max(4, Math.min(16, 3 + Math.log10(f.hectares + 1) * 2.4))} pathOptions={{ color: stageOf(f.stage).color, weight: 1.6, fillOpacity: 0.3 }} eventHandlers={{ click: () => setSel({ t: 'fire', d: f }) }}><Tooltip>{f.name}, {fmt(f.hectares)} ha</Tooltip></CircleMarker>)}
          {on.communities && (communities.data ?? []).map((c) => {
            const lab = labelled.some((l) => l.id === c.id), side = labelSide(c)
            return <CircleMarker key={`${c.id}${lab ? '-label' : ''}`} center={[c.lat, c.lon]} radius={lab ? 6 : 5} pathOptions={{ color: '#ffffff', weight: lab ? 2 : 1.5, fillColor: c.kind === 'Métis Settlement' ? C.metis : C.firstNation, fillOpacity: 1 }} eventHandlers={{ click: () => setSel({ t: 'community', d: c }) }}>
              {lab ? <Tooltip permanent direction={side} offset={[side === 'left' ? -7 : 7, 0]}>{shortName(c.name)}</Tooltip> : <Tooltip>{c.name}</Tooltip>}
            </CircleMarker>
          })}
        </MapContainer>
        {((on.fires && fires.loading) || (on.hotspots && hotspots.loading)) && <div className="num absolute top-2 right-2 z-[500] rounded-md border border-line bg-ink-950/95 px-2 py-1 text-[12px] text-mute" role="status">Loading map data…</div>}
      </div>
      </div>

      <div className="mt-2 space-y-1 text-[12.5px]">
        {on.fires && fires.error && <p className="text-flame" role="alert">Active fires: {fires.error} <button type="button" className="underline" onClick={fires.reload}>Try again</button></p>}
        {on.hotspots && hotspots.error && <p className="text-flame" role="alert">Satellite detections: {hotspots.error}</p>}
        {on.fires && past && <p className="text-mute">Agency-reported active fires are only available for today, so they are hidden while a past date is selected.</p>}
        {date && !nasa && mode === 'sim' && <p className="text-mute">The date changes the NASA imagery only. Simulated markers do not change with the date.</p>}
        {on.fires && !past && fires.data && shownFires.length === 0 && <p className="text-mute">No active fires match these filters{fires.data.length === 0 ? `. Fire agencies report none right now, which is normal outside fire season. ${compact ? 'Open the full map for NASA imagery from July 2026, or try the simulated scenario.' : `Use “Show ${NASA_LABEL}” above, or try the simulated scenario.`}` : '.'}</p>}
      </div>
      {!compact && <Sources sources={sources} />}
    </div>

    <aside className="min-w-0 space-y-1">
      <div className="panel" aria-live="polite">
        <p className="label mb-2">Selected location</p>
        {!sel ? <p className="text-[13px] text-mute">Select a marker on the map to see details here.</p> : <>
          {date && sel.t !== 'historic' && !(sel.t === 'hotspot' && past) && <p className="mb-2 text-[12px] leading-snug text-sun">Figures below are for today{mode === 'sim' ? ' and simulated' : ''}, not {date === NASA_DATE ? '14 July 2026' : date}.</p>}
          <Detail sel={sel} src={sel.t === 'fire' ? fires.sources[0] : sel.t === 'hotspot' ? hotspots.sources[0]
            : sel.t === 'community' ? communities.sources.find((x) => x.id === 'communities') ?? communities.sources[0]
              : sel.t === 'region' ? summary.sources.find((x) => x.id.includes('air')) ?? summary.sources[0] : history.sources[0]} />
        </>}
      </div>

      <div className="panel" role="group" aria-label="Map layers">
        <p className="label mb-2.5">Layers</p>
        <div className="space-y-3.5">
          {GROUPS.map((g) => <div key={g.id} role="group" aria-label={g.label}>
            <p className="mb-1 flex flex-wrap items-center justify-between gap-x-2 text-[12.5px] font-medium">{g.label}
              {g.id === 'fire' && mode === 'sim' && <KindBadge kind="simulated" />}
              {g.id === 'nasa' && <span className="text-[12px] font-normal text-dim">Real, for the chosen date</span>}
            </p>
            <div className="grid grid-cols-2 gap-x-3">
              {LAYERS.filter((l) => l.group === g.id).map((l) => <label key={l.id} className="flex min-w-0 cursor-pointer items-center gap-2 py-1 text-[13px] text-fg">
                <input type="checkbox" checked={on[l.id]} onChange={() => toggle(l.id)} className="h-4 w-4 shrink-0 cursor-pointer accent-(--color-fg)" />
                <span className="min-w-0">{l.label}</span>
              </label>)}
            </div>
          </div>)}
        </div>
      </div>

      {!compact && <div className="panel">
        <p className="label mb-2.5">Filters</p>
        <div className="grid grid-cols-2 gap-x-3 gap-y-3 lg:grid-cols-1">
          <label className="col-span-2 flex flex-col gap-1 lg:col-span-1"><span className="text-[12.5px] text-mute">Date</span>
            <span className="flex gap-1.5"><input type="date" className="min-w-0 flex-1" value={date} max={new Date().toISOString().slice(0, 10)} min="2012-01-20" onChange={(e) => pickDate(e.target.value)} />
              {date && <Btn onClick={backToToday}>Today</Btn>}</span></label>
          <label className="flex min-w-0 flex-col gap-1"><span className="text-[12.5px] text-mute">Detections window</span>
            <select className="w-full" value={days} onChange={(e) => setDays(Number(e.target.value))} disabled={mode === 'live' && !firmsOn} title={mode === 'live' && !firmsOn ? 'Needs a NASA FIRMS key; without one only the last 24 h is available' : ''}>
              {[1, 2, 3, 5].map((d) => <option key={d} value={d}>{d === 1 ? '24 hours' : `${d} days`}</option>)}</select></label>
          <label className="flex min-w-0 flex-col gap-1"><span className="text-[12.5px] text-mute">Fire status</span>
            <select className="w-full" value={stage} onChange={(e) => setStage(e.target.value as 'all' | 'OC')}><option value="all">All active fires</option><option value="OC">Out of control only</option></select></label>
          <label className="flex min-w-0 flex-col gap-1"><span className="text-[12.5px] text-mute">Minimum size</span>
            <select className="w-full" value={minHa} onChange={(e) => setMinHa(Number(e.target.value))}>{[0, 100, 1000, 10000].map((h) => <option key={h} value={h}>{h === 0 ? 'Any size' : `${h.toLocaleString()} ha or more`}</option>)}</select></label>
          {on.historic && <label className="flex min-w-0 flex-col gap-1"><span className="text-[12.5px] text-mute">Historic fires since {sinceYear}</span>
            <input type="range" min={2011} max={2026} value={sinceYear} onChange={(e) => setSinceYear(Number(e.target.value))} className="w-full accent-(--color-fg)" /></label>}
        </div>
      </div>}

      <div className="panel">
        <p className="label mb-2">Legend</p>
        <ul className="space-y-1.5 text-[12.5px]">
          {on.fires && !past && Object.values(STAGE).map((s) => <li key={s.label}><InfoPopover k={s.k} className="px-0.5 py-0.5 hover:bg-fg/5"><span className="h-3 w-3 shrink-0 rounded-full border-2" style={{ borderColor: s.color, background: `${s.color}4d` }} />Active fire: {s.label.toLowerCase()}</InfoPopover></li>)}
          {on.hotspots && <li><InfoPopover k="hotspot" className="px-0.5 py-0.5 hover:bg-fg/5"><span className="flex shrink-0 items-center gap-0.5"><span className="h-2 w-2 rounded-full" style={{ background: C.hot }} /><span className="h-2.5 w-2.5 rounded-full" style={{ background: C.hotStrong }} /></span>Satellite detection; larger and redder means more radiative power</InfoPopover></li>}
          {on.air && <li><InfoPopover k="aqi" className="px-0.5 py-0.5 hover:bg-fg/5"><span className="h-4 w-4 shrink-0 rounded-full border border-mute bg-mute/20" />Regional PM2.5 ring, coloured by US AQI band</InfoPopover></li>}
          {on.communities && <li className="flex flex-wrap items-center gap-x-2 gap-y-1"><InfoPopover k="community.firstNation" className="px-0.5 py-0.5 hover:bg-fg/5"><span className="h-2.5 w-2.5 shrink-0 rounded-full ring-2 ring-ink-700" style={{ background: C.firstNation }} />First Nation</InfoPopover><InfoPopover k="community.metis" className="px-0.5 py-0.5 hover:bg-fg/5"><span className="h-2.5 w-2.5 shrink-0 rounded-full ring-2 ring-ink-700" style={{ background: C.metis }} />Métis Settlement</InfoPopover></li>}
          {on.historic && <li><InfoPopover k="historicFire" className="px-0.5 py-0.5 hover:bg-fg/5"><span className="h-3 w-3 shrink-0 rounded-full border border-dashed" style={{ borderColor: C.historic }} />Historic large fire (approximate)</InfoPopover></li>}
          {on.gibsTrue && <li className="text-mute"><InfoPopover k="nasaTrueColour" className="px-0.5 py-0.5 hover:bg-fg/5"><span><span className="font-medium text-fg">NASA true colour:</span> smoke appears as grey or brown haze, cloud as bright white.</span></InfoPopover></li>}
          {on.gibsFire && <li className="text-mute"><InfoPopover k="nasaThermal" className="px-0.5 py-0.5 hover:bg-fg/5"><span><span className="font-medium text-fg">NASA thermal anomalies:</span> VIIRS fire detections at 375 m.</span></InfoPopover></li>}
          {on.gibsAod && <li className="text-mute"><InfoPopover k="nasaAerosol" className="px-0.5 py-0.5 hover:bg-fg/5"><span><span className="font-medium text-fg">NASA aerosol:</span> aerosol optical depth, a measure of how much smoke or haze is in the air column.</span></InfoPopover></li>}
          {!Object.values(on).some(Boolean) && <li className="text-mute">Turn on a layer to see its key.</li>}
        </ul>
        {(on.fires || on.communities) && <p className="mt-2.5 text-[12px] leading-relaxed text-dim">{on.fires ? 'Fire circle size grows with reported area. ' : ''}{on.communities ? 'Community markers show approximate, publicly known locations only.' : ''}</p>}
      </div>
      {compact && <Link to="/map" className="mt-3 block rounded-lg border border-line px-3 py-2 text-center text-[13px] text-fg hover:border-mute">Open the full map</Link>}
    </aside>
  </div>
}

function Row({ k, children }: { k: string; children: React.ReactNode }) {
  return <div className="flex justify-between gap-3 border-b border-line/70 py-1.5 text-[13px] last:border-0"><dt className="text-mute">{k}</dt><dd className="num text-right">{children}</dd></div>
}

/** Source and last-updated time for the dataset behind the selected marker. */
function SrcRows({ src }: { src?: SourceMeta }) {
  if (!src) return null
  return <><Row k="Source">{src.url ? <a className="underline decoration-line underline-offset-2 hover:decoration-mute" href={src.url} target="_blank" rel="noreferrer">{src.label}</a> : src.label}</Row><Row k="Updated">{fmtTime(src.fetchedAt)}</Row></>
}

function Detail({ sel, src }: { sel: Selected; src?: SourceMeta }) {
  const h3 = 'text-[15px] leading-snug font-semibold'
  if (sel.t === 'fire') { const f = sel.d; return <div><h3 className={h3}>{f.name}</h3><p className="mb-1.5 text-[12.5px] text-mute">Active fire reported by {f.agency || 'agency'}</p><dl>
    <Row k="Stage"><span style={{ color: stageOf(f.stage).color }}>{stageLabel(f.stage)}</span></Row><Row k="Reported size">{fmt(f.hectares)} ha</Row><Row k="Reported">{f.startDate?.slice(0, 10) ?? '—'}</Row><Row k="Position">{f.lat.toFixed(3)}, {f.lon.toFixed(3)}</Row><SrcRows src={src} /></dl></div> }
  if (sel.t === 'hotspot') { const h = sel.d; return <div><h3 className={h3}>Satellite fire detection</h3><p className="mb-1.5 text-[12.5px] text-mute">A pixel hot enough to indicate fire. Not every detection is a wildfire.</p><dl>
    <Row k="Radiative power">{h.frp == null ? 'not reported' : `${fmt(h.frp, 1)} MW`}</Row><Row k="Detected">{h.time ? fmtTime(h.time) : '—'}</Row><Row k="Sensor">{h.sensor}</Row><Row k="Position">{h.lat.toFixed(3)}, {h.lon.toFixed(3)}</Row><SrcRows src={src} /></dl></div> }
  if (sel.t === 'historic') { const f = sel.d; return <div><h3 className={h3}>{f.name} ({f.year})</h3><p className="my-1.5 text-[13px] text-mute">{f.note}</p><dl><Row k="Approx. area">{f.hectares ? `${fmt(f.hectares)} ha` : 'not included'}</Row><Row k="Position">{f.lat.toFixed(3)}, {f.lon.toFixed(3)}</Row></dl></div> }
  if (sel.t === 'region') { const s = sel.d; return <div><h3 className={h3}>{s.region.name}</h3><dl className="mt-1.5">
    <Row k="Risk index"><RiskPill level={s.risk.level} score={s.risk.score} /></Row><Row k="US AQI"><AqiPill aqi={s.air.usAqi} /></Row><Row k="PM2.5">{fmt(s.air.pm25, 1)} µg/m³</Row><Row k="Detections ≤100 km">{s.hotspots100km}</Row><Row k="Active fires ≤250 km">{s.activeFires250km}</Row><Row k="Position">{s.region.lat.toFixed(3)}, {s.region.lon.toFixed(3)}</Row><SrcRows src={src} /></dl>
    <div className="mt-2 flex gap-3 text-[13px]"><Link className="text-sky underline underline-offset-2" to="/risk">Risk detail</Link><Link className="text-sky underline underline-offset-2" to="/air">Air detail</Link></div></div> }
  const c = sel.d
  return <div><h3 className={h3}>{c.name}</h3><p className="mb-1.5 text-[12.5px] text-mute">{c.kind}, {c.province}. Approximate location.</p><dl>
    <Row k="Nearest active fire">{c.nearestFireKm == null ? 'none reported' : `${c.nearestFireKm} km`}</Row><Row k="Active fires ≤100 km">{c.fires100km}</Row><Row k="Detections ≤100 km">{c.hotspots100km}</Row><Row k="PM2.5 (modelled)">{fmt(c.pm25, 1)} µg/m³</Row><Row k="US AQI"><AqiPill aqi={c.usAqi} /></Row><Row k="Position">{c.lat.toFixed(3)}, {c.lon.toFixed(3)}</Row><SrcRows src={src} /></dl>
    {c.reported.length > 0 && <p className="mt-2 text-[12.5px] text-mute">Publicly reported: {c.reported.join('; ')}.</p>}
    <p className="mt-2 text-[12px] leading-relaxed text-dim">Distances are geographic proximity only. They are not an assessment of danger, which depends on wind, terrain and the community’s own knowledge.</p></div>
}

export { LEVEL_COLORS }
