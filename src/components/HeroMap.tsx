import { useEffect, useState } from 'react'
import { Circle, CircleMarker, MapContainer, Pane, TileLayer, Tooltip, WMSTileLayer, ZoomControl, useMap } from 'react-leaflet'
import { useSearchParams } from 'react-router-dom'
import type { ActiveFire, CommunityExposure, RegionSummary } from '../../shared/types.ts'
import { LEVEL_COLORS } from '../../shared/risk.ts'
import { useApi } from '../api.ts'
import { useApp } from '../state.tsx'

const GIBS_WMS = 'https://gibs.earthdata.nasa.gov/wms/epsg3857/best/wms.cgi'
const NASA_DATE = '2026-07-14'
const NASA_REGION = 'thunder-bay'
const NASA_ZOOM = 7
const INK = '#13211b'
const PANEL_SHIFT = 200 // half of the 400px left panel: targets sit in the middle of the visible map

const ESRI = 'https://server.arcgisonline.com/ArcGIS/rest/services/Canvas'

// .leaflet-tooltip is styled globally in styles.css, so these selectors carry the extra class to win.
const CSS = `
.leaflet-tooltip.region-label{background:transparent;border:0;box-shadow:none;padding:0;font-weight:700;font-size:13px;color:${INK};font-variant-numeric:tabular-nums;text-shadow:0 0 3px rgba(255,255,255,.9)}
.leaflet-tooltip.region-label::before,.leaflet-tooltip.community-label::before{display:none}
.leaflet-tooltip.community-label{background:#fff;border:0;border-radius:4px;box-shadow:0 1px 3px rgba(19,33,27,.3);padding:2px 6px;font-size:12px;font-weight:600;color:${INK}}
`

/** "Namaygoosisagagun (Collins) First Nation" becomes "Collins", matching news naming. */
const shortName = (name: string) => {
  const m = name.match(/\(([^),]+)\)/)
  return (m ? m[1] : name).replace(/ First Nations?\b/, '').trim()
}

/** Flies to a point so it lands 200px right of centre on wide screens, clear of the left panel. */
function FlyTo({ lat, lon, zoom }: { lat: number; lon: number; zoom: number }) {
  const map = useMap()
  useEffect(() => {
    const shift = window.innerWidth >= 768 ? PANEL_SHIFT : 0
    const center = map.unproject(map.project([lat, lon], zoom).subtract([shift, 0]), zoom)
    const reduce = window.matchMedia?.('(prefers-reduced-motion: reduce)').matches
    map.flyTo(center, zoom, { duration: 1, animate: !reduce })
  }, [lat, lon, zoom, map])
  return null
}

export default function HeroMap() {
  const { region, regions, setRegionId } = useApp()
  const [query] = useSearchParams()
  const [nasa, setNasa] = useState(() => query.get('nasa') === '1')

  const summary = useApi<RegionSummary[]>('summary')
  const fires = useApi<ActiveFire[]>('fires/active')
  const communities = useApi<CommunityExposure[]>('communities')

  const nasaRegion = regions.find((r) => r.id === NASA_REGION)
  const target = nasa && nasaRegion
    ? { lat: nasaRegion.lat, lon: nasaRegion.lon, zoom: NASA_ZOOM }
    : region ? { lat: region.lat, lon: region.lon, zoom: region.zoom || 6 } : null
  const isLabelled = (c: CommunityExposure) => nasa && c.reported.some((r) => r.includes('2026'))

  const btn = (active: boolean) => `inline-flex h-9 items-center rounded-full px-4 text-[13px] font-medium whitespace-nowrap transition-colors focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#13211b] ${active ? 'bg-[#13211b] text-white' : 'text-[#52615a] hover:text-[#13211b]'}`

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

      {/* Fixed panes: Leaflet stacks vectors by add order, so panes keep regions under fires under communities whatever loads first. */}
      <Pane name="hero-regions" style={{ zIndex: 350 }}>
        {!nasa && (summary.data ?? []).map((s) => {
          const color = LEVEL_COLORS[s.risk.level], selected = s.region.id === region?.id
          return <Circle key={s.region.id} center={[s.region.lat, s.region.lon]} radius={120000}
            pathOptions={{ color, fillColor: color, fillOpacity: selected ? 0.28 : 0.18, weight: selected ? 3 : 1.5, opacity: 0.6 }}
            eventHandlers={{ click: () => setRegionId(s.region.id) }}>
            <Tooltip permanent direction="center" className="region-label">{Math.round(s.risk.score)}</Tooltip>
          </Circle>
        })}
      </Pane>

      {!nasa && (fires.data ?? []).map((f) => <CircleMarker key={f.id} center={[f.lat, f.lon]} radius={4}
        pathOptions={{ color: '#ffffff', weight: 1, fillColor: '#e5482b', fillOpacity: 0.9 }}>
        <Tooltip>{f.name}</Tooltip>
      </CircleMarker>)}

      <Pane name="hero-communities" style={{ zIndex: 450 }}>
        {(communities.data ?? []).map((c) => {
          const lab = isLabelled(c)
          return <CircleMarker key={`${c.id}${lab ? '-label' : ''}`} center={[c.lat, c.lon]} radius={5}
            pathOptions={{ color: '#ffffff', weight: 1.5, fillColor: INK, fillOpacity: 1 }}>
            {lab
              ? <Tooltip permanent direction={/Collins|Namaygoosisagagun/.test(c.name) ? "left" : "right"} offset={/Collins|Namaygoosisagagun/.test(c.name) ? [-6, 0] : [6, 0]} className="community-label">{shortName(c.name)}</Tooltip>
              : <Tooltip>{c.name}</Tooltip>}
          </CircleMarker>
        })}
      </Pane>
    </MapContainer>

    <div role="group" aria-label="Map view" className="absolute bottom-6 left-1/2 z-[1000] flex -translate-x-1/2 gap-1 rounded-full bg-white p-1 shadow-lg md:left-[calc(50%+188px)]">
      <button type="button" aria-pressed={!nasa} onClick={() => setNasa(false)} className={btn(!nasa)}>Today</button>
      <button type="button" aria-pressed={nasa} onClick={() => setNasa(true)} className={btn(nasa)}>
        <span className="sm:hidden">NASA · 14 Jul</span><span className="hidden sm:inline">NASA satellite · 14 July 2026</span>
      </button>
    </div>
  </>
}
