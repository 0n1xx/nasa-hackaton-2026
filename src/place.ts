import type { PlaceReport } from '../shared/types.ts'
import { useApi } from './api.ts'

/**
 * Everything the community view, the assistant and the help request need for one community,
 * computed at the community's own location (GET /api/place/:id). One number per place: every
 * screen that shows a community's risk reads it from here, never from a region or a map cell.
 * Follows the current data mode and look-ahead automatically.
 */
export function usePlace(communityId: string | null | undefined) {
  return useApi<PlaceReport>(communityId ? `place/${encodeURIComponent(communityId)}` : null)
}

/** Community search (GET /api/communities/search?q=), up to 10 matches. */
export interface CommunityHit { id: string; name: string; kind: string; province: string; regionId: string | null; source?: string }
