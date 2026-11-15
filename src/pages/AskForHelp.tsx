// Ask for help, /c/:id/help (docs/design/critique-and-direction.md §3.5 desktop, §3.6 phone).
// Writes a request for firefighting help for one community. Nothing is sent by this site:
// the person copies, emails or prints it, and fills in their own name and role.
// Contacts come only from shared/contacts.ts (official pages, checked 14 November 2026).

import { useEffect, useMemo, useRef, useState, type ReactNode } from 'react'
import { Link, useParams } from 'react-router-dom'
import { Copy, Mail, Phone, Printer } from 'lucide-react'
import { usePlace } from '../place.ts'
import { useApp } from '../state.tsx'
import { LevelTag } from '../components/ui.tsx'
import { contactsFor, letterRecipients, type Agency, type Phone as PhoneNumber, type ProvinceContacts } from '../../shared/contacts.ts'
import { NEEDS, buildLetter, ensureExampleMarks, mailtoHref, type NeedKey } from '../../shared/letter.ts'

const link = 'text-action underline underline-offset-2 hover:text-action-deep'
const sectionHead = 'text-[19px] font-semibold leading-snug'
const field = 'mt-1.5 block w-full rounded-md border border-edge bg-white px-3 py-2.5 text-[17px] text-fg placeholder:text-dim focus:border-fg'
const actionBtn = 'inline-flex min-h-12 items-center justify-center gap-2 rounded-md bg-action px-4 py-2.5 text-[17px] font-semibold text-white hover:bg-action-deep'
/** Phone bar: three buttons across 390 px, so less padding and no icons. */
const barBtn = 'inline-flex min-h-12 items-center justify-center rounded-md bg-action px-2 py-2.5 text-[16px] font-semibold leading-tight text-white text-center hover:bg-action-deep'

/** Copy text, with a fallback for browsers that block the Clipboard API (for example, pages not served over https). */
async function copyText(text: string): Promise<boolean> {
  try {
    if (navigator.clipboard && window.isSecureContext) { await navigator.clipboard.writeText(text); return true }
  } catch { /* fall through */ }
  try {
    const ta = document.createElement('textarea')
    ta.value = text
    ta.setAttribute('readonly', '')
    Object.assign(ta.style, { position: 'fixed', top: '-1000px', opacity: '0' })
    document.body.appendChild(ta)
    ta.select()
    const ok = document.execCommand('copy')
    document.body.removeChild(ta)
    return ok
  } catch { return false }
}

function Tel({ phone }: { phone: PhoneNumber }) {
  return <span className="inline-flex flex-wrap items-baseline gap-x-2">
    <a href={`tel:${phone.tel}`} className={`${link} inline-flex items-center gap-1.5 font-semibold`}><Phone size={20} aria-hidden className="shrink-0 self-center" />{phone.display}</a>
    {phone.note && <span className="text-[15px] text-mute">{phone.note}</span>}
  </span>
}

function Source({ a }: { a: { sourceUrl: string; sourceTitle: string; checked: string } }) {
  return <p className="mt-3 text-[15px] text-mute">From <a href={a.sourceUrl} target="_blank" rel="noreferrer" className={link}>{a.sourceTitle}</a>, checked {a.checked}.</p>
}

/** One organization: name, one-line role, phone and email from the official page, or the official page when they are not confirmed. */
function AgencyCard({ a, role }: { a: Agency; role?: string }) {
  return <li className="rounded-lg border border-line bg-white p-4">
    <p className="text-[17px] font-semibold leading-snug">{a.name}</p>
    <p className="mt-0.5 text-[16px] text-mute">{role ?? a.role}</p>
    <div className="mt-3 space-y-2 text-[17px]">
      {a.phone ? <p><Tel phone={a.phone} /></p> : null}
      {a.email ? <p><a href={`mailto:${a.email}`} className={`${link} inline-flex items-center gap-1.5 break-all`}><Mail size={20} aria-hidden className="shrink-0" />{a.email}</a></p> : null}
      {!a.phone || !a.email
        ? <p className="text-[16px]">{!a.phone && !a.email ? 'Phone and email' : !a.phone ? 'Phone' : 'Email'}: <a href={a.url} target="_blank" rel="noreferrer" className={link}>see the official page</a></p>
        : null}
    </div>
    <Source a={a} />
  </li>
}

/** First thing on the page, before the data loads: 911, evacuation orders, then the province's report line. */
function EmergencyBox({ contacts }: { contacts: ProvinceContacts | null }) {
  const r = contacts?.reportFire
  const who = contacts?.jurisdiction === 'territory' ? 'the territory' : 'the province'
  return <section aria-label="In an emergency" className="mt-6 rounded-lg border-2 border-danger bg-white p-4 text-[18px] md:p-5">
    <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
      <p className="font-semibold text-danger">If there is fire or smoke near you now, call 911. Follow any evacuation order from your leadership or {who}.</p>
      <a href="tel:911" className={`${actionBtn} shrink-0 self-start`}><Phone size={20} aria-hidden />Call 911</a>
    </div>
    {r && <div className="mt-3 border-t border-line pt-3 text-[17px]">
      {r.number
        ? <p>{r.label}: <Tel phone={r.number} />{r.alt?.map((p) => <span key={p.tel}>, or <Tel phone={p} /></span>)}</p>
        : <p>{r.label}: <a href={r.url} target="_blank" rel="noreferrer" className={link}>see the official page</a> for the number.</p>}
      {r.note && <p className="mt-1 text-[16px] text-mute">{r.note}</p>}
      <p className="mt-1 text-[15px] text-mute">From <a href={r.sourceUrl} target="_blank" rel="noreferrer" className={link}>{r.sourceTitle}</a>, checked {r.checked}.</p>
    </div>}
  </section>
}

function Step({ title, children, className = '' }: { title: string; children: ReactNode; className?: string }) {
  return <section className={`mt-10 print:hidden ${className}`}><h2 className={sectionHead}>{title}</h2>{children}</section>
}

export default function AskForHelp() {
  const { id } = useParams()
  const { mode } = useApp()
  const place = usePlace(id)
  const p = place.data
  const contacts = useMemo(() => (p ? contactsFor(p.community.province) : null), [p])
  // Example if the toggle says so OR the data on screen is simulated: while a switch to live data is
  // still loading, the old example report is on screen and must keep its marks and its empty "To".
  const example = mode === 'sim' || place.sources.some((s) => s.kind === 'simulated')
  const letterMode = example ? 'sim' as const : 'live' as const

  const [needs, setNeeds] = useState<NeedKey[]>(() => NEEDS.filter((n) => n.defaultOn).map((n) => n.key))
  const [name, setName] = useState('')
  const [role, setRole] = useState('')
  const [phone, setPhone] = useState('')
  const [edited, setEdited] = useState<string | null>(null)
  const [expanded, setExpanded] = useState(false)
  const [status, setStatus] = useState<{ kind: 'copied' | 'emailed' | 'failed'; at: number } | null>(null)
  const letterRef = useRef<HTMLTextAreaElement>(null)

  // The 42-year NASA record downloads in the background the first time: ask again for a little while.
  const tries = useRef(0)
  useEffect(() => {
    if (p?.historyStatus !== 'loading' || tries.current >= 6) return
    const t = setTimeout(() => { tries.current++; place.reload() }, 5000)
    return () => clearTimeout(t)
  }, [p, place.reload])

  // A letter edited for one community, mode or data set never carries over to another (an edited example must not survive a switch to live data).
  useEffect(() => { setEdited(null) }, [id, example])

  useEffect(() => {
    if (!status) return
    const t = setTimeout(() => setStatus(null), status.kind === 'copied' ? 3000 : 12000)
    return () => clearTimeout(t)
  }, [status])

  const letter = useMemo(() => (p && contacts ? buildLetter({ place: p, needs, name, role, phone, contacts, mode: letterMode }) : null), [p, contacts, needs, name, role, phone, letterMode])
  const draft = edited ?? letter?.body ?? ''
  /** What leaves the page (copy, email, print): an example always carries its marks, even after an edit removed them. */
  const outgoing = example ? ensureExampleMarks(draft) : draft
  const to = contacts && !example ? letterRecipients(contacts) : []
  const mail = letter ? mailtoHref(to, letter.subject, outgoing) : null
  const nation = p?.community.name ?? ''

  const toggle = (k: NeedKey) => setNeeds((cur) => (cur.includes(k) ? cur.filter((x) => x !== k) : [...cur, k]))

  const onCopy = async () => {
    const ok = await copyText(outgoing)
    setStatus({ kind: ok ? 'copied' : 'failed', at: Date.now() })
    if (!ok) { letterRef.current?.focus(); letterRef.current?.select() }
  }
  // The email app opens from the link itself; when the link holds a shorter letter, the full one goes to the clipboard too.
  const onEmail = () => { if (mail?.trimmed) void copyText(outgoing).then((ok) => setStatus({ kind: ok ? 'emailed' : 'failed', at: Date.now() })) }

  const statusText = !status ? '' : status.kind === 'copied' ? 'Copied. You can paste the letter into an email or a document.'
    : status.kind === 'emailed' ? 'Your email app should open. The email link can only hold a shorter letter, so the full letter is copied too: paste it in to replace the text.'
      : 'Your browser did not allow copying. The letter is selected: copy it with your keyboard or the menu.'

  const actions = (compact: boolean) => {
    const cls = compact ? barBtn : actionBtn
    const icon = (I: typeof Copy) => (compact ? null : <I size={20} aria-hidden />)
    return <>
      <button type="button" onClick={onCopy} className={cls} disabled={!letter}>
        {icon(Copy)}{status?.kind === 'copied' ? 'Copied' : 'Copy the letter'}
      </button>
      <a href={mail?.href ?? undefined} onClick={onEmail} className={`${cls} ${mail ? '' : 'pointer-events-none opacity-60'}`} aria-disabled={!mail}>
        {icon(Mail)}{compact ? 'Email' : 'Open in email'}
      </a>
      <button type="button" onClick={() => window.print()} className={cls} disabled={!letter}>
        {icon(Printer)}{compact ? 'Print' : 'Print or save as PDF'}
      </button>
    </>
  }

  if (place.error && !p) {
    return <div className="text-[17px]">
      <h1 className="text-[28px] font-semibold leading-tight">Ask for help before a fire starts</h1>
      <EmergencyBox contacts={null} />
      <p className="mt-6">We could not load this community. {place.error}</p>
      <div className="mt-4 flex flex-wrap gap-4">
        <button type="button" onClick={place.reload} className={actionBtn}>Try again</button>
        <Link to="/" className={`${link} self-center`}>Find your community</Link>
      </div>
    </div>
  }

  return <div className="text-[17px] leading-relaxed">
    <div className="print:hidden">
      {p ? <Link to={`/c/${encodeURIComponent(p.community.id)}`} className={`${link} text-[16px]`}>Back to {nation}</Link> : <div className="skeleton h-5 w-48" />}
      {p ? <p className="mt-5 text-[19px] font-semibold text-mute">{nation}</p> : <div className="skeleton mt-5 h-6 w-64" />}
      <h1 className="mt-1 text-[28px] font-semibold leading-tight">Ask for help before a fire starts</h1>
      <p className="mt-2 max-w-[62ch]">This page writes a request for you. Nothing is sent by this site: you send it yourself.</p>

      <EmergencyBox contacts={contacts} />

      {p && contacts && <p className="mt-5 flex flex-wrap items-center gap-x-2 gap-y-1">
        <span>Fire risk near {nation} today:</span>
        <LevelTag level={p.risk.today.level} />
        <span className="text-[16px] text-mute">Our estimate, not an official fire danger rating.</span>
        <a href={contacts.officialRatingUrl} target="_blank" rel="noreferrer" className={`${link} text-[16px]`}>
          {contacts.wildfireAgency?.officialRatingUrl ? `See the official rating${contacts.provinceName ? ` for ${contacts.provinceName}` : ''}` : 'See official fire danger information'}
        </a>
      </p>}
    </div>

    {!p ? <div className="mt-10 space-y-4 print:hidden" aria-busy="true" aria-label="Loading">
      <div className="skeleton h-6 w-48" /><div className="skeleton h-40 w-full" /><div className="skeleton h-64 w-full" />
    </div> : contacts && letter && <>
      <div className="lg:grid lg:grid-cols-[minmax(0,1fr)_minmax(0,1.2fr)] lg:gap-10">
        <div>
          <Step title="What you need">
            <fieldset className="mt-3">
              <legend className="sr-only">What you need</legend>
              <ul className="space-y-1">
                {NEEDS.map((n) => <li key={n.key}>
                  <label className="flex min-h-11 cursor-pointer items-start gap-3 rounded-md py-1.5">
                    <input type="checkbox" checked={needs.includes(n.key)} onChange={() => toggle(n.key)} className="mt-1 h-5 w-5 shrink-0 accent-[var(--color-action)]" />
                    <span>{n.label}</span>
                  </label>
                </li>)}
              </ul>
            </fieldset>
          </Step>

          <Step title="Who to send it to">
            {contacts.howItWorks && <p className="mt-2 text-[16px] text-mute">{contacts.howItWorks}</p>}
            <ul className="mt-4 space-y-3">
              {contacts.wildfireAgency && <AgencyCard a={contacts.wildfireAgency} />}
              <AgencyCard a={contacts.isc} />
              <li className="rounded-lg border border-line bg-white p-4">
                <p className="text-[17px] font-semibold">Your Chief and Council</p>
                <p className="mt-0.5 text-[16px] text-mute">Send them a copy.</p>
              </li>
            </ul>
            {!contacts.wildfireAgency && <p className="mt-3 text-[16px] text-mute">
              We have not checked the wildfire agency{contacts.provinceName ? ` for ${contacts.provinceName}` : ''} yet, so it is not listed. Your provincial or territorial government’s wildfire page has its contacts.
            </p>}
            {contacts.others.length > 0 && <>
              <h3 className="mt-6 text-[17px] font-semibold">Other organizations that can help</h3>
              <ul className="mt-3 space-y-3">{contacts.others.map((a) => <AgencyCard key={a.name} a={a} />)}</ul>
            </>}
          </Step>
        </div>

        <Step title="Your request">
          <div className="mt-3 grid gap-4 sm:grid-cols-2 lg:grid-cols-1 xl:grid-cols-2">
            <label className="block"><span className="font-semibold">Your name</span>
              <input className={field} value={name} onChange={(e) => setName(e.target.value)} autoComplete="name" /></label>
            <label className="block"><span className="font-semibold">Your role</span>
              <input className={field} value={role} onChange={(e) => setRole(e.target.value)} placeholder="For example, fire chief" autoComplete="organization-title" /></label>
            <label className="block sm:col-span-2 lg:col-span-1 xl:col-span-2"><span className="font-semibold">Your phone number</span>
              <input className={field} type="tel" value={phone} onChange={(e) => setPhone(e.target.value)} autoComplete="tel" /></label>
          </div>
          <p className="mt-2 text-[15px] text-mute">Leave a box empty and the letter keeps a blank, like [your name], for you to fill in later.</p>

          {example && <p className="mt-5 border-l-4 border-fg bg-example px-4 py-3 text-[16px]">
            <span className="font-semibold">This is an example letter, made from example data.</span> It says “EXAMPLE ONLY” at the top and the bottom, and the email has no address, so it cannot be mistaken for a real request.
          </p>}

          <dl className="mt-5 space-y-1 text-[16px]">
            <div className="flex gap-2"><dt className="shrink-0 font-semibold">To:</dt>
              <dd className="min-w-0 break-all">{to.length ? to.join(', ') : example ? 'left empty for the example' : 'add the address from the cards above'}</dd></div>
            <div className="flex gap-2"><dt className="shrink-0 font-semibold">Subject:</dt><dd className="min-w-0">{letter.subject}</dd></div>
          </dl>

          {/* Desktop: the actions sit next to the letter, above the fold. Below lg, the sticky bar carries them. */}
          <div className="mt-4 hidden flex-wrap gap-3 lg:flex">{actions(false)}</div>
          {/* The confirmation sits right under the buttons that cause it. */}
          <p aria-live="polite" className="mt-3 min-h-6 text-[16px]">{statusText}</p>
          {mail?.trimmed && <p className="text-[15px] text-mute">The letter is long for an email link, so “Open in email” puts in a shorter version and copies the full letter for you to paste.</p>}

          <label htmlFor="letter" className="mt-4 block font-semibold">The letter <span className="font-normal text-mute">(you can change any of it)</span></label>
          <textarea id="letter" ref={letterRef} value={draft} onChange={(e) => setEdited(e.target.value)} spellCheck
            className={`mt-1.5 block w-full resize-y rounded-md border border-edge bg-white p-4 text-[17px] leading-relaxed text-fg focus:border-fg lg:h-[28rem] ${expanded ? 'h-[46rem]' : 'h-[14rem]'}`} />
          <button type="button" onClick={() => setExpanded((e) => !e)} className={`${link} mt-2 text-[16px] lg:hidden`}>{expanded ? 'Show less of the letter' : 'Show the whole letter'}</button>
          {edited != null && edited !== letter.body && <p className="mt-3 text-[16px] text-mute">
            You changed the letter yourself, so new choices above are not added to it.{' '}
            <button type="button" onClick={() => setEdited(null)} className={link}>Write it again from my choices</button>
          </p>}
        </Step>
      </div>

      {/* Phone: the three actions stay in reach at the bottom of the screen (§3.6). */}
      <div className="sticky bottom-0 z-10 -mx-4 mt-8 md:-mx-8 md:px-8 grid grid-cols-[1.6fr_1fr_1fr] gap-2 border-t border-line bg-white px-4 py-3 lg:hidden print:hidden">{actions(true)}</div>

      {/* Print: the letter alone, cleanly. The textarea would print clipped. */}
      <div className="hidden whitespace-pre-wrap font-sans text-[12pt] leading-normal text-black print:block">{outgoing}</div>
    </>}
  </div>
}
