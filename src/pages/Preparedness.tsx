import type { RegionAir, RegionRisk, RiskLevel } from '../../shared/types.ts'
import { LEVEL_COLORS } from '../../shared/risk.ts'
import { aqiBand } from '../../shared/aqi.ts'
import { useApi } from '../api.ts'
import { useApp } from '../state.tsx'
import { ACTIONS, DISCLAIMER } from '../actions.ts'
import { useState } from 'react'
import { AqiPill, Async, Btn, PageHead, Panel, RiskPill } from '../components/ui.tsx'

const STANDING = {
  community: [
    ['Watch conditions, not just flames', 'Follow humidity, wind and new satellite detections each day in fire season, so changes are noticed before smoke arrives.'],
    ['A plan that fits this community', 'Emergency plans written by the community: who needs help first, where clean air is, which routes work when the road or airstrip is closed.'],
    ['Communication that reaches everyone', 'More than one channel, in the languages people use, including for members on the land without cell coverage.'],
    ['Track smoke as closely as fire', 'Low-cost sensors, clean-air rooms and portable filters protect far more people, far more often, than evacuation does.'],
    ['Work with fire agencies as partners', 'Shared maps, named contacts and agreed triggers set up before the season.'],
    ['Fire stewardship', 'Cultural burning and fuel management led by knowledge keepers, where the Nation chooses to practise it. Each Nation’s protocols differ.'],
    ['Know what will be needed', 'Pumps, hose, sprinkler kits, fuel, generators, masks and filters, listed and requested before high-risk periods.'],
  ],
  agency: [
    ['Monitor where risk is highest', 'Focus sensors, patrols and analysis on regions where the index, detections and smoke are rising together.'],
    ['Move resources before the fire', 'Pre-position crews and equipment near remote communities when the outlook worsens, not after an order is issued.'],
    ['Close the monitoring gap', 'Many northern communities have no air quality monitor or weather station. Fund them, and let communities own the data.'],
    ['Coordinate with Indigenous leadership', 'Decisions made with chiefs, councils and Métis governments, with community observations treated as intelligence.'],
    ['Fund Indigenous-led stewardship', 'Stable funding for guardians programs, community fire crews and cultural burning, and removal of legal barriers to them.'],
    ['Fix warnings and hosting', 'Clear, early, consistent alerts. If people must leave, keep families together and close to home, with their own supports.'],
  ],
} as const

export default function Preparedness() {
  const { region } = useApp()
  const risk = useApi<RegionRisk>(region ? `risk/${region.id}` : null)
  const air = useApi<RegionAir>(region ? `air/${region.id}?pastDays=7` : null)
  const [preview, setPreview] = useState<RiskLevel | null>(null)

  return <>
    <PageHead kicker="Prevention and preparedness" title="From information to action">
      What the current conditions suggest for {region?.name}, followed by standing recommendations. Climate-driven wildfire is not a problem communities created or can solve alone; the second column is as important as the first.
    </PageHead>
    <div className="space-y-10">
      <Async state={risk} height={280}>{(r) => { const level = preview ?? r.today.level, c = LEVEL_COLORS[level]
        return <Panel title={`Suggested now · ${r.region.short}`} sub={preview ? `Previewing guidance for ${preview} risk. Current level is ${r.today.level}.` : 'Tied to today’s risk level and air quality for the selected region.'}
          right={<div className="flex flex-wrap items-center gap-1.5"><span className="label">Preview level</span>{(['Low', 'Moderate', 'High', 'Critical'] as RiskLevel[]).map((l) => <Btn key={l} active={level === l} onClick={() => setPreview(l === r.today.level ? null : l)}>{l}</Btn>)}</div>}>
          <div className="mb-3 flex flex-wrap items-center gap-3 text-[13px]"><span className="text-mute">Risk index today</span><RiskPill level={r.today.level} score={r.today.score} />
            {air.data && <><span className="text-mute">US AQI</span><AqiPill aqi={air.data.now.usAqi} /></>}</div>
          <div className="grid gap-5 md:grid-cols-2">{(['community', 'agency'] as const).map((who) => <div key={who}><p className="label mb-2">{who === 'community' ? 'For communities' : 'For governments and emergency management'}</p>
            <ul className="space-y-2 text-[13px] leading-relaxed">{ACTIONS[level][who].map((a) => <li key={a} className="flex gap-2.5"><span className="mt-[7px] h-1.5 w-1.5 shrink-0 rounded-full" style={{ background: c }} />{a}</li>)}</ul></div>)}</div>
          {air.data && (air.data.now.usAqi ?? 0) > 100 && <p className="mt-4 rounded-md border border-sky/40 bg-sky/8 p-3 text-[13px] text-sky">Smoke: {aqiBand(air.data.now.usAqi)?.advice}</p>}
          <p className="mt-3 text-[11.5px] text-dim">{DISCLAIMER}</p>
        </Panel> }}</Async>

      <div className="grid grid-cols-1 gap-x-12 gap-y-10 xl:grid-cols-2">{(['community', 'agency'] as const).map((who) => <Panel key={who} title={who === 'community' ? 'For communities' : 'For governments and emergency management organizations'} sub={who === 'community' ? 'Options to adapt, not obligations. Each community knows its land and people best.' : 'Where responsibility and resources sit.'}>
        <ol className="space-y-3">{STANDING[who].map(([t, d], i) => <li key={t} className="flex gap-3"><span className="num mt-0.5 flex h-6 w-6 shrink-0 items-center justify-center rounded-full border border-line text-[11px] text-mute">{i + 1}</span><div><p className="text-[13.5px] font-medium">{t}</p><p className="text-[12.5px] leading-relaxed text-mute">{d}</p></div></li>)}</ol>
      </Panel>)}</div>
    </div>
  </>
}
