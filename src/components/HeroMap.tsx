import { useEffect, useMemo, useRef, useState } from 'react'
import { Circle, CircleMarker, MapContainer, Pane, Popup, Rectangle, TileLayer, Tooltip, WMSTileLayer, ZoomControl, useMap } from 'react-leaflet'
import { useSearchParams } from 'react-router-dom'
import { Pause, Play } from 'lucide-react'
import type { ReactNode } from 'react'
import type { ActiveFire, CommunityExposure, RegionSummary, RiskGrid, RiskLevel } from '../../shared/types.ts'
import { LEVEL_COLORS, levelFor, levelLabel } from '../../shared/risk.ts'
import { useApi } from '../api.ts'
import { useApp } from '../state.tsx'
import { stageWords } from '../explain.ts'
import { InfoPopover, fmtArea, fmtPlace, placeName, sourceLine } from './ui.tsx'
import HorizonSelector from './HorizonSelector.tsx'

const GIBS_WMS = 'https://gibs.earthdata.nasa.gov/wms/epsg3857/best/wms.cgi'
const NASA_DATE = '2026-07-14'
const NASA_REGION = 'thunder-bay'
const NASA_ZOOM = 7
const INK = '#13211b'
const PANEL_SHIFT = 200 // half of the 400px left panel: targets sit in the middle of the visible map
const STEP_MS = 900
const LEVELS: RiskLevel[] = ['Low', 'Moderate', 'High', 'Critical']

const ESRI = 'https://server.arcgisonline.com/ArcGIS/rest/services/Canvas'

// .leaflet-tooltip is styled globally in styles.css, so these selectors carry the extra class to win.
const CSS = `
.leaflet-tooltip.region-label{background:transparent;border:0;box-shadow:none;padding:0;font-weight:700;font-size:13px;color:${INK};font-variant-numeric:tabular-nums;text-shadow:0 0 3px rgba(255,255,255,.9)}
.leaflet-tooltip.region-label::before,.leaflet-tooltip.community-label::before{display:none}
.hero-popup .leaflet-popup-content-wrapper{border-radius:12px;box-shadow:0 10px 24px rgba(19,33,27,.18)}
.hero-popup .leaflet-popup-content{margin:12px 14px;font-size:13px;line-height:1.4;color:${INK}}
.leaflet-tooltip.community-label{background:#fff;border:0;border-radius:4px;box-shadow:0 1px 3px rgba(19,33,27,.3);padding:2px 6px;font-size:12px;font-weight:600;color:${INK}}
`

type GridDay = RiskGrid['days'][number]

const reducedMotion = () => !!window.matchMedia?.('(prefers-reduced-motion: reduce)').matches

/** 'YYYY-MM-DD' read as a local date, so the weekday doesn't slip a day west of UTC. */
const localDate = (iso: string) => {
  const [y, m, d] = iso.slice(0, 10).split('-').map(Number)
  return new Date(y, (m || 1) - 1, d || 1)
}
/** A bare date stays a local calendar day; a full timestamp is shown in local time. */
const anyDate = (iso: string) => (iso.length > 10 && !Number.isNaN(Date.parse(iso)) ? new Date(iso) : localDate(iso))
const monthDay = (d: Date) => d.toLocaleDateString('en-US', { month: 'short', day: 'numeric', ...(d.getFullYear() !== new Date().getFullYear() ? { year: 'numeric' } : {}) })
const shortDay = (d: GridDay) => d.kind === 'today' ? 'Today' : localDate(d.date).toLocaleDateString('en-US', { weekday: 'short' })
/** "Today", "Wednesday, Nov 18 (expected)", "Monday, Nov 9 (past)" */
const dayLine = (d: GridDay) => d.kind === 'today' ? 'Today'
  : `${localDate(d.date).toLocaleDateString('en-US', { weekday: 'long', month: 'short', day: 'numeric' })} (${d.kind === 'forecast' ? 'expected' : 'past'})`
/** Compact pill text when the window is long (up to 19 days): weekday initial and day of month, so repeated weekdays stay distinct. */
const pillDay = (d: GridDay, compact: boolean) => d.kind === 'today' ? 'Today'
  : compact ? `${localDate(d.date).toLocaleDateString('en-US', { weekday: 'narrow' })} ${localDate(d.date).getDate()}` : shortDay(d)
const validScore = (v: number | null | undefined): v is number => v != null && !Number.isNaN(v)

/** "Namaygoosisagagun (Collins) First Nation" becomes "Collins", matching news naming. */
const shortName = (name: string) => {
  const m = name.match(/\(([^),]+)\)/)
  return (m ? m[1] : name).replace(/ First Nations?\b/, '').trim()
}

/** Title for a map square on the chosen day: "Medium fire risk expected here on Sunday". */
function zoneTitle(level: RiskLevel, d: GridDay, today: GridDay | undefined) {
  const L = levelLabel(level)
  if (d.kind === 'today') return `${L} fire risk here today`
  const date = localDate(d.date)
  const far = today ? Math.abs(date.getTime() - localDate(today.date).getTime()) > 6 * 86400000 : false
  const on = `on ${date.toLocaleDateString('en-US', { weekday: 'long', ...(far ? { month: 'short', day: 'numeric' } : {}) })}`
  return d.kind === 'forecast' ? `${L} fire risk expected here ${on}` : `${L} fire risk here ${on}`
}

/** The body of every map popup: a title, one plain line, a few short sentences, then where the data came from. */
function Card({ title, line, lines, note, source }: { title: string; line?: string; lines: ReactNode[]; note?: string; source?: string | null }) {
  return <div className="w-[240px]">
    <p className="text-[14px] font-semibold leading-snug">{title}</p>
    {line && <p className="mt-0.5 text-[12.5px] text-[#52615a]">{line}</p>}
    <ul className="mt-2 space-y-0.5">
      {lines.map((l, i) => <li key={i}>{l}</li>)}
    </ul>
    {note && <p className="mt-2 text-[12px] text-[#52615a]">{note}</p>}
    {source && <p className="mt-2 border-t border-[#e8ebe7] pt-1.5 text-[12px] text-[#52615a]">{source}</p>}
  </div>
}

/** Flies to a point so it lands 200px right of centre on wide screens, clear of the left panel. */
function FlyTo({ lat, lon, zoom }: { lat: number; lon: number; zoom: number }) {
  const map = useMap()
  useEffect(() => {
    const shift = window.innerWidth >= 768 ? PANEL_SHIFT : 0
    const center = map.unproject(map.project([lat, lon], zoom).subtract([shift, 0]), zoom)
    map.flyTo(center, zoom, { duration: 1, animate: !reducedMotion() })
  }, [lat, lon, zoom, map])
  return null
}

export default function HeroMap() {
  const { region, regions, setRegionId, mode } = useApp()
  const [query] = useSearchParams()
  const [nasa, setNasa] = useState(() => query.get('nasa') === '1')

  const summary = useApi<RegionSummary[]>('summary')
  const fires = useApi<ActiveFire[]>('fires/active')
  const communities = useApi<CommunityExposure[]>('communities')
  const gridApi = useApi<RiskGrid>('risk-grid')
  // Anything missing or malformed falls back silently to the region circles.
  const grid = gridApi.data && gridApi.data.days?.length && gridApi.data.cells?.length ? gridApi.data : null

  const todayIdx = grid ? Math.max(0, grid.days.findIndex((d) => d.kind === 'today')) : 0
  const lastIdx = grid ? grid.days.length - 1 : 0
  const [dayPick, setDayPick] = useState<number | null>(null)
  const [playing, setPlaying] = useState(false)
  const day = Math.min(dayPick ?? todayIdx, lastIdx)
  const autoplayed = useRef(false)
  const [zone, setZone] = useState<{ i: number; lat: number; lon: number } | null>(null)
  const strip = useRef<HTMLDivElement>(null)
  const sim = mode === 'sim'

  // Play the week once when the grid first arrives, so the map visibly comes alive on stage.
  useEffect(() => {
    if (!grid || autoplayed.current) return
    autoplayed.current = true
    if (reducedMotion() || nasa || grid.days.length < 2) return
    setDayPick(0)
    setPlaying(true)
  }, [grid, nasa])

  useEffect(() => {
    if (!playing) return
    const id = window.setInterval(() => {
      setDayPick((d) => {
        const next = (d ?? 0) + 1
        if (next >= lastIdx) { setPlaying(false); return lastIdx }
        return next
      })
    }, STEP_MS)
    return () => window.clearInterval(id)
  }, [playing, lastIdx])

  useEffect(() => { if (nasa) { setPlaying(false); setZone(null) } }, [nasa])

  // Keep the selected day visible when the strip scrolls (long horizons, or playback).
  useEffect(() => {
    const box = strip.current
    const el = box?.querySelector<HTMLElement>('[aria-pressed="true"]')
    if (el && box && box.scrollWidth > box.clientWidth) box.scrollTo({ left: el.offsetLeft - box.clientWidth / 2 + el.clientWidth / 2, behavior: reducedMotion() ? 'auto' : 'smooth' })
  }, [day])

  const togglePlay = () => {
    if (playing) { setPlaying(false); return }
    if (day >= lastIdx) setDayPick(0)
    setPlaying(true)
  }

  const cellBounds = useMemo(() => (grid?.cells ?? []).map((c) => [
    [c.lat - grid!.cellLat / 2, c.lon - grid!.cellLon / 2],
    [c.lat + grid!.cellLat / 2, c.lon + grid!.cellLon / 2],
  ] as [[number, number], [number, number]]), [grid])

  // Region -> nearest grid cell, so each region label follows the selected day.
  const regionCell = useMemo(() => {
    const out = new Map<string, number>()
    if (!grid) return out
    for (const s of summary.data ?? []) {
      const k = Math.cos((s.region.lat * Math.PI) / 180)
      let best = -1, bestD = Infinity
      grid.cells.forEach((c, i) => {
        const d = (c.lat - s.region.lat) ** 2 + ((c.lon - s.region.lon) * k) ** 2
        if (d < bestD) { bestD = d; best = i }
      })
      if (best >= 0) out.set(s.region.id, best)
    }
    return out
  }, [grid, summary.data])

  const nasaRegion = regions.find((r) => r.id === NASA_REGION)
  const target = nasa && nasaRegion
    ? { lat: nasaRegion.lat, lon: nasaRegion.lon, zoom: NASA_ZOOM }
    : region ? { lat: region.lat, lon: region.lon, zoom: 5 } : null
  const isLabelled = (c: CommunityExposure) => nasa && c.reported.some((r) => r.includes('2026'))

  const btn = (active: boolean) => `inline-flex h-9 items-center rounded-full px-4 text-[13px] font-medium whitespace-nowrap transition-colors focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#13211b] ${active ? 'bg-[#13211b] text-white' : 'text-[#52615a] hover:text-[#13211b]'}`
  const pill = (active: boolean, forecast: boolean, gap: boolean) => [
    'inline-flex h-8 shrink-0 items-center rounded-full border px-2.5 text-[12px] font-medium whitespace-nowrap transition-colors focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#13211b]',
    forecast ? 'border-dashed' : '',
    active ? 'border-[#13211b] bg-[#13211b] text-white' : forecast ? 'border-[#c9302c]/55 text-[#52615a] hover:text-[#13211b]' : 'border-transparent text-[#52615a] hover:text-[#13211b]',
    gap ? 'ml-2' : '',
  ].join(' ')

  return <>
    <style>{CSS}</style>
    <MapContainer center={[56, -96]} zoom={4} minZoom={3} maxZoom={11} zoomControl={false} maxBounds={[[38, -170], [85, -40]]}
      className="h-full w-full" style={{ height: '100%', borderRadius: 0, background: '#f4f4f1' }}>
      {target && <FlyTo lat={target.lat} lon={target.lon} zoom={target.zoom} />}
      <TileLayer url={`${ESRI}/World_Light_Gray_Base/MapServer/tile/{z}/{y}/{x}`} maxZoom={16} zIndex={1} attribution="Tiles © Esri" />
      {!nasa && <TileLayer key="esri-ref" url={`${ESRI}/World_Light_Gray_Reference/MapServer/tile/{z}/{y}/{x}`} maxZoom={16} zIndex={2} />}
      <ZoomControl position="bottomright" />

      {nasa && <>
        <WMSTileLayer key="gibs-true" zIndex={3} url={GIBS_WMS} params={{ layers: 'MODIS_Terra_CorrectedReflectance_TrueColor', format: 'image/jpeg', version: '1.3.0', time: NASA_DATE } as any} opacity={1} attribution="Imagery: NASA GIBS / EOSDIS" />
        <WMSTileLayer key="gibs-fire" zIndex={4} url={GIBS_WMS} params={{ layers: 'VIIRS_NOAA20_Thermal_Anomalies_375m_All', format: 'image/png', transparent: true, version: '1.3.0', time: NASA_DATE } as any} />
      </>}

      {/* Fixed panes: Leaflet stacks vectors by add order, so panes keep zones under regions under fires under communities whatever loads first. */}
      {/* Map has no preferCanvas, so this pane gets its own SVG renderer and .risk-cell fill transitions run. Keyed by index: cells restyle in place. */}
      <Pane name="hero-zones" style={{ zIndex: 340 }}>
        {!nasa && grid && grid.cells.map((c, i) => {
          const v = c.scores[day]
          const ok = validScore(v)
          return <Rectangle key={i} bounds={cellBounds[i]}
            eventHandlers={{ click: (e) => { if (ok) setZone({ i, lat: e.latlng.lat, lon: e.latlng.lng }) } }}
            pathOptions={{ className: 'risk-cell', stroke: false, weight: 0, fillColor: ok ? LEVEL_COLORS[levelFor(v)] : '#ffffff', fillOpacity: ok ? 0.38 : 0 }} />
        })}
      </Pane>

      {!nasa && grid && zone && grid.cells[zone.i] && (() => {
        const cell = grid.cells[zone.i]
        const v = cell.scores[day]
        const d = grid.days[day]
        return <Popup key={zone.i} position={[zone.lat, zone.lon]} className="hero-popup" eventHandlers={{ remove: () => setZone(null) }}>
          <Card title={validScore(v) ? zoneTitle(levelFor(v), d, grid.days[todayIdx]) : 'No fire risk score for this square'}
            lines={validScore(v) ? [`Score: ${Math.round(v)} out of 100`, `Where: ${fmtPlace(cell.lat, cell.lon)}`] : []}
            note="Our estimate for this square of land, not an official fire danger rating."
            source={sim ? 'Example scenario, not real conditions' : sourceLine(gridApi.sources[0])} />
        </Popup>
      })()}

      <Pane name="hero-regions" style={{ zIndex: 350 }}>
        {!nasa && grid && (summary.data ?? []).map((s) => {
          const ci = regionCell.get(s.region.id)
          const v = ci != null ? grid.cells[ci].scores[day] : undefined
          const score = validScore(v) ? v : s.risk.score
          const selected = s.region.id === region?.id
          return <CircleMarker key={`${s.region.id}-zone`} center={[s.region.lat, s.region.lon]} radius={16}
            pathOptions={{ color: INK, weight: selected ? 2 : 0, opacity: 0.7, fillColor: '#ffffff', fillOpacity: 0 }}
            eventHandlers={{ click: () => setRegionId(s.region.id) }}>
            <Tooltip permanent direction="center" className="region-label">{Math.round(score)}</Tooltip>
          </CircleMarker>
        })}
        {!nasa && !grid && (summary.data ?? []).map((s) => {
          const color = LEVEL_COLORS[s.risk.level], selected = s.region.id === region?.id
          return <Circle key={s.region.id} center={[s.region.lat, s.region.lon]} radius={120000}
            pathOptions={{ color, fillColor: color, fillOpacity: selected ? 0.28 : 0.18, weight: selected ? 3 : 1.5, opacity: 0.6 }}
            eventHandlers={{ click: () => setRegionId(s.region.id) }}>
            <Tooltip permanent direction="center" className="region-label">{Math.round(s.risk.score)}</Tooltip>
          </Circle>
        })}
      </Pane>

      {!nasa && (fires.data ?? []).map((f) => <CircleMarker key={f.id} center={[f.lat, f.lon]} radius={4}
        pathOptions={{ className: 'fire-pulse', color: '#e5482b', weight: 1, opacity: 0.9, fillColor: '#e5482b', fillOpacity: 0.9 }}>
        <Tooltip>{f.name}</Tooltip>
        <Popup className="hero-popup">
          <Card title={sim ? 'Example fire (not real)' : 'Wildfire reported by fire crews'}
            line={sim ? f.name : `${f.name}${f.agency ? `, ${placeName(f.agency)}` : ''}`}
            lines={[`Status: ${stageWords(f.stage)}`, `Size: ${fmtArea(f.hectares)}`,
              f.startDate ? `Reported on ${monthDay(anyDate(f.startDate))}` : 'Report date not given', `Where: ${fmtPlace(f.lat, f.lon)}`]}
            source={sourceLine(fires.sources[0])} />
        </Popup>
      </CircleMarker>)}

      <Pane name="hero-communities" style={{ zIndex: 450 }}>
        {(communities.data ?? []).map((c) => {
          const lab = isLabelled(c)
          const fireSrc = communities.sources.find((x) => x.id === 'communities') ?? communities.sources[0]
          return <CircleMarker key={`${c.id}${lab ? '-label' : ''}`} center={[c.lat, c.lon]} radius={5}
            pathOptions={{ color: '#ffffff', weight: 1.5, fillColor: INK, fillOpacity: 1 }}>
            {lab
              ? <Tooltip permanent direction={/Collins|Namaygoosisagagun/.test(c.name) ? "left" : "right"} offset={/Collins|Namaygoosisagagun/.test(c.name) ? [-6, 0] : [6, 0]} className="community-label">{shortName(c.name)}</Tooltip>
              : <Tooltip>{c.name}</Tooltip>}
            <Popup className="hero-popup">
              <Card title={c.name} line={`${c.kind}, ${placeName(c.province)}`}
                lines={[c.nearestFireKm == null ? 'No wildfire reported nearby'
                  : `Nearest ${sim ? 'example fire' : 'wildfire reported by fire crews'}: ${Math.round(c.nearestFireKm)} km away${c.nearestFireName ? ` (${c.nearestFireName})` : ''}`]}
                note={`Approximate public location. Distance shows how close a fire is, not how dangerous it is.${sim ? ' Fires here are from the example scenario.' : ''}`}
                source={sourceLine(fireSrc)} />
            </Popup>
          </CircleMarker>
        })}
      </Pane>
    </MapContainer>

    <div role="group" aria-label="Map view" className="absolute right-4 top-4 z-[1000] flex gap-1 rounded-full bg-white p-1 shadow-lg">
      <button type="button" aria-pressed={!nasa} onClick={() => setNasa(false)} className={btn(!nasa)}>Today</button>
      <button type="button" aria-pressed={nasa} onClick={() => setNasa(true)} className={btn(nasa)}>
        <span className="sm:hidden">NASA, 14 July</span><span className="hidden sm:inline">NASA satellite, 14 July 2026</span>
      </button>
    </div>

    {/* Bottom stack, about 146 px tall: look-ahead control, the chosen day, the day scrubber */}
    {!nasa && grid && <div className="absolute bottom-6 left-1/2 z-[1000] flex max-w-[calc(100vw-32px)] -translate-x-1/2 flex-col items-center gap-2 md:left-[calc(50%+188px)] md:max-w-[calc(100vw-424px)]">
      <div className="rounded-full bg-white/95 py-0.5 pl-3 pr-0.5 shadow-sm"><HorizonSelector compact label /></div>
      <p aria-live="polite" className="rounded-full bg-white/90 px-3 py-0.5 text-[13px] font-semibold whitespace-nowrap text-[#13211b] shadow-sm">{dayLine(grid.days[day])}</p>
      <div className="flex max-w-full items-center gap-2 rounded-2xl bg-white p-1.5 shadow-lg">
        <button type="button" onClick={togglePlay} aria-label={playing ? 'Pause' : 'Play the days'}
          className="inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-[#13211b] text-white transition-colors hover:bg-[#2a3a32] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#13211b]">
          {playing ? <Pause size={15} fill="currentColor" /> : <Play size={15} fill="currentColor" className="ml-0.5" />}
        </button>
        <div ref={strip} role="group" aria-label="Day" className="flex min-w-0 items-center gap-1 overflow-x-auto [scrollbar-width:thin]">
          {grid.days.map((d, i) => {
            const fc = d.kind === 'forecast'
            const firstFc = fc && i > 0 && grid.days[i - 1].kind !== 'forecast'
            const many = grid.days.length > 9
            return <span key={`${d.date}-${i}`} className="flex shrink-0 items-center gap-1">
              {firstFc && <span className="ml-1.5 shrink-0 text-[12px] font-semibold text-[#c9302c]">Expected</span>}
              <button type="button" aria-pressed={i === day} title={dayLine(d)}
                onClick={() => { setPlaying(false); setDayPick(i) }} className={`${pill(i === day, fc, false)} ${many ? 'px-2' : ''}`}>
                {pillDay(d, many)}
              </button>
            </span>
          })}
        </div>
      </div>
    </div>}

    {/* Sits above the bottom stack at every width, so a long look-ahead never runs into it */}
    <div aria-label="Map key" className="absolute bottom-[154px] left-4 z-[1000] flex flex-col items-start gap-0.5 rounded-xl bg-white/95 px-2 py-1.5 text-[12px] text-[#13211b] shadow-md md:left-[392px]">
      {!nasa && LEVELS.map((l) => <InfoPopover key={l} k={`level.${l}`} className="px-1 py-0.5 hover:bg-[#13211b]/5">
        <span aria-hidden className="h-3 w-3 shrink-0 rounded-sm" style={{ background: LEVEL_COLORS[l], opacity: 0.75 }} />{levelLabel(l)}
      </InfoPopover>)}
      {!nasa && <InfoPopover k={sim ? 'simulatedScenario' : 'activeFire'} className="px-1 py-0.5 hover:bg-[#13211b]/5">
        <span aria-hidden className="mx-0.5 h-2 w-2 shrink-0 rounded-full bg-[#e5482b]" />{sim ? 'Example fire (not real)' : 'Wildfire reported by fire crews'}
      </InfoPopover>}
      {nasa && <InfoPopover k="nasaTrueColour" className="px-1 py-0.5 hover:bg-[#13211b]/5">
        <span aria-hidden className="h-3 w-3 shrink-0 rounded-sm bg-[linear-gradient(135deg,#3d6b3a,#a9b3a0_55%,#f4f4f1)]" />Satellite photo
      </InfoPopover>}
      {nasa && <InfoPopover k="nasaThermal" className="px-1 py-0.5 hover:bg-[#13211b]/5">
        <span aria-hidden className="mx-0.5 h-2 w-2 shrink-0 rounded-[2px] bg-[#ff3b1f]" />Heat seen by satellite
      </InfoPopover>}
      <InfoPopover k="community" className="px-1 py-0.5 hover:bg-[#13211b]/5">
        <span aria-hidden className="h-2.5 w-2.5 shrink-0 rounded-full border-[1.5px] border-white bg-[#13211b] shadow-[0_0_0_1px_#13211b]" />Community
      </InfoPopover>
    </div>
  </>
}
