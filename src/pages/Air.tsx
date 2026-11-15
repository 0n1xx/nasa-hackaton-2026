import { useState } from 'react'
import { Area, AreaChart, Bar, BarChart, CartesianGrid, Cell, ReferenceLine, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts'
import type { AirTrend, RegionAir, RegionSummary } from '../../shared/types.ts'
import { AQI_BANDS, aqiBand, aqiFromPm25 } from '../../shared/aqi.ts'
import { MAX_AIR_HORIZON } from '../../shared/horizon.ts'
import { useApi } from '../api.ts'
import { useApp } from '../state.tsx'
import { Async, Btn, PageHead, Panel, Sources, Stat, chartAxis, chartGrid, fmt, fmtTime, tooltipStyle } from '../components/ui.tsx'

export default function Air() {
  const { region, setRegionId, horizon } = useApp()
  const airDays = Math.min(horizon, MAX_AIR_HORIZON)
  const [span, setSpan] = useState(7)
  const air = useApi<RegionAir>(region ? `air/${region.id}?pastDays=${span}` : null)
  const summary = useApi<RegionSummary[]>('summary')
  const trends = useApi<AirTrend[]>('air-trends')

  return <>
    <PageHead kicker="Air quality intelligence" title={`Smoke and air quality · ${region?.short}`}>
      Wildfire smoke travels hundreds of kilometres and is the way most people experience a fire. This page tracks fine particles (PM2.5), the pollutant in smoke that matters most for health.
    </PageHead>
    <div className="space-y-10">
      <Async state={air} height={420}>{(a) => {
        const band = aqiBand(a.now.usAqi)
        const nowIdx = a.hourly.findIndex((h) => h.kind === 'forecast')
        const series = a.hourly.map((h) => ({ t: h.time, past: h.kind === 'model' ? h.pm25 : null, fc: h.kind === 'forecast' ? h.pm25 : null, pm10: h.pm10 }))
        if (nowIdx > 0) series[nowIdx - 1].fc = series[nowIdx - 1].past // join the two lines
        return <div className="grid grid-cols-1 gap-x-12 gap-y-10 xl:grid-cols-[340px_1fr]">
          <Panel info="aqi" title="Right now" sub={`Model time ${fmtTime(a.now.time)}`}>
            <div className="rounded-lg p-4" style={{ background: `${band?.color ?? '#7f8c99'}18`, border: `1px solid ${band?.color ?? '#7f8c99'}55` }}>
              <p className="label">US AQI (EPA scale, 0–500)</p>
              <p className="num text-[52px] leading-none font-medium" style={{ color: band?.color }}>{a.now.usAqi ?? '—'}</p>
              <p className="mt-1 font-medium" style={{ color: band?.color }}>{band?.label ?? 'No data'}</p>
              <p className="mt-2 text-[12.5px] leading-relaxed text-mute">{band?.advice}</p>
            </div>
            <div className="mt-4 grid grid-cols-3 gap-3">
              <Stat label="PM2.5" value={fmt(a.now.pm25, 1)} unit="µg/m³" /><Stat label="PM10" value={fmt(a.now.pm10, 1)} unit="µg/m³" /><Stat label="Aerosol depth" value={fmt(a.now.aod, 2)} hint="smoke in the air column" />
            </div>
            <p className="mt-3 text-[11.5px] leading-relaxed text-dim">Canada’s official index is the AQHI (1 to 10+), which uses a different formula. It is not shown here, and the two scales must not be compared number for number.</p>
            <Sources sources={air.sources} />
          </Panel>
          <Panel info="pm25" title="PM2.5, hour by hour" sub={`Solid: model analysis of past hours. Dashed: forecast for the next ${airDays} day${airDays === 1 ? '' : 's'}.`} right={<div className="flex gap-1.5">{[3, 7, 30, 92].map((d) => <Btn key={d} active={span === d} onClick={() => setSpan(d)}>{d} d</Btn>)}</div>}>
            <div className="h-[330px]"><ResponsiveContainer><AreaChart data={series} margin={{ left: -14, right: 8, top: 8 }}>
              <defs><linearGradient id="pm" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stopColor="#9cc4e4" stopOpacity={0.45} /><stop offset="1" stopColor="#9cc4e4" stopOpacity={0} /></linearGradient></defs>
              <CartesianGrid {...chartGrid} /><XAxis dataKey="t" {...chartAxis} minTickGap={60} tickFormatter={(t) => new Date(t).toLocaleDateString(undefined, { month: 'short', day: 'numeric' })} /><YAxis {...chartAxis} unit="" />
              <Tooltip {...tooltipStyle} labelFormatter={(t) => fmtTime(String(t))} formatter={(v: number, n) => [`${v} µg/m³ (AQI≈${aqiFromPm25(v)})`, n === 'past' ? 'PM2.5 analysis' : 'PM2.5 forecast']} />
              {[{ y: 35.4, c: '#f2884b', l: 'sensitive groups' }, { y: 55.4, c: '#e5484d', l: 'unhealthy' }].map((r) => <ReferenceLine key={r.y} y={r.y} stroke={r.c} strokeDasharray="4 4" strokeOpacity={0.7} label={{ value: r.l, fill: r.c, fontSize: 10, position: 'insideTopLeft' }} />)}
              <Area type="monotone" dataKey="past" stroke="#9cc4e4" strokeWidth={1.8} fill="url(#pm)" connectNulls={false} isAnimationActive={false} />
              <Area type="monotone" dataKey="fc" stroke="#9cc4e4" strokeWidth={1.8} strokeDasharray="5 4" fill="none" connectNulls={false} isAnimationActive={false} />
            </AreaChart></ResponsiveContainer></div>
            <p className="mt-1 text-[11.5px] text-dim">Reference lines mark 24-hour PM2.5 breakpoints for US AQI 100 and 150. Hourly values against them are indicative.</p>
            {horizon > MAX_AIR_HORIZON && <p className="mt-1 text-[11.5px] text-dim">Air quality forecasts go up to {MAX_AIR_HORIZON} days.</p>}
          </Panel>
        </div> }}</Async>

      <div className="grid grid-cols-1 gap-x-12 gap-y-10 xl:grid-cols-2">
        <Panel title="Regional comparison" sub="Current modelled PM2.5. Select a bar to switch region.">
          <Async state={summary} height={280}>{(rows) => <div className="h-[280px]"><ResponsiveContainer><BarChart data={rows.map((s) => ({ id: s.region.id, name: s.region.short, pm25: s.air.pm25, aqi: s.air.usAqi }))} layout="vertical" margin={{ left: 30, right: 16 }}>
            <CartesianGrid {...chartGrid} horizontal={false} vertical /><XAxis type="number" {...chartAxis} /><YAxis type="category" dataKey="name" {...chartAxis} width={100} />
            <Tooltip {...tooltipStyle} formatter={(v: number, _n, p) => [`${v} µg/m³ · US AQI ${p.payload.aqi}`, 'PM2.5']} />
            <Bar dataKey="pm25" radius={[0, 4, 4, 0]} onClick={(d: any) => setRegionId(d.id)} cursor="pointer" isAnimationActive={false}>
              {rows.map((s) => <Cell key={s.region.id} fill={aqiBand(s.air.usAqi)?.color ?? '#7f8c99'} fillOpacity={s.region.id === region?.id ? 1 : 0.55} />)}</Bar>
          </BarChart></ResponsiveContainer></div>}</Async>
        </Panel>
        <Panel title="Where air is getting worse" sub="Mean PM2.5 over the last 24 hours against the 24 hours before.">
          <Async state={trends} height={280} empty={(t) => (t.every((x) => x.change == null) ? 'No trend data available.' : null)}>{(rows) => <>
            <ul className="divide-y divide-line/60">{[...rows].sort((a, b) => (b.change ?? -1e9) - (a.change ?? -1e9)).map((t) => {
              const worse = (t.change ?? 0) > 2, better = (t.change ?? 0) < -2
              return <li key={t.regionId} className="flex flex-wrap items-center justify-between gap-x-3 gap-y-1 py-2 text-[13px]"><button className="text-left hover:text-sky" onClick={() => setRegionId(t.regionId)}>{t.short}</button>
                <span className="num flex items-center gap-3 whitespace-nowrap"><span className="text-mute">{fmt(t.prev24, 1)} → {fmt(t.last24, 1)} µg/m³</span>
                  <span className="w-28 text-right" style={{ color: worse ? '#f2884b' : better ? '#5fc48f' : '#9aa7b4' }}>{worse ? '▲ deteriorating' : better ? '▼ improving' : '■ steady'}</span></span></li> })}</ul>
            <Sources sources={trends.sources} /></>}</Async>
        </Panel>
      </div>

      <div className="grid grid-cols-1 gap-x-12 gap-y-10 xl:grid-cols-[1.3fr_1fr]">
        <Panel title="What the levels mean for health" sub="US EPA categories. Smoke affects Elders, children, pregnant people and anyone with heart or lung conditions first.">
          <Async state={air} height={200}>{(a) => <ul className="space-y-1.5">{AQI_BANDS.map((b, i) => { const lo = i === 0 ? 0 : AQI_BANDS[i - 1].max + 1; const cur = aqiBand(a.now.usAqi) === b
            return <li key={b.label} className={`flex flex-wrap gap-x-3 gap-y-0.5 rounded-md px-2.5 py-2 text-[12.5px] md:flex-nowrap ${cur ? 'bg-ink-800 ring-1 ring-line' : ''}`}><span className="num w-16 shrink-0" style={{ color: b.color }}>{lo}–{b.max > 500 ? '500' : b.max}</span><span className="w-44 shrink-0 font-medium" style={{ color: b.color }}>{b.label}{cur && ' ← now'}</span><span className="min-w-0 basis-full text-mute md:basis-auto">{b.advice}</span></li> })}</ul>}</Async>
        </Panel>
        <Panel title="Reading the measurements">
          <dl className="space-y-2.5 text-[12.5px] leading-relaxed">
            {[['PM2.5', 'Particles under 2.5 micrometres, small enough to reach deep into the lungs and the bloodstream. The main health hazard in wildfire smoke.'], ['PM10', 'Particles under 10 micrometres, including ash and dust. Irritates airways.'], ['Aerosol optical depth', 'How much sunlight particles block through the whole air column, seen from satellites. High values with clean air at ground level mean smoke is passing overhead.'], ['Modelled, not measured', 'Values here come from the Copernicus (CAMS) global model on a grid of roughly 40 km. Local sensors can read much higher near a fire. Many northern communities have no monitor at all, which is itself a gap worth closing.']].map(([t, d]) => <div key={t}><dt className="font-medium text-fg">{t}</dt><dd className="text-mute">{d}</dd></div>)}
          </dl>
        </Panel>
      </div>
    </div>
  </>
}
