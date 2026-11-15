import { useEffect, useMemo, useState } from 'react'
import { CircleMarker, MapContainer, TileLayer, Tooltip, WMSTileLayer, useMap } from 'react-leaflet'
import { Link } from 'react-router-dom'
import type { ActiveFire, CommunityExposure, HistoryData, Hotspot, RegionSummary } from '../../shared/types.ts'
import { aqiBand } from '../../shared/aqi.ts'
import { LEVEL_COLORS } from '../../shared/risk.ts'
import { useApi } from '../api.ts'
import { useApp } from '../state.tsx'
import { AqiPill, Btn, RiskPill, Sources, fmt, fmtTime } from './ui.tsx'

const GIBS_WMS = 'https://gibs.earthdata.nasa.gov/wms/epsg3857/best/wms.cgi'
const STAGE: Record<string, { label: string; color: string }> = {
  OC: { label: 'Out of control', color: '#e5484d' }, BH: { label: 'Being held', color: '#f2884b' },
  UC: { label: 'Under control', color: '#e3c341' }, OTHER: { label: 'Other / monitored', color: '#9aa7b4' },
}
const stageOf = (s: string) => STAGE[s] ?? STAGE.OTHER

const LAYERS = [
  { id: 'fires', label: 'Active fires', group: 'Fire' }, { id: 'hotspots', label: 'Satellite detections', group: 'Fire' },
  { id: 'historic', label: 'Historic large fires', group: 'Fire' }, { id: 'communities', label: 'Communities', group: 'People' },
  { id: 'air', label: 'Air quality (PM2.5)', group: 'Smoke' }, { id: 'gibsTrue', label: 'NASA true colour', group: 'Satellite' },
  { id: 'gibsFire', label: 'NASA thermal anomalies', group: 'Satellite' }, { id: 'gibsAod', label: 'NASA aerosol / smoke', group: 'Satellite' },
] as const
type LayerId = (typeof LAYERS)[number]['id']

type Selected =
  | { t: 'fire'; d: ActiveFire } | { t: 'hotspot'; d: Hotspot } | { t: 'community'; d: CommunityExposure }
  | { t: 'region'; d: RegionSummary } | { t: 'historic'; d: HistoryData['historicFires'][number] }

function FlyTo({ lat, lon, zoom }: { lat: number; lon: number; zoom: number }) {
  const map = useMap()
  useEffect(() => { map.flyTo([lat, lon], zoom, { duration: 0.9 }) }, [lat, lon, zoom, map])
  return null
}

const yesterday = () => new Date(Date.now() - 86400000).toISOString().slice(0, 10)

export default function MapView({ height = '70vh', compact = false, initialDate = '' }: { height?: string; compact?: boolean; initialDate?: string }) {
  const { region, setRegionId, mode, status } = useApp()
  const [on, setOn] = useState<Record<LayerId, boolean>>({ fires: true, hotspots: true, historic: false, communities: true, air: !compact, gibsTrue: !!initialDate, gibsFire: !!initialDate, gibsAod: false })
  const [date, setDate] = useState(initialDate)
  const [days, setDays] = useState(1)
  const [stage, setStage] = useState<'all' | 'OC'>('all')
  const [minHa, setMinHa] = useState(0)
  const [sinceYear, setSinceYear] = useState(2011)
  const [sel, setSel] = useState<Selected | null>(null)

  const firmsOn = status?.integrations.find((i) => i.id === 'firms')?.configured ?? false
  const past = !!date && mode === 'live'
  const fires = useApi<ActiveFire[]>('fires/active')
  const hotspots = useApi<Hotspot[]>(`fires/hotspots?days=${days}${past ? `&date=${date}` : ''}`)
  const communities = useApi<CommunityExposure[]>('communities')
  const summary = useApi<RegionSummary[]>('summary')
  const history = useApi<HistoryData>('history')
  const gibsDate = date || yesterday()

  const shownFires = useMemo(() => (fires.data ?? []).filter((f) => (stage === 'all' || f.stage === 'OC') && f.hectares >= minHa), [fires.data, stage, minHa])
  const shownHistoric = useMemo(() => (history.data?.historicFires ?? []).filter((f) => f.year >= sinceYear), [history.data, sinceYear])
  const toggle = (id: LayerId) => setOn((o) => ({ ...o, [id]: !o[id] }))
  const sources = [...(on.fires && !past ? fires.sources : []), ...(on.hotspots ? hotspots.sources : []), ...(on.air ? summary.sources.filter((s) => s.id.includes('air')) : []), ...(on.communities ? communities.sources.filter((s) => s.id === 'communities') : [])]

  return <div className="grid grid-cols-1 gap-3 lg:grid-cols-[1fr_300px]">
    <div className="min-w-0">
      <div className="mb-2 flex flex-wrap items-center gap-1.5" role="group" aria-label="Map layers">
        {LAYERS.map((l) => <Btn key={l.id} active={on[l.id]} onClick={() => toggle(l.id)} title={`${l.group} layer`}>{l.label}</Btn>)}
      </div>
      {!compact && <div className="mb-2 flex flex-wrap items-end gap-x-4 gap-y-2 rounded-lg border border-line bg-ink-900/70 px-3 py-2">
        <label className="flex flex-col gap-1"><span className="label">Date</span>
          <div className="flex gap-1.5"><input type="date" value={date} max={new Date().toISOString().slice(0, 10)} min="2012-01-20" onChange={(e) => setDate(e.target.value)} />
            {date && <Btn onClick={() => setDate('')}>Latest</Btn>}<Btn onClick={() => { setDate('2026-07-14'); setOn((o) => ({ ...o, gibsTrue: true, gibsFire: true })) }} title="Northwestern Ontario evacuations">14 Jul 2026</Btn></div></label>
        <label className="flex flex-col gap-1"><span className="label">Detections window</span>
          <select value={days} onChange={(e) => setDays(Number(e.target.value))} disabled={mode === 'live' && !firmsOn} title={mode === 'live' && !firmsOn ? 'Needs a NASA FIRMS key; without one only the last 24 h is available' : ''}>
            {[1, 2, 3, 5].map((d) => <option key={d} value={d}>{d === 1 ? '24 hours' : `${d} days`}</option>)}</select></label>
        <label className="flex flex-col gap-1"><span className="label">Fire status</span>
          <select value={stage} onChange={(e) => setStage(e.target.value as 'all' | 'OC')}><option value="all">All active fires</option><option value="OC">Out of control only</option></select></label>
        <label className="flex flex-col gap-1"><span className="label">Minimum size</span>
          <select value={minHa} onChange={(e) => setMinHa(Number(e.target.value))}>{[0, 100, 1000, 10000].map((h) => <option key={h} value={h}>{h === 0 ? 'Any size' : `${h.toLocaleString()} ha +`}</option>)}</select></label>
        {on.historic && <label className="flex flex-col gap-1"><span className="label">Historic fires since {sinceYear}</span>
          <input type="range" min={2011} max={2026} value={sinceYear} onChange={(e) => setSinceYear(Number(e.target.value))} className="w-36 accent-(--color-moss)" /></label>}
      </div>}

      <div className="relative overflow-hidden rounded-[10px] border border-line" style={{ height }}>
        <MapContainer center={[region?.lat ?? 56, region?.lon ?? -96]} zoom={compact ? 4 : region?.zoom ?? 4} minZoom={3} maxZoom={11} preferCanvas scrollWheelZoom={!compact} style={{ height: '100%' }} maxBounds={[[38, -170], [85, -40]]}>
          {!compact && region && <FlyTo lat={region.lat} lon={region.lon} zoom={region.zoom} />}
          <TileLayer url="https://tile.openstreetmap.org/{z}/{x}/{y}.png" attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors' />
          {on.gibsTrue && <WMSTileLayer key={`t${gibsDate}`} url={GIBS_WMS} params={{ layers: 'MODIS_Terra_CorrectedReflectance_TrueColor', format: 'image/jpeg', version: '1.3.0', time: gibsDate } as any} opacity={0.85} attribution="Imagery: NASA GIBS / EOSDIS" />}
          {on.gibsAod && <WMSTileLayer key={`a${gibsDate}`} url={GIBS_WMS} params={{ layers: 'MODIS_Combined_Value_Added_AOD', format: 'image/png', transparent: true, version: '1.3.0', time: gibsDate } as any} opacity={0.7} attribution="NASA GIBS" />}
          {on.gibsFire && <WMSTileLayer key={`f${gibsDate}`} url={GIBS_WMS} params={{ layers: 'VIIRS_NOAA20_Thermal_Anomalies_375m_All', format: 'image/png', transparent: true, version: '1.3.0', time: gibsDate } as any} attribution="NASA GIBS" />}

          {on.historic && shownHistoric.map((f) => <CircleMarker key={f.id} center={[f.lat, f.lon]} radius={6 + Math.sqrt(f.hectares) / 60} pathOptions={{ color: '#9aa7b4', weight: 1.2, fillOpacity: 0.08, dashArray: '3 3' }} eventHandlers={{ click: () => setSel({ t: 'historic', d: f }) }}><Tooltip>{f.name} · {f.year}</Tooltip></CircleMarker>)}
          {on.air && (summary.data ?? []).map((s) => { const b = aqiBand(s.air.usAqi); return <CircleMarker key={s.region.id} center={[s.region.lat, s.region.lon]} radius={26} pathOptions={{ color: b?.color ?? '#7f8c99', weight: 1.5, fillOpacity: 0.16 }} eventHandlers={{ click: () => { setSel({ t: 'region', d: s }); setRegionId(s.region.id) } }}><Tooltip>{s.region.short}: PM2.5 {fmt(s.air.pm25, 0)} µg/m³</Tooltip></CircleMarker> })}
          {on.hotspots && (hotspots.data ?? []).map((h, i) => <CircleMarker key={i} center={[h.lat, h.lon]} radius={h.frp == null ? 2 : Math.min(6, 1.6 + Math.sqrt(h.frp) / 3.2)} pathOptions={{ stroke: false, fillColor: h.frp != null && h.frp > 60 ? '#ffd27a' : '#ff7a3a', fillOpacity: 0.75 }} eventHandlers={{ click: () => setSel({ t: 'hotspot', d: h }) }} />)}
          {on.fires && !past && shownFires.map((f) => <CircleMarker key={f.id} center={[f.lat, f.lon]} radius={Math.max(4, Math.min(16, 3 + Math.log10(f.hectares + 1) * 2.4))} pathOptions={{ color: stageOf(f.stage).color, weight: 1.6, fillOpacity: 0.3 }} eventHandlers={{ click: () => setSel({ t: 'fire', d: f }) }}><Tooltip>{f.name} · {fmt(f.hectares)} ha</Tooltip></CircleMarker>)}
          {on.communities && (communities.data ?? []).map((c) => <CircleMarker key={c.id} center={[c.lat, c.lon]} radius={5} pathOptions={{ color: '#ffffff', weight: 1.5, fillColor: c.kind === 'Métis Settlement' ? '#2a6fad' : '#141b22', fillOpacity: 1 }} eventHandlers={{ click: () => setSel({ t: 'community', d: c }) }}><Tooltip>{c.name}</Tooltip></CircleMarker>)}
        </MapContainer>
        {(fires.loading || hotspots.loading) && <div className="num absolute top-2 right-2 z-[500] rounded bg-ink-900/90 px-2 py-1 text-[11px] text-mute" role="status">Loading map data…</div>}
      </div>

      <div className="mt-2 space-y-1 text-[12px]">
        {on.fires && fires.error && <p className="text-flame" role="alert">Active fires: {fires.error} <button className="underline" onClick={fires.reload}>Retry</button></p>}
        {on.hotspots && hotspots.error && <p className="text-ember" role="alert">Satellite detections: {hotspots.error}</p>}
        {on.fires && past && <p className="text-mute">Agency-reported active fires are only available for today, so they are hidden while a past date is selected.</p>}
        {date && mode === 'sim' && <p className="text-mute">The date changes the NASA imagery only. Simulated markers do not change with the date.</p>}
        {on.fires && !past && fires.data && shownFires.length === 0 && <p className="text-mute">No active fires match these filters{fires.data.length === 0 ? '. Fire agencies report none right now, which is normal outside fire season. Try a past date with the NASA layers, or the simulated scenario.' : '.'}</p>}
      </div>
      {!compact && <Sources sources={sources} />}
    </div>

    <aside className="min-w-0 space-y-3">
      <div className="panel" aria-live="polite">
        <p className="label mb-2">Selected location</p>
        {!sel ? <p className="text-[13px] text-mute">Select a marker on the map to see details here.</p> : <Detail sel={sel} />}
      </div>
      <div className="panel">
        <p className="label mb-2">Legend</p>
        <ul className="space-y-1.5 text-[12.5px]">
          {Object.values(STAGE).map((s) => <li key={s.label} className="flex items-center gap-2"><span className="h-3 w-3 rounded-full border-2" style={{ borderColor: s.color, background: `${s.color}55` }} />Active fire: {s.label.toLowerCase()}</li>)}
          <li className="flex items-center gap-2"><span className="h-2 w-2 rounded-full bg-[#ff7a3a]" /><span className="h-2.5 w-2.5 rounded-full bg-[#ffd27a]" />Satellite detection (brighter and larger = more radiative power)</li>
          <li className="flex items-center gap-2"><span className="h-3 w-3 rounded-full border border-dashed border-[#9aa7b4]" />Historic large fire (approximate)</li>
          <li className="flex items-center gap-2"><span className="h-2.5 w-2.5 rounded-full bg-moss" />First Nation <span className="ml-2 h-2.5 w-2.5 rounded-full bg-sky" />Métis Settlement</li>
          <li className="flex items-center gap-2"><span className="h-4 w-4 rounded-full border border-mute bg-mute/20" />Regional PM2.5 ring, coloured by US AQI band</li>
        </ul>
        <p className="mt-2.5 text-[11.5px] leading-relaxed text-dim">Fire circle size grows with reported area. Community markers show approximate, publicly known locations only.</p>
      </div>
      {compact && <Link to="/map" className="block rounded-md border border-line bg-ink-800 px-3 py-2 text-center text-[13px] hover:border-sky/60 hover:text-sky">Open the full map with date and filter controls →</Link>}
    </aside>
  </div>
}

function Row({ k, children }: { k: string; children: React.ReactNode }) {
  return <div className="flex justify-between gap-3 border-b border-line/60 py-1.5 text-[12.5px] last:border-0"><dt className="text-mute">{k}</dt><dd className="num text-right">{children}</dd></div>
}

function Detail({ sel }: { sel: Selected }) {
  if (sel.t === 'fire') { const f = sel.d; return <div><h3 className="font-semibold">{f.name}</h3><p className="mb-1.5 text-[12px] text-mute">Active fire reported by {f.agency || 'agency'}</p><dl>
    <Row k="Status"><span style={{ color: stageOf(f.stage).color }}>{stageOf(f.stage).label}</span></Row><Row k="Reported size">{fmt(f.hectares)} ha</Row><Row k="Last report">{f.startDate?.slice(0, 10) ?? '—'}</Row><Row k="Position">{f.lat.toFixed(2)}, {f.lon.toFixed(2)}</Row></dl></div> }
  if (sel.t === 'hotspot') { const h = sel.d; return <div><h3 className="font-semibold">Satellite fire detection</h3><p className="mb-1.5 text-[12px] text-mute">A pixel hot enough to indicate fire. Not every detection is a wildfire.</p><dl>
    <Row k="Radiative power">{h.frp == null ? 'not reported' : `${fmt(h.frp, 1)} MW`}</Row><Row k="Detected">{h.time ? fmtTime(h.time) : '—'}</Row><Row k="Sensor">{h.sensor}</Row><Row k="Position">{h.lat.toFixed(3)}, {h.lon.toFixed(3)}</Row></dl></div> }
  if (sel.t === 'historic') { const f = sel.d; return <div><h3 className="font-semibold">{f.name} ({f.year})</h3><p className="my-1.5 text-[12.5px] text-mute">{f.note}</p><dl><Row k="Approx. area">{f.hectares ? `${fmt(f.hectares)} ha` : 'not included'}</Row></dl></div> }
  if (sel.t === 'region') { const s = sel.d; return <div><h3 className="font-semibold">{s.region.name}</h3><dl className="mt-1.5">
    <Row k="Risk index"><RiskPill level={s.risk.level} score={s.risk.score} /></Row><Row k="US AQI"><AqiPill aqi={s.air.usAqi} /></Row><Row k="PM2.5">{fmt(s.air.pm25, 1)} µg/m³</Row><Row k="Detections ≤100 km">{s.hotspots100km}</Row><Row k="Active fires ≤250 km">{s.activeFires250km}</Row></dl>
    <div className="mt-2 flex gap-2 text-[12.5px]"><Link className="text-sky underline" to="/risk">Risk detail</Link><Link className="text-sky underline" to="/air">Air detail</Link></div></div> }
  const c = sel.d
  return <div><h3 className="font-semibold">{c.name}</h3><p className="mb-1.5 text-[12px] text-mute">{c.kind} · {c.province} · approximate location</p><dl>
    <Row k="Nearest active fire">{c.nearestFireKm == null ? 'none reported' : `${c.nearestFireKm} km`}</Row><Row k="Active fires ≤100 km">{c.fires100km}</Row><Row k="Detections ≤100 km">{c.hotspots100km}</Row><Row k="PM2.5 (modelled)">{fmt(c.pm25, 1)} µg/m³</Row><Row k="US AQI"><AqiPill aqi={c.usAqi} /></Row></dl>
    {c.reported.length > 0 && <p className="mt-2 text-[12px] text-mute">Publicly reported: {c.reported.join('; ')}.</p>}
    <p className="mt-2 text-[11.5px] text-dim">Distances are geographic proximity only. They are not an assessment of danger, which depends on wind, terrain and the community’s own knowledge.</p></div>
}

export { LEVEL_COLORS }
