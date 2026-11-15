import type { HistoryData } from '../../shared/types.ts'

// National wildfire statistics.
// `verified: true` rows were checked against a published figure while building this
// prototype (see docs/API_REQUIREMENTS.md, "Reference statistics"). Other rows are
// rounded values recalled from CIFFC/NRCan annual summaries and MUST be checked
// against the National Forestry Database before being quoted anywhere.
export const HISTORY: HistoryData = {
  years: [
    { year: 2015, fires: 7068, areaMha: 3.9, verified: true },
    { year: 2016, fires: 5203, areaMha: 1.4, verified: false },
    { year: 2017, fires: 5611, areaMha: 3.4, verified: false },
    { year: 2018, fires: 7067, areaMha: 2.3, verified: false },
    { year: 2019, fires: 4062, areaMha: 1.8, verified: false },
    { year: 2020, fires: 4001, areaMha: 0.2, verified: false },
    { year: 2021, fires: 6709, areaMha: 4.1, verified: false },
    { year: 2022, fires: 5449, areaMha: 1.6, verified: false },
    { year: 2023, fires: 6623, areaMha: 17.2, verified: true },
    { year: 2024, fires: 5686, areaMha: 5.3, verified: true },
    { year: 2025, fires: 6125, areaMha: 8.9, verified: true },
  ],
  // ILLUSTRATIVE shape of the national fire season (share of annual area burned by
  // month). Simulated for the prototype; replace with NFDB monthly statistics.
  seasonal: [
    { month: 'Apr', share: 2 }, { month: 'May', share: 14 }, { month: 'Jun', share: 26 },
    { month: 'Jul', share: 30 }, { month: 'Aug', share: 20 }, { month: 'Sep', share: 7 }, { month: 'Oct', share: 1 },
  ],
  // Well-known large fires, for map context. Locations and sizes are approximate.
  historicFires: [
    { id: 'h-slave-lake', name: 'Slave Lake', year: 2011, lat: 55.28, lon: -114.77, hectares: 22000, note: 'Burned a third of the town of Slave Lake, Alberta.' },
    { id: 'h-horse-river', name: 'Horse River (Fort McMurray)', year: 2016, lat: 56.65, lon: -111.5, hectares: 590000, note: 'About 88,000 people evacuated.' },
    { id: 'h-elephant-hill', name: 'Elephant Hill', year: 2017, lat: 51.0, lon: -121.2, hectares: 192000, note: 'BC Interior; led to Secwépemc-led recovery work.' },
    { id: 'h-chuckegg', name: 'Chuckegg Creek', year: 2019, lat: 58.3, lon: -117.4, hectares: 350000, note: 'Northern Alberta; reached Paddle Prairie Métis Settlement.' },
    { id: 'h-lytton', name: 'Lytton Creek', year: 2021, lat: 50.23, lon: -121.58, hectares: 84000, note: 'Destroyed most of the village of Lytton and homes of Lytton First Nation.' },
    { id: 'h-kenora-51', name: 'Kenora 51', year: 2021, lat: 50.55, lon: -94.75, hectares: 200000, note: 'Among the largest fires in Ontario records.' },
    { id: 'h-donnie-creek', name: 'Donnie Creek', year: 2023, lat: 57.4, lon: -122.0, hectares: 619000, note: 'Largest recorded single fire in BC.' },
    { id: 'h-hay-river', name: 'South Slave fires (Hay River, Enterprise)', year: 2023, lat: 60.6, lon: -116.0, hectares: 500000, note: 'Hay River and Kátł’odeeche First Nation evacuated twice in one season.' },
    { id: 'h-jasper', name: 'Jasper Wildfire Complex', year: 2024, lat: 52.8, lon: -118.05, hectares: 32000, note: 'About a third of structures in Jasper townsite lost.' },
    { id: 'h-red-lake-12', name: 'Red Lake 12', year: 2025, lat: 52.6, lon: -93.9, hectares: 190000, note: 'Led to evacuation of Deer Lake and Sandy Lake First Nations.' },
    { id: 'h-flin-flon', name: 'Flin Flon area fires', year: 2025, lat: 54.8, lon: -101.9, hectares: 370000, note: 'City of Flin Flon and nearby First Nations evacuated.' },
    { id: 'h-nwo-2026', name: 'Armstrong – Collins area fires', year: 2026, lat: 50.3, lon: -89.3, hectares: 0, note: 'July 2026: Whitesand, Collins, Gull Bay and other communities ordered out; many sheltered in Thunder Bay. Size not included (unverified).' },
  ],
  evacuationFacts: [
    { text: 'Indigenous people are about 5% of Canada’s population, yet about 42% of wildfire evacuation events occur in communities that are majority Indigenous. This counts evacuation events, not individual evacuees.', source: 'Dr. Amy Cardinal Christianson, Métis fire research scientist, reported by Global News and the Associated Press (2023), from the Canadian Wildland Fire Evacuation Database, 1980–2021', url: 'https://globalnews.ca/news/9918749/indigenous-vulnerable-wildfires-evacuations' },
    { text: 'Sixteen communities were evacuated five or more times between 1980 and 2021; all but two were First Nations reserves.', source: 'Associated Press, July 2023, citing the same database analysis', url: 'https://www.claimsjournal.com/news/international/2023/07/20/318170.htm' },
    { text: 'About 18.9% of people living on reserve are in high wildfire-risk zones, against 2.4% of people living off reserve.', source: 'Garis & Desautels, University of the Fraser Valley CHASI, July 2026', url: 'https://blogs.ufv.ca/chasi/2026/07/24/building-fire-resilience-through-data-why-social-and-material-conditions-must-shape-canadas-wildfire-strategy/' },
    { text: 'Wildfire evacuees in Canada averaged about 11,900 a year in 2005–2014 and about 55,400 a year in 2015–2024.', source: 'Library of Parliament HillNotes, June 2025', url: 'https://hillnotes.ca/2025/06/27/wildfire-management-a-statistical-and-jurisdictional-portrait/' },
  ],
  notes: [
    'Annual totals differ between sources: CIFFC agency reports gave about 17.2 Mha for 2023, while satellite-mapped NBAC gives about 15 Mha. This table uses agency-reported figures.',
    'The "verified" flag refers to area burned. Fire counts are approximate except 2025 (6,125, per CWFIS).',
    'Community-level evacuation history is deliberately not shown. The Canadian Wildland Fire Evacuation Database is not an open API, and community-level records should be used with the communities concerned.',
  ],
}
