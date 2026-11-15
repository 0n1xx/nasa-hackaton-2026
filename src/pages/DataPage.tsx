import { useEffect, useState } from 'react'
import type { StatusData } from '../../shared/types.ts'
import { FACTORS } from '../../shared/risk.ts'
import { useApp } from '../state.tsx'
import { Btn, KIND, KindBadge, PageHead, Panel, fmtTime } from '../components/ui.tsx'

export default function DataPage() {
  const { mode } = useApp()
  const [status, setStatus] = useState<StatusData | null>(null)
  const [err, setErr] = useState<string | null>(null)
  const load = () => { setErr(null); fetch('/api/status').then((r) => r.json()).then(setStatus).catch(() => setErr('Could not load integration status.')) }
  useEffect(load, [mode])

  return <>
    <PageHead kicker="Data and methods" title="Where every number comes from">Sources, their status on this server right now, how the risk index is calculated, and what the prototype cannot do.</PageHead>
    <div className="space-y-10">
      <Panel title="Data sources" sub="Live status of each integration, as seen by this server." right={<Btn onClick={load}>Refresh</Btn>}>
        {err ? <p role="alert" className="text-flame">{err}</p> : !status ? <div className="skeleton h-40" /> : <div className="overflow-x-auto"><table className="w-full min-w-[720px] text-[12.5px]">
          <thead><tr className="label text-left"><th className="pb-2 font-normal">Source</th><th className="pb-2 font-normal">Provides</th><th className="pb-2 font-normal">Key</th><th className="pb-2 font-normal">Last result</th></tr></thead>
          <tbody>{status.integrations.map((i) => <tr key={i.id} className="border-t border-line/60 align-top"><td className="py-2 pr-3 font-medium">{i.name}</td><td className="py-2 pr-3 text-mute">{i.purpose}</td>
            <td className="num py-2 pr-3">{!i.needsKey ? <span className="text-mute">none needed</span> : i.configured ? <span className="text-moss">configured</span> : <span className="text-sun">not set</span>}</td>
            <td className="num py-2">{i.lastError ? <span className="text-flame">failed · {i.lastError.split(' — ')[1]}</span> : i.lastOk ? <span className="text-moss">ok · {fmtTime(i.lastOk)}</span> : <span className="text-dim">not called yet</span>}</td></tr>)}
            <tr className="border-t border-line/60 align-top"><td className="py-2 pr-3 font-medium">NASA GIBS</td><td className="py-2 pr-3 text-mute">Daily satellite imagery on the map: true colour, thermal anomalies, aerosol optical depth</td><td className="num py-2 text-mute">none needed</td><td className="num py-2 text-dim">loaded by the browser as map tiles</td></tr>
          </tbody></table></div>}
        <p className="mt-3 text-[12px] text-mute">Keys live in the server’s <code className="num">.env</code> file and are never sent to the browser. See <code className="num">docs/API_REQUIREMENTS.md</code>.</p>
      </Panel>

      <Panel title="Five kinds of information, always labelled">
        <ul className="grid gap-2.5 sm:grid-cols-2 xl:grid-cols-5">{(['observed', 'historical', 'forecast', 'model', 'simulated'] as const).map((k) => <li key={k} className="border-t border-line pt-2.5"><KindBadge kind={k} /><p className="mt-1.5 text-[12px] leading-relaxed text-mute">{KIND[k].desc}.</p></li>)}</ul>
      </Panel>

      <Panel title="Risk index v0.1: the whole formula" sub="Index = 100 × Σ (weight × sub-score). Each sub-score is a straight-line ramp from 0 to 1. With snow on the ground or a maximum temperature at or below 0 °C, the result is multiplied by 0.2.">
        <div className="overflow-x-auto"><table className="w-full min-w-[640px] text-[12.5px]"><thead><tr className="label text-left"><th className="pb-2 font-normal">Input</th><th className="pb-2 font-normal">Weight</th><th className="pb-2 font-normal">Scoring rule</th></tr></thead>
          <tbody>{FACTORS.map((f) => <tr key={f.key} className="border-t border-line/60 align-top"><td className="py-2 pr-3">{f.label}</td><td className="num py-2 pr-3">{(f.weight * 100).toFixed(0)}%</td><td className="py-2 text-mute">{f.explain}</td></tr>)}</tbody></table></div>
        <ul className="mt-3 list-disc space-y-1.5 pl-5 text-[12.5px] leading-relaxed text-mute">
          <li>Levels: Low under 25, Moderate 25–49, High 50–74, Critical 75 and over.</li>
          <li>Weights and thresholds were chosen by the team for readability. They have not been fitted to, or tested against, fire occurrence records.</li>
          <li>A missing input is dropped and the remaining weights are rescaled; confidence falls and the uncertainty band widens. The band is a rule of thumb, not a statistical interval.</li>
          <li>Vegetation indices (NDVI) and drought codes are not inputs yet. Vapour pressure deficit and soil moisture stand in for fuel dryness.</li>
          <li>For operational decisions, use the Canadian Forest Fire Weather Index System and local fire authorities.</li>
        </ul>
      </Panel>

      <Panel title="Limits of this prototype">
        <ul className="list-disc space-y-1.5 pl-5 text-[12.5px] leading-relaxed text-mute">
          <li>Not an alerting or evacuation tool. It can be hours behind real conditions.</li>
          <li>Satellites miss small fires and fires under cloud or thick smoke; some detections are not wildfires.</li>
          <li>Weather and air quality are gridded model values, not local measurements.</li>
          <li>The community list is a small demonstration set with rounded coordinates, built without community involvement. A real version would be co-designed with, and governed by, the communities it describes.</li>
        </ul>
      </Panel>
    </div>
  </>
}
