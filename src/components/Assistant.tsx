// CONTRACT (used by the community view and /c/:id/ask): keep these props stable.
//   <Assistant communityId="whitesand" variant="column" />  docked right column on desktop (§3.7)
//   <Assistant communityId="whitesand" variant="page" />    full page on phones (§3.8)
// communityId null = no community chosen yet (answers about the site in general).
// STUB: the assistant agent replaces the body.
export default function Assistant({ communityId, variant = 'column' }: { communityId: string | null; variant?: 'column' | 'page' }) {
  return <section aria-label="Ask a question" className={variant === 'page' ? 'p-4' : 'p-4'}>Ask a question{communityId ? ` about ${communityId}` : ''}</section>
}
