// Who to contact for wildfire help, by province or territory.
//
// Every phone number, email and link here was read on the official page named in its
// `sourceUrl` on 14 November 2026 (docs/research/contacts.md). Where the research could not
// confirm a number or email on an official page, the field is null and the UI shows
// "See the official page" with the link instead. Do not add a contact without a fetched
// official source. Pages titles were not recorded, so `sourceTitle` names the publisher
// and the page in plain words.

import { PROVINCE_NAMES, type ProvinceCode } from './province.ts'

/** The date every contact below was checked on its official page. */
export const CHECKED = '14 November 2026'

export interface Phone {
  /** As printed on the official page, e.g. "310-FIRE (3473)" */
  display: string
  /** Digits for a tel: link, e.g. "3103473" or "+18007820076" */
  tel: string
  /** What the number is for, when the page says so, e.g. "General inquiries" */
  note?: string
}

export interface Sourced {
  /** The official page the contact was read on */
  sourceUrl: string
  /** Publisher and page, in plain words (exact page titles were not recorded) */
  sourceTitle: string
  /** Always CHECKED */
  checked: string
}

export interface ReportFire extends Sourced {
  /** e.g. "Report a wildfire in Ontario" */
  label: string
  /** null when no number was confirmed on an official page */
  number: Phone | null
  /** Extra phone ways the page lists, e.g. "*5555 from a cell phone" */
  alt?: Phone[]
  /** One plain sentence of conditions, e.g. Ontario's French and Mattawa rivers line */
  note?: string
  url: string
}

export interface Agency extends Sourced {
  name: string
  role: string
  phone: Phone | null
  email: string | null
  url: string
}

export interface WildfireAgency extends Agency {
  role: 'Firefighters and equipment'
  /** The agency's own fire danger page or map, when its page was fetched; null otherwise */
  officialRatingUrl: string | null
}

export interface IscOffice extends Agency {
  role: 'Emergency support and funding (EMAP)'
}

export interface ProvinceContacts {
  /** The code asked for (upper case), or '' when it was unknown */
  province: string
  /** "Ontario"; '' when the province is unknown */
  provinceName: string
  /** 'province' or 'territory', for "Follow any evacuation order from your leadership or the province." */
  jurisdiction: 'province' | 'territory'
  /** null for provinces and territories the research did not cover (federal-only fallback) */
  reportFire: ReportFire | null
  wildfireAgency: WildfireAgency | null
  isc: IscOffice
  /** Other verified organizations that can help (not added to the email "To" line) */
  others: Agency[]
  /** Official fire danger: the agency's page when known, else the national NRCan fire weather page */
  officialRatingUrl: string
  /** One or two plain sentences on who fights wildfire on reserve here, from the ISC regional plan */
  howItWorks: string | null
}

const at = (sourceUrl: string, sourceTitle: string): Sourced => ({ sourceUrl, sourceTitle, checked: CHECKED })

const EMAP_URL = 'https://www.sac-isc.gc.ca/eng/1534954090122/1535120506707'
const EMAP = at(EMAP_URL, 'Indigenous Services Canada, Emergency Management Assistance Program page')

/** National fallback for the official rating: NRCan explains the Fire Weather Index and links the national maps. */
export const NATIONAL_RATING_URL = 'https://natural-resources.canada.ca/forest-forestry/wildland-fires/fire-weather'

function isc(region: string, phone: Phone | null, email: string | null): IscOffice {
  return { name: `Indigenous Services Canada, ${region} region`, role: 'Emergency support and funding (EMAP)', phone, email, url: EMAP_URL, ...EMAP }
}

const NIFSC: Agency = {
  name: 'National Indigenous Fire Safety Council',
  role: 'Indigenous-led fire safety, emergency management and wildfire training',
  phone: { display: '1-888-444-6811', tel: '+18884446811', note: 'Toll-free' },
  email: null,
  url: 'https://www.indigenousfiresafety.ca/',
  ...at('https://www.indigenousfiresafety.ca/', 'National Indigenous Fire Safety Council home page'),
}

type Known = 'ON' | 'MB' | 'SK' | 'AB' | 'BC' | 'QC' | 'NT'

const KNOWN: Record<Known, Omit<ProvinceContacts, 'province' | 'provinceName' | 'officialRatingUrl'>> = {
  ON: {
    jurisdiction: 'province',
    reportFire: {
      label: 'Report a wildfire in Ontario',
      number: { display: '310-FIRE (3473)', tel: '3103473' },
      note: 'This number is for fires north of the French and Mattawa rivers. South of those rivers, call 911.',
      url: 'https://www.ontario.ca/page/forest-fires',
      ...at('https://www.ontario.ca/page/forest-fires', 'Government of Ontario, Forest fires page'),
    },
    wildfireAgency: {
      name: 'Aviation, Forest Fire and Emergency Services (AFFES), Ontario Ministry of Natural Resources',
      role: 'Firefighters and equipment',
      phone: null, email: null,
      url: 'https://www.ontario.ca/page/forest-fires',
      officialRatingUrl: 'https://www.lioapplications.lrc.gov.on.ca/ForestFireInformationMap/index.html?viewer=FFIM.FFIM',
      ...at('https://www.ontario.ca/page/forest-fires', 'Government of Ontario, Forest fires page'),
    },
    isc: isc('Ontario', null, 'emergencyon-urgenceon@sac-isc.gc.ca'),
    others: [NIFSC],
    howItWorks: 'In Ontario, the province’s forest fire service (AFFES) fights wildfires on reserve, under an agreement with Indigenous Services Canada. Chief and Council start a request for help or an emergency declaration.',
  },
  MB: {
    jurisdiction: 'province',
    reportFire: {
      label: 'Report a wildfire in Manitoba',
      number: { display: '1-800-782-0076', tel: '+18007820076', note: 'Toll-free, for reporting a fire only' },
      note: 'You can also call 911.',
      url: 'https://www.gov.mb.ca/wildfire/contact.html',
      ...at('https://www.gov.mb.ca/wildfire/contact.html', 'Manitoba Wildfire Service, Contact page'),
    },
    wildfireAgency: {
      name: 'Manitoba Wildfire Service',
      role: 'Firefighters and equipment',
      phone: null, email: null,
      url: 'https://www.gov.mb.ca/wildfire/contact.html',
      // The fire hazard map links were read on this page but not opened, so link the page itself.
      officialRatingUrl: 'https://www.gov.mb.ca/wildfire/reports_updates.html',
      ...at('https://www.gov.mb.ca/wildfire/contact.html', 'Manitoba Wildfire Service, Contact page'),
    },
    isc: isc('Manitoba', null, 'Mb.emergency@sac-isc.gc.ca'),
    others: [NIFSC],
    howItWorks: 'In Manitoba, the Manitoba Wildfire Service fights wildfires on reserve, under an agreement with Indigenous Services Canada. Leadership starts support by contacting the ISC Duty Officer.',
  },
  SK: {
    jurisdiction: 'province',
    reportFire: {
      label: 'Report a wildfire in Saskatchewan',
      // 1-800-667-9660 is on the SPSA home page as its general number; the page does not say it is the fire report line.
      number: null,
      url: 'https://www.saskpublicsafety.ca/',
      ...at('https://www.saskpublicsafety.ca/', 'Saskatchewan Public Safety Agency home page'),
    },
    wildfireAgency: {
      name: 'Saskatchewan Public Safety Agency (SPSA)',
      role: 'Firefighters and equipment',
      phone: { display: '1-800-667-9660', tel: '+18006679660', note: 'General inquiries' },
      email: null,
      url: 'https://www.saskpublicsafety.ca/',
      officialRatingUrl: 'https://www.saskpublicsafety.ca/active-incidents/maps',
      ...at('https://www.saskpublicsafety.ca/', 'Saskatchewan Public Safety Agency home page'),
    },
    isc: isc('Saskatchewan', null, 'skemergency@sac-isc.gc.ca'),
    others: [NIFSC],
    howItWorks: 'In Saskatchewan, the Saskatchewan Public Safety Agency fights wildfires on reserve, under an agreement with Canada. In fire season, First Nations can ask its Emergency Operations Centre for resources.',
  },
  AB: {
    jurisdiction: 'province',
    reportFire: {
      label: 'Report a wildfire in Alberta',
      number: { display: '310-FIRE (3473)', tel: '3103473', note: 'Toll-free, 24 hours a day' },
      note: 'This number is for fires in forested areas.',
      url: 'https://www.alberta.ca/report-a-wildfire',
      ...at('https://www.alberta.ca/report-a-wildfire', 'Government of Alberta, Report a wildfire page'),
    },
    wildfireAgency: {
      name: 'Alberta Wildfire (Forestry and Parks)',
      role: 'Firefighters and equipment',
      phone: null, email: null,
      url: 'https://www.alberta.ca/wildfire-status',
      officialRatingUrl: 'https://www.alberta.ca/fire-danger',
      ...at('https://www.alberta.ca/report-a-wildfire', 'Government of Alberta, Report a wildfire page'),
    },
    isc: isc('Alberta', { display: '780-495-7707', tel: '+17804957707' }, 'ab.emergency@sac-isc.gc.ca'),
    others: [NIFSC],
    howItWorks: 'In Alberta, Alberta Wildfire fights wildfires on reserve inside the Forest Protection Area, under an agreement with Indigenous Services Canada. Nations can tell the Alberta Emergency Management Agency or ISC Alberta Region directly.',
  },
  BC: {
    jurisdiction: 'province',
    reportFire: {
      label: 'Report a wildfire in British Columbia',
      number: { display: '1-800-663-5555', tel: '+18006635555' },
      alt: [{ display: '*5555 from a cell phone', tel: '*5555' }],
      url: 'https://www2.gov.bc.ca/gov/content?id=F4EA16310CC541899EFC156A60D74FC9',
      ...at('https://www2.gov.bc.ca/gov/content?id=F4EA16310CC541899EFC156A60D74FC9', 'Government of British Columbia, BC Wildfire Service page'),
    },
    wildfireAgency: {
      name: 'BC Wildfire Service',
      role: 'Firefighters and equipment',
      phone: null, email: null,
      url: 'https://www2.gov.bc.ca/gov/content?id=F4EA16310CC541899EFC156A60D74FC9',
      officialRatingUrl: 'https://www2.gov.bc.ca/gov/content/safety/wildfire-status/wildfire-situation/fire-danger',
      ...at('https://www2.gov.bc.ca/gov/content?id=F4EA16310CC541899EFC156A60D74FC9', 'Government of British Columbia, BC Wildfire Service page'),
    },
    isc: isc('British Columbia', { display: '604-209-9709', tel: '+16042099709' }, 'bcaandc.do@sac-isc.gc.ca'),
    others: [
      {
        name: 'First Nations’ Emergency Services Society of BC (FNESS)',
        role: 'Emergency and fire support for BC First Nations, and FireSmart funding',
        phone: { display: '1-888-388-4431', tel: '+18883884431', note: 'BC toll-free' },
        email: 'info@fness.bc.ca',
        url: 'https://www.fness.bc.ca/',
        ...at('https://www.fness.bc.ca/', 'FNESS home page'),
      },
      NIFSC,
    ],
    howItWorks: 'In British Columbia, the BC Wildfire Service fights wildfires on reserve, under an agreement with Indigenous Services Canada. If a community’s plan is overwhelmed, the First Nation can ask BC Emergency Management and Climate Readiness for help.',
  },
  QC: {
    jurisdiction: 'province',
    reportFire: {
      label: 'Report a forest fire in Quebec (SOPFEU)',
      number: { display: '1-800-463-FEUX (3389)', tel: '+18004633389' },
      note: 'You can also call 911, your local fire department or the Sûreté du Québec.',
      url: 'https://sopfeu.qc.ca/en/contact/',
      ...at('https://sopfeu.qc.ca/en/contact/', 'SOPFEU, Contact page'),
    },
    wildfireAgency: {
      name: 'SOPFEU (Société de protection des forêts contre le feu)',
      role: 'Firefighters and equipment',
      phone: { display: '418 871-3341', tel: '+14188713341', note: 'Head office' },
      email: null,
      url: 'https://sopfeu.qc.ca/en/contact/',
      officialRatingUrl: 'https://sopfeu.qc.ca/en/prevention/fire-danger-index/',
      ...at('https://sopfeu.qc.ca/en/contact/', 'SOPFEU, Contact page'),
    },
    isc: isc('Quebec', { display: '418-951-2283', tel: '+14189512283' }, 'qbpagu-emapfinancement-funding@sac-isc.gc.ca'),
    others: [NIFSC],
    howItWorks: 'In Quebec, SOPFEU watches for and fights forest fires on reserve, under an agreement with Indigenous Services Canada. The community’s emergency committee leads, with ISC Quebec Region.',
  },
  NT: {
    jurisdiction: 'territory',
    reportFire: {
      label: 'Report a wildfire in the Northwest Territories',
      number: { display: '1-877-NWT-FIRE (698-3473)', tel: '+18776983473' },
      url: 'https://www.gov.nt.ca/ecc/en/services/wildfire-operations',
      ...at('https://www.gov.nt.ca/ecc/en/services/wildfire-operations', 'Government of the Northwest Territories, Wildfire operations page'),
    },
    wildfireAgency: {
      name: 'Environment and Climate Change, Government of the Northwest Territories (Fire Operations)',
      role: 'Firefighters and equipment',
      phone: null, email: null,
      url: 'https://www.gov.nt.ca/ecc/en/services/wildfire-operations',
      officialRatingUrl: null, // the NWT fire danger page could not be opened
      ...at('https://www.gov.nt.ca/ecc/en/services/wildfire-operations', 'Government of the Northwest Territories, Wildfire operations page'),
    },
    isc: isc('Northwest Territories', { display: '867-669-2500', tel: '+18676692500' }, null),
    others: [NIFSC],
    howItWorks: 'In the Northwest Territories, the territorial government runs wildfire operations. When local capacity is exceeded, territorial coordination helps once assistance is requested.',
  },
}

/** ISC regional offices outside the provinces above, as published on the EMAP page. */
const FALLBACK_ISC: Partial<Record<ProvinceCode, IscOffice>> = {
  YT: isc('Yukon', { display: '1-800-661-0451', tel: '+18006610451' }, 'yukon@rcaanc-cirnac.gc.ca'),
  NB: isc('Atlantic', { display: '1-902-661-6209', tel: '+19026616209' }, 'at-emappagu-at@sac-isc.gc.ca'),
  NS: isc('Atlantic', { display: '1-902-661-6209', tel: '+19026616209' }, 'at-emappagu-at@sac-isc.gc.ca'),
  PE: isc('Atlantic', { display: '1-902-661-6209', tel: '+19026616209' }, 'at-emappagu-at@sac-isc.gc.ca'),
  NL: isc('Atlantic', { display: '1-902-661-6209', tel: '+19026616209' }, 'at-emappagu-at@sac-isc.gc.ca'),
}

/** Contacts for a province or territory code ("ON", "bc"...). Unknown or uncovered codes get the federal-only fallback. */
export function contactsFor(province: string | null | undefined): ProvinceContacts {
  const code = (province ?? '').trim().toUpperCase()
  const provinceName = PROVINCE_NAMES[code as ProvinceCode] ?? ''
  const known = KNOWN[code as Known]
  if (known) {
    return { province: code, provinceName, ...known, officialRatingUrl: known.wildfireAgency?.officialRatingUrl ?? NATIONAL_RATING_URL }
  }
  return {
    province: code, provinceName,
    jurisdiction: code === 'YT' || code === 'NT' || code === 'NU' ? 'territory' : 'province',
    reportFire: null,
    wildfireAgency: null,
    isc: FALLBACK_ISC[code as ProvinceCode] ?? { name: 'Indigenous Services Canada, your regional office', role: 'Emergency support and funding (EMAP)', phone: null, email: null, url: EMAP_URL, ...EMAP },
    others: [NIFSC],
    officialRatingUrl: NATIONAL_RATING_URL,
    howItWorks: null,
  }
}

/** Email addresses for the "To" line: the agencies the letter is addressed to (wildfire agency and ISC), verified emails only. */
export function letterRecipients(c: ProvinceContacts): string[] {
  return [c.wildfireAgency?.email, c.isc.email].filter((e): e is string => !!e)
}
