import type { RiskLevel } from '../shared/types.ts'

// Preparedness guidance keyed to the risk level. General-purpose prompts for
// discussion, to be adapted by each community and agency — not instructions.
export const ACTIONS: Record<RiskLevel, { community: string[]; agency: string[] }> = {
  Low: {
    community: ['Review and update the community emergency plan while conditions are calm.', 'Test communication channels: radio, phone trees, social media, door-to-door lists.', 'Plan fuel reduction and cultural or prescribed burning with knowledge keepers and fire crews.'],
    agency: ['Fund and schedule fuel management and Indigenous-led fire stewardship work.', 'Service equipment, sprinkler kits and air monitoring sensors.', 'Agree host-community arrangements with First Nations before the season starts.'],
  },
  Moderate: {
    community: ['Check conditions daily; note wind direction and new detections nearby.', 'Confirm who needs extra support: Elders, infants, people with heart or lung conditions.', 'Check clean-air spaces, filters and pump and hose equipment.'],
    agency: ['Increase monitoring frequency for this region.', 'Confirm crew, aircraft and equipment availability; share the status with local leadership.', 'Open a direct line with community emergency coordinators.'],
  },
  High: {
    community: ['Hold a readiness check with leadership and the local fire crew.', 'Set up community structure protection where equipment exists (sprinklers, cleared perimeters).', 'Open clean-air shelters if smoke is rising; share air quality updates in the community’s languages.', 'Decide, as a community, the conditions under which vulnerable members would leave first.'],
    agency: ['Pre-position crews, pumps, sprinkler kits and aircraft near the region before ignitions occur.', 'Brief Indigenous leadership daily and act on local observations.', 'Deliver air purifiers, N95 masks and fuel for generators ahead of need.', 'Confirm transport, host capacity and culturally appropriate supports in case they are requested.'],
  },
  Critical: {
    community: ['Activate the community emergency plan at the level leadership chooses.', 'Keep one trusted, frequent information channel running; counter rumours quickly.', 'Protect people most affected by smoke first: clean-air rooms, masks, medical support.', 'Record what is happening on the land; local knowledge guides responders.'],
    agency: ['Treat requests from community leadership as priority tasking and respond with clear timelines.', 'Commit suppression and structure-protection resources to values the community identifies, including cultural sites they choose to share.', 'If a community decides to evacuate, keep families together and send health, language and cultural supports with them.', 'Report back openly on what was done and what was not.'],
  },
}

export const DISCLAIMER = 'The risk index is an unvalidated prototype. Use official fire danger ratings and local knowledge for real decisions.'
