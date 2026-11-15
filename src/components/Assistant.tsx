// CONTRACT (used by the community view and /c/:id/ask): keep these props stable.
//   <Assistant communityId="whitesand" variant="column" />  docked right column on desktop (§3.7)
//   <Assistant communityId="whitesand" variant="page" />    full page on phones (§3.8)
// communityId null = no community chosen yet (answers about the site in general).
//
// Built into the page, not a chat bubble: suggested questions as plain full-width buttons, then a thread
// of "You asked" + the answer, its "From…" line and links back into the page. Answers appear at once:
// the five suggested questions (and every other question with a built-in rule) are answered here from
// the same shared engine and the same place data the page shows. Free-form questions go to
// POST /api/assistant, which may use Claude when the server has a key; any failure answers locally.
import { useEffect, useRef, useState, type FormEvent } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { SUGGESTED_QUESTIONS, answer, classifyIntent, type AssistantAction } from '../../shared/assistant.ts'
import { usePlace } from '../place.ts'
import { useApp } from '../state.tsx'

interface Reply { text: string; from: string; actions: AssistantAction[]; engine: 'built-in' | 'claude' }
interface Turn { id: number; question: string; reply: Reply | null }

const reducedMotion = () => typeof window !== 'undefined' && window.matchMedia?.('(prefers-reduced-motion: reduce)').matches

/** Scroll a part of the community page into view and flash its outline. */
function showSection(el: HTMLElement) {
  el.scrollIntoView({ block: 'start', behavior: reducedMotion() ? 'auto' : 'smooth' })
  const prev = el.style.outline
  el.style.outline = '3px solid var(--color-action)'
  el.style.outlineOffset = '4px'
  window.setTimeout(() => { el.style.outline = prev; el.style.outlineOffset = '' }, 1600)
}

export default function Assistant({ communityId, variant = 'column' }: { communityId: string | null; variant?: 'column' | 'page' }) {
  const { mode, horizon } = useApp()
  const place = usePlace(communityId)
  const report = place.data
  const name = report?.community.name ?? null
  const [turns, setTurns] = useState<Turn[]>([])
  const [draft, setDraft] = useState('')
  const nextId = useRef(1)
  const scroller = useRef<HTMLDivElement>(null)
  const navigate = useNavigate()
  const isPage = variant === 'page'

  // A new community or data mode starts a new conversation.
  useEffect(() => { setTurns([]) }, [communityId, mode])

  // Bring the newest question to the top of the view.
  const lastId = turns.at(-1)?.id
  useEffect(() => {
    if (lastId == null) return
    const el = document.getElementById(`assistant-turn-${lastId}`)
    if (!el) return
    if (!isPage && scroller.current) scroller.current.scrollTop = el.offsetTop - scroller.current.offsetTop - 8
    else el.scrollIntoView({ block: 'start', behavior: reducedMotion() ? 'auto' : 'smooth' })
  }, [lastId, isPage])

  const setReply = (id: number, reply: Reply) => setTurns((ts) => ts.map((t) => (t.id === id ? { ...t, reply } : t)))

  function ask(raw: string) {
    const question = raw.trim().slice(0, 300)
    if (!question) return
    const id = nextId.current++
    const intent = classifyIntent(question)
    const local = (): Reply => ({ ...answer(intent, { report, mode, question }), engine: 'built-in' })
    // Instant: a built-in rule and the page's data are already here (or no community is chosen).
    const instant = intent !== 'unknown' && (!communityId || report != null)
    setTurns((ts) => [...ts, { id, question, reply: instant ? local() : null }])
    setDraft('')
    if (instant) return

    const history = turns.flatMap((t) => (t.reply ? [{ role: 'user' as const, content: t.question }, { role: 'assistant' as const, content: t.reply.text }] : [])).slice(-6)
    fetch(`/api/assistant?mode=${mode}&days=${horizon}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ messages: [...history, { role: 'user', content: question }], communityId }),
    })
      .then(async (res) => {
        const body = await res.json().catch(() => null)
        const d = body?.data as Reply | undefined
        if (!res.ok || !d || typeof d.text !== 'string') throw new Error('no answer')
        setReply(id, { text: d.text, from: d.from ?? '', actions: Array.isArray(d.actions) ? d.actions : [], engine: d.engine === 'claude' ? 'claude' : 'built-in' })
      })
      .catch(() => setReply(id, local()))
  }

  function onSubmit(e: FormEvent) { e.preventDefault(); ask(draft) }

  /** '#id': scroll to that part of the page (or open the community page there). */
  function goTo(hash: string) {
    const el = document.getElementById(hash.slice(1))
    if (el) showSection(el)
    else if (communityId) {
      // From /c/:id/ask (phones): open the community page, then scroll once that part has rendered.
      // The timer outlives this component, which unmounts on the way. It starts after App's scroll-to-top.
      navigate(`/c/${encodeURIComponent(communityId)}${hash}`)
      const id = hash.slice(1)
      const until = Date.now() + 8000
      const look = () => {
        const target = document.getElementById(id)
        if (target) showSection(target)
        else if (Date.now() < until) window.setTimeout(look, 150)
      }
      window.setTimeout(look, 150)
    }
  }

  const asked = new Set(turns.map((t) => t.question))
  const remaining = SUGGESTED_QUESTIONS.filter((q) => !asked.has(q))
  const actionCls = 'inline-flex min-h-11 items-center rounded border border-edge bg-ink-950 px-3 py-2 text-left text-[15px] font-semibold text-action hover:bg-ink-800 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-action'

  function ActionLink({ a }: { a: AssistantAction }) {
    if (a.to.startsWith('ask:')) return <button type="button" className={actionCls} onClick={() => ask(a.to.slice(4))}>{a.label}</button>
    if (a.to.startsWith('#')) return <button type="button" className={actionCls} onClick={() => goTo(a.to)}>{a.label}</button>
    if (a.to.startsWith('/')) return <Link className={actionCls} to={a.to}>{a.label}</Link>
    const external = a.to.startsWith('http')
    return <a className={actionCls} href={a.to} {...(external ? { target: '_blank', rel: 'noopener noreferrer' } : {})}>{a.label}</a>
  }

  const questionButtons = (qs: string[]) => (
    <ul className="space-y-2">
      {qs.map((q) => (
        <li key={q}>
          <button type="button" onClick={() => ask(q)}
            className="min-h-12 w-full rounded border border-edge bg-ink-950 px-4 py-3 text-left text-[16px] leading-snug text-fg hover:bg-ink-800 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-action">
            {q}
          </button>
        </li>
      ))}
    </ul>
  )

  const about = communityId ? (name ? `About ${name}` : place.loading ? 'Loading this community…' : 'About this community') : 'About fire risk, smoke and who to contact'

  const header = (
    <header className={isPage ? 'px-4 pb-4 pt-5' : 'border-b border-line pb-3 pl-4 pr-14 pt-4'}>
      {isPage ? <h1 className="text-[22px] font-semibold leading-tight text-fg">Ask a question</h1> : <h2 className="text-[19px] font-semibold leading-tight text-fg">Ask a question</h2>}
      <p className="mt-1 text-[15px] text-mute">{about}</p>
    </header>
  )

  const thread = (
    <div className="space-y-6">
      {turns.length === 0 && questionButtons(SUGGESTED_QUESTIONS)}
      {turns.map((t) => (
        <article key={t.id} id={`assistant-turn-${t.id}`} className="scroll-mt-4" aria-live="polite">
          <p className="text-[15px] text-mute">You asked</p>
          <p className="mt-0.5 text-[17px] font-semibold leading-snug text-fg">{t.question}</p>
          {t.reply ? (
            <div className="mt-3">
              <p className="text-[17px] leading-[1.5] text-fg">{t.reply.text}</p>
              {t.reply.from && <p className="mt-2 text-[14px] leading-snug text-mute">{t.reply.from}</p>}
              {t.reply.engine === 'claude' && <p className="mt-1 text-[14px] leading-snug text-mute">Written with Claude from this page’s data.</p>}
              {t.reply.actions.length > 0 && (
                <div className="mt-3 flex flex-wrap gap-2">
                  {t.reply.actions.map((a) => <ActionLink key={a.label + a.to} a={a} />)}
                </div>
              )}
            </div>
          ) : (
            <p className="mt-3 text-[15px] text-mute">Looking at this page’s data.</p>
          )}
        </article>
      ))}
      {turns.length > 0 && remaining.length > 0 && (
        <section aria-label="More questions" className="border-t border-line pt-4">
          <h3 className="mb-2 text-[15px] font-semibold text-fg">More questions</h3>
          {questionButtons(remaining)}
        </section>
      )}
    </div>
  )

  const form = (
    <form onSubmit={onSubmit} className="flex gap-2">
      <label htmlFor={`assistant-input-${variant}`} className="sr-only">Type a question</label>
      <input id={`assistant-input-${variant}`} type="text" value={draft} onChange={(e) => setDraft(e.target.value)} maxLength={300}
        placeholder="Type a question" autoComplete="off" enterKeyHint="send"
        className="min-h-12 min-w-0 flex-1 rounded border border-edge bg-ink-950 px-3 text-[16px] text-fg placeholder:text-dim focus-visible:outline-2 focus-visible:outline-offset-1 focus-visible:outline-action" />
      <button type="submit" disabled={!draft.trim()}
        className="min-h-12 rounded bg-action px-5 text-[16px] font-semibold text-white hover:bg-action-deep disabled:opacity-60 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-action">
        Ask
      </button>
    </form>
  )

  const footerLine = <p className="mt-2 text-[14px] text-mute">Answers use the same data as this page.</p>

  if (isPage) {
    return (
      <section aria-label="Ask a question" className="flex min-h-full flex-col bg-ground">
        {header}
        <div className="flex-1 px-4 pb-6">{thread}</div>
        <div className="sticky bottom-0 border-t border-line bg-ink-950 px-4 pb-[max(12px,env(safe-area-inset-bottom))] pt-3">
          {form}
          {footerLine}
        </div>
      </section>
    )
  }

  return (
    <section aria-label="Ask a question" className="flex h-full min-h-0 flex-col bg-ink-950">
      {header}
      <div ref={scroller} className="quiet-scroll relative min-h-0 flex-1 overflow-y-auto px-4 py-4">{thread}</div>
      <div className="border-t border-line px-4 pb-3 pt-3">
        {form}
        {footerLine}
      </div>
    </section>
  )
}
