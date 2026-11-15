import { Link, Navigate, NavLink, Route, Routes, useLocation } from 'react-router-dom'
import { useEffect } from 'react'
import { useApp } from './state.tsx'
import Home from './pages/Home.tsx'
import Community from './pages/Community.tsx'
import AskForHelp from './pages/AskForHelp.tsx'
import AssistantPage from './pages/AssistantPage.tsx'
import About from './pages/About.tsx'
import Overview from './pages/Overview.tsx'
import MapPage from './pages/MapPage.tsx'
import Air from './pages/Air.tsx'
import Risk from './pages/Risk.tsx'
import Communities from './pages/Communities.tsx'
import Trends from './pages/Trends.tsx'
import Preparedness from './pages/Preparedness.tsx'
import DataPage from './pages/DataPage.tsx'

/** The wordmark is the logo: no clip-art. */
export function Logo() {
  return <NavLink to="/" className="shrink-0 font-wordmark text-[19px] font-bold tracking-[-0.01em] text-fg" aria-label="Before the Smoke, home">Before the Smoke</NavLink>
}

/** Shown under the header on every screen while the example scenario is on. Screenshots travel, so it is never optional. */
function ExampleBanner() {
  const { mode, setMode } = useApp()
  if (mode !== 'sim') return null
  return <div role="status" className="flex shrink-0 items-center gap-3 border-b border-line border-l-4 border-l-fg bg-example px-4 py-2 text-[15px] md:px-6 print:border-0 print:bg-transparent print:px-0">
    <p className="min-w-0 flex-1"><span className="font-semibold">Example scenario, not real conditions.</span><span className="sm:hidden"> Set on 14 July 2026.</span><span className="hidden sm:inline"> A summer day, 14 July 2026, the week of the real evacuations near Thunder Bay. Fires, weather and smoke here are made up; the NASA satellite photo is real.</span></p>
    <button type="button" onClick={() => setMode('live')} className="shrink-0 rounded-md px-2 py-1 text-[15px] font-semibold text-action underline underline-offset-2 hover:text-action-deep print:hidden">Use live data</button>
  </div>
}

/** Screens that fill the window themselves (map layouts); everything else scrolls in a reading column. */
const FULL_SCREEN = (path: string) => path === '/' || /^\/c\/[^/]+\/?$/.test(path)

export default function App() {
  const { region, mode, setMode, bootError } = useApp()
  const loc = useLocation()
  const full = FULL_SCREEN(loc.pathname)
  useEffect(() => { document.querySelector('main')?.scrollTo({ top: 0 }) }, [loc.pathname])

  return <div className="flex h-full flex-col print:block print:h-auto">
    <header className="z-[1100] flex h-14 shrink-0 items-center gap-4 border-b border-line bg-white px-4 md:px-6 print:hidden">
      <Logo />
      <div className="ml-auto flex items-center gap-4">
        {loc.pathname !== '/' && <Link to="/" className="hidden text-[15px] text-mute hover:text-fg sm:inline">All communities</Link>}
        <Link to="/about" className="hidden text-[15px] text-mute hover:text-fg sm:inline">About the data</Link>
        <div className="inline-flex shrink-0 overflow-hidden rounded-md border border-edge bg-white" role="group" aria-label="Which data to show">
          {(['live', 'sim'] as const).map((m, i) => <button key={m} type="button" aria-pressed={mode === m} onClick={() => setMode(m)}
            className={`h-10 px-3 text-[14px] whitespace-nowrap sm:px-3.5 ${i ? 'border-l border-edge' : ''} ${mode === m ? 'bg-fg font-semibold text-white' : 'text-fg hover:bg-ink-800'}`}>
            <span className="sm:hidden">{m === 'live' ? 'Live' : 'Example'}</span>
            <span className="hidden sm:inline">{m === 'live' ? 'Live data' : 'Example scenario'}</span>
          </button>)}
        </div>
      </div>
    </header>
    <ExampleBanner />

    <main className={`relative min-h-0 flex-1 print:overflow-visible ${full ? 'overflow-y-auto md:overflow-hidden' : 'overflow-y-auto'}`}>
      {bootError ? <div role="alert" className="p-8 text-danger">{bootError}</div> : !region ? <div className="skeleton m-8 h-64" /> :
        <Routes>
          <Route path="/" element={<Home />} />
          <Route path="/c/:id" element={<Community />} />
          <Route path="/c/:id/help" element={<Page><AskForHelp /></Page>} />
          <Route path="/c/:id/ask" element={<AssistantPage />} />
          <Route path="/about" element={<Page><About /></Page>} />
          {/* Older screens: still reachable, not in the navigation. */}
          <Route path="/overview" element={<Page><Overview /></Page>} />
          <Route path="/map" element={<Page><MapPage /></Page>} />
          <Route path="/air" element={<Page><Air /></Page>} />
          <Route path="/risk" element={<Page><Risk /></Page>} />
          <Route path="/communities" element={<Page><Communities /></Page>} />
          <Route path="/trends" element={<Page><Trends /></Page>} />
          <Route path="/preparedness" element={<Page><Preparedness /></Page>} />
          <Route path="/data" element={<Page><DataPage /></Page>} />
          <Route path="/brief" element={<Navigate to="/" replace />} />
          <Route path="*" element={<Page><p className="py-6 text-[17px]">This page does not exist. <NavLink className="text-action underline" to="/">Find your community</NavLink></p></Page>} />
        </Routes>}
    </main>
  </div>
}

/** Reading column for non-map screens, with the standing disclaimer. */
function Page({ children }: { children: React.ReactNode }) {
  return <div className="mx-auto max-w-[1080px] px-4 pt-8 pb-12 md:px-8 md:pt-10">
    {children}
    <footer className="mt-16 border-t border-line pt-5 text-[14px] text-mute print:hidden">
      A student prototype for NASA Space Apps 2026. Not an emergency alerting service, and it does not speak for any First Nation. In an emergency, call 911.
    </footer>
  </div>
}
