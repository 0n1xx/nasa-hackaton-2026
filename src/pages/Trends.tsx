import { useState } from 'react'
import { Bar, BarChart, CartesianGrid, Cell, ComposedChart, Line, ResponsiveContainer, Scatter, ScatterChart, Tooltip, XAxis, YAxis, ZAxis } from 'recharts'
import type { HistoryData, RegionAir, RegionRisk } from '../../shared/types.ts'
import { useApi } from '../api.ts'
import { useApp } from '../state.tsx'
import { Async, KindBadge, PageHead, Panel, Sources, Stat, chartAxis, chartGrid, fmt, tooltipStyle } from '../components/ui.tsx'

const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec']

export default function Trends() {
  const { region, mode } = useApp()
  const history = useApi<HistoryData>('history')
  const risk = useApi<RegionRisk>(region ? `risk/${region.id}` : null)
  const air = useApi<RegionAir>(region ? `air/${region.id}?pastDays=92` : null)
  const [a, setA] = useState(2023)
  const [b, setB] = useState(2025)

  return <>
    <PageHead kicker="Historical trends and analytics" title="A decade of fire in Canada">
      National totals, the shape of the season, local climate normals and recent smoke. Every chart states where its numbers come from and where they are incomplete.
    </PageHead>
    <Async state={history} height={500}>{(h) => {
      const ya = h.years.find((y) => y.year === a)!, yb = h.years.find((y) => y.year === b)!
      const avg = h.years.reduce((s, y) => s + y.areaMha, 0) / h.years.length
      return <div className="space-y-10">
        <div className="grid grid-cols-1 gap-x-12 gap-y-10 xl:grid-cols-[1.5fr_1fr]">
          <Panel title="Area burned and number of fires, by year" sub="Bars: million hectares burned. Line: number of fires. Select a bar to compare that year.">
            <div className="h-[300px]"><ResponsiveContainer><ComposedChart data={h.years} margin={{ left: -16, right: -8, top: 8 }}>
              <CartesianGrid {...chartGrid} /><XAxis dataKey="year" {...chartAxis} /><YAxis yAxisId="l" {...chartAxis} /><YAxis yAxisId="r" orientation="right" {...chartAxis} domain={[0, 8000]} />
              <Tooltip {...tooltipStyle} formatter={(v: number, n, p) => n === 'areaMha' ? [`${v} Mha${p.payload.verified ? '' : ' (approximate)'}`, 'Area burned'] : [v.toLocaleString(), 'Fires']} />
              <Bar yAxisId="l" dataKey="areaMha" radius={[4, 4, 0, 0]} cursor="pointer" onClick={(d: any) => setA(d.year)} isAnimationActive={false}>{h.years.map((y) => <Cell key={y.year} fill={y.areaMha > avg * 1.5 ? '#d12c33' : '#e06a2c'} fillOpacity={y.verified ? 0.95 : 0.5} stroke={y.year === a || y.year === b ? '#141b22' : 'none'} />)}</Bar>
              <Line yAxisId="r" dataKey="fires" stroke="#9cc4e4" strokeWidth={1.8} dot={{ r: 2.5, fill: '#9cc4e4' }} isAnimationActive={false} />
            </ComposedChart></ResponsiveContainer></div>
            <p className="mt-1 text-[11.5px] text-dim">Solid bars were checked against a published figure. Faded bars are approximate values awaiting verification against the National Forestry Database.</p>
            <Sources sources={history.sources} />
          </Panel>
          <Panel title="Year-to-year comparison">
            <div className="mb-3 flex items-center gap-2 text-[13px]"><select value={a} onChange={(e) => setA(Number(e.target.value))} aria-label="First year">{h.years.map((y) => <option key={y.year}>{y.year}</option>)}</select><span className="text-mute">against</span><select value={b} onChange={(e) => setB(Number(e.target.value))} aria-label="Second year">{h.years.map((y) => <option key={y.year}>{y.year}</option>)}</select></div>
            <div className="grid grid-cols-2 gap-4">{[ya, yb].map((y) => <div key={y.year} className="rounded-lg border border-line p-3"><p className="font-display text-[20px] font-semibold">{y.year}</p>
              <div className="mt-2 space-y-3"><Stat label="Area burned" value={fmt(y.areaMha, 1)} unit="Mha" color="#f2884b" hint={`${fmt((y.areaMha / avg) * 100)}% of 2015–2025 mean`} /><Stat label="Fires" value={y.fires.toLocaleString()} /><Stat label="Mean fire size" value={fmt((y.areaMha * 1e6) / y.fires)} unit="ha" /></div>
              {!y.verified && <p className="mt-2 text-[11px] text-sun">approximate</p>}</div>)}</div>
            <p className="mt-3 text-[12.5px] leading-relaxed text-mute">{ya.year === yb.year ? 'Choose two different years.' : `${ya.areaMha >= yb.areaMha ? ya.year : yb.year} burned ${fmt(Math.max(ya.areaMha, yb.areaMha) / Math.max(0.01, Math.min(ya.areaMha, yb.areaMha)), 1)}× the area of ${ya.areaMha >= yb.areaMha ? yb.year : ya.year}, with ${fmt(Math.abs(ya.fires - yb.fires))} ${ya.fires === yb.fires ? '' : (ya.areaMha >= yb.areaMha ? ya.fires > yb.fires : yb.fires > ya.fires) ? 'more' : 'fewer'} fires.`}</p>
          </Panel>
        </div>

        <div className="grid grid-cols-1 gap-x-12 gap-y-10 xl:grid-cols-3">
          <Panel title="More fires does not mean more area" sub="Each dot is a year. Area burned depends on weather and fuel far more than on the number of ignitions.">
            <div className="h-[240px]"><ResponsiveContainer><ScatterChart margin={{ left: -14, right: 12, top: 8 }}>
              <CartesianGrid {...chartGrid} vertical /><XAxis type="number" dataKey="fires" name="Fires" domain={[3500, 7500]} {...chartAxis} /><YAxis type="number" dataKey="areaMha" name="Area" unit=" Mha" {...chartAxis} /><ZAxis range={[70, 70]} />
              <Tooltip {...tooltipStyle} cursor={{ strokeDasharray: '3 3' }} formatter={(v: number, n) => [n === 'Area' ? `${v} Mha` : v.toLocaleString(), n]} labelFormatter={() => ''} content={({ payload }) => payload?.[0] ? <div className="rounded-lg border border-line bg-ink-800 px-2.5 py-1.5 text-[12px]"><b>{payload[0].payload.year}</b>: {payload[0].payload.fires.toLocaleString()} fires, {payload[0].payload.areaMha} Mha</div> : null} />
              <Scatter data={h.years} fill="#f2884b" isAnimationActive={false} />
            </ScatterChart></ResponsiveContainer></div>
          </Panel>
          <Panel title="Shape of the fire season" sub="Share of annual area burned by month." right={<KindBadge kind="simulated" />}>
            <div className="h-[240px]"><ResponsiveContainer><BarChart data={h.seasonal} margin={{ left: -22, right: 8, top: 8 }}><CartesianGrid {...chartGrid} /><XAxis dataKey="month" {...chartAxis} /><YAxis unit="%" {...chartAxis} /><Tooltip {...tooltipStyle} formatter={(v: number) => [`${v}%`, 'Share (illustrative)']} /><Bar dataKey="share" fill="#e3c341" fillOpacity={0.6} radius={[4, 4, 0, 0]} isAnimationActive={false} /></BarChart></ResponsiveContainer></div>
            <p className="text-[11.5px] text-dim">Illustrative shape only, not measured data. To be replaced with monthly National Forestry Database statistics.</p>
          </Panel>
          <Panel title={`Climate normals · ${region?.short}`} sub="Long-term monthly maximum temperature (line) and rain (bars).">
            <Async state={risk} height={240}>{(r) => r.climate ? <><div className="h-[240px]"><ResponsiveContainer><ComposedChart data={MONTHS.map((m, i) => ({ m, t: r.climate!.tempC[i], p: +(r.climate!.precipMmDay[i] * 30.4).toFixed(0) }))} margin={{ left: -18, right: -14, top: 8 }}>
              <CartesianGrid {...chartGrid} /><XAxis dataKey="m" {...chartAxis} interval={0} tick={{ fontSize: 10, fill: '#7f8c99' }} /><YAxis yAxisId="t" unit="°" {...chartAxis} /><YAxis yAxisId="p" orientation="right" {...chartAxis} />
              <Tooltip {...tooltipStyle} formatter={(v: number, n) => [n === 't' ? `${v} °C` : `${v} mm`, n === 't' ? 'Mean daily max' : 'Rain per month']} />
              <Bar yAxisId="p" dataKey="p" fill="#9cc4e4" fillOpacity={0.35} radius={[3, 3, 0, 0]} isAnimationActive={false} /><Line yAxisId="t" dataKey="t" stroke="#f2884b" strokeWidth={2} dot={false} isAnimationActive={false} />
            </ComposedChart></ResponsiveContainer></div><div className="flex items-center gap-2 text-[11.5px] text-dim"><KindBadge kind={mode === 'sim' ? 'simulated' : 'historical'} />{mode === 'sim' ? 'Simulated' : 'NASA POWER climatology'}</div></> : <p className="rounded-lg border border-dashed border-line p-4 text-[13px] text-mute">NASA POWER normals could not be loaded for this location.</p>}</Async>
          </Panel>
        </div>

        <Panel title={`Smoke over the last three months · ${region?.short}`} sub="Daily mean PM2.5 from the CAMS model. This is the longest air quality history the prototype holds; multi-year station records are not yet connected.">
          <Async state={air} height={220} empty={(d) => (d.daily.length ? null : 'No air quality history returned for this location.')}>{(d) => <><div className="h-[220px]"><ResponsiveContainer><BarChart data={d.daily} margin={{ left: -18, right: 8, top: 8 }}><CartesianGrid {...chartGrid} /><XAxis dataKey="date" {...chartAxis} minTickGap={40} tickFormatter={(t) => new Date(t + 'T12:00').toLocaleDateString(undefined, { month: 'short', day: 'numeric' })} /><YAxis {...chartAxis} />
            <Tooltip {...tooltipStyle} formatter={(v: number, _n, p) => [`${v} µg/m³`, p.payload.kind === 'forecast' ? 'Forecast daily mean' : 'Daily mean']} />
            <Bar dataKey="pm25" isAnimationActive={false}>{d.daily.map((x) => <Cell key={x.date} fill={x.pm25 > 55.4 ? '#e5484d' : x.pm25 > 35.4 ? '#f2884b' : x.pm25 > 9 ? '#e3c341' : '#3fb68b'} fillOpacity={x.kind === 'forecast' ? 0.4 : 0.9} />)}</Bar></BarChart></ResponsiveContainer></div>
            <Sources sources={air.sources} /></>}</Async>
        </Panel>

        <Panel title="Gaps and caveats"><ul className="list-disc space-y-1.5 pl-5 text-[12.5px] leading-relaxed text-mute">{h.notes.map((n) => <li key={n}>{n}</li>)}<li>Regional (provincial) breakdowns by year are not included yet.</li><li>Satellite fire detections begin in 2000 (MODIS) and 2012 (VIIRS); earlier years rely on agency records only.</li></ul></Panel>
      </div> }}</Async>
  </>
}
