// STUB (to be built): the built-in assistant. POST /api/assistant
// Body: { messages: { role: 'user' | 'assistant'; content: string }[]; communityId?: string; mode; days }
// Answers come from the same data as the community page (placeReport) plus the verified contacts.
import type { Mode } from '../shared/types.ts'

export interface AssistantRequest { messages: { role: 'user' | 'assistant'; content: string }[]; communityId?: string | null; mode: Mode; days: number }
export interface AssistantReply { text: string; from: string; actions: { label: string; to: string }[]; engine: 'built-in' | 'claude' }

export async function assistantReply(_req: AssistantRequest): Promise<AssistantReply> {
  return { text: 'The assistant is being built.', from: '', actions: [], engine: 'built-in' }
}
