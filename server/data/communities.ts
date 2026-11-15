import type { Community } from '../../shared/types.ts'

// A small demonstration set of community locations.
//
// - Only the general location of the main community is included, as already
//   published on public maps. No cultural sites, traplines, harvesting areas or
//   other sensitive geography. None should ever be added without community consent.
// - Coordinates are APPROXIMATE (rounded, typically within 10–20 km). For real use,
//   replace this file with Indigenous Services Canada's open "First Nations Location"
//   dataset and, better, with locations each community chooses to share.
// - `reported` lists wildfire events drawn from public news reporting. It is not a
//   complete evacuation history and says nothing about a community's own assessment.
// - This is not a list of "all" communities and inclusion implies no ranking.
export const COMMUNITIES: Community[] = [
  // Thunder Bay District
  { id: 'fort-william', name: 'Fort William First Nation', kind: 'First Nation', province: 'ON', regionId: 'thunder-bay', lat: 48.31, lon: -89.27, reported: [] },
  { id: 'whitesand', name: 'Whitesand First Nation', kind: 'First Nation', province: 'ON', regionId: 'thunder-bay', lat: 50.30, lon: -89.04, reported: ['Evacuation order, July 2026'] },
  { id: 'collins', name: 'Namaygoosisagagun (Collins) First Nation', kind: 'First Nation', province: 'ON', regionId: 'thunder-bay', lat: 50.29, lon: -89.45, reported: ['Evacuation order and loss of homes, July 2026'] },
  { id: 'gull-bay', name: 'Kiashke Zaaging Anishinaabek (Gull Bay First Nation)', kind: 'First Nation', province: 'ON', regionId: 'thunder-bay', lat: 49.82, lon: -89.10, reported: ['Evacuation, July 2026'] },
  { id: 'lac-des-mille-lacs', name: 'Lac des Mille Lacs First Nation', kind: 'First Nation', province: 'ON', regionId: 'thunder-bay', lat: 48.85, lon: -90.40, reported: ['Evacuation order, July 2026'] },
  { id: 'lac-la-croix', name: 'Gakijiwanong Anishinaabe Nation (Lac La Croix)', kind: 'First Nation', province: 'ON', regionId: 'thunder-bay', lat: 48.36, lon: -92.11, reported: ['Evacuation order, July 2026'] },
  // Kenora – Red Lake
  { id: 'wabaseemoong', name: 'Wabaseemoong Independent Nations', kind: 'First Nation', province: 'ON', regionId: 'kenora-red-lake', lat: 50.14, lon: -94.93, reported: ['Evacuation, May 2025'] },
  { id: 'pikangikum', name: 'Pikangikum First Nation', kind: 'First Nation', province: 'ON', regionId: 'kenora-red-lake', lat: 51.81, lon: -93.99, reported: ['Evacuations, 2019'] },
  { id: 'deer-lake', name: 'Deer Lake First Nation', kind: 'First Nation', province: 'ON', regionId: 'kenora-red-lake', lat: 52.62, lon: -94.06, reported: ['Evacuation, 2025'] },
  { id: 'cat-lake', name: 'Cat Lake First Nation', kind: 'First Nation', province: 'ON', regionId: 'kenora-red-lake', lat: 51.72, lon: -91.81, reported: [] },
  // Far North Ontario
  { id: 'sandy-lake', name: 'Sandy Lake First Nation', kind: 'First Nation', province: 'ON', regionId: 'far-north-on', lat: 53.07, lon: -93.34, reported: ['Evacuation, June 2025'] },
  { id: 'neskantaga', name: 'Neskantaga First Nation', kind: 'First Nation', province: 'ON', regionId: 'far-north-on', lat: 52.20, lon: -88.02, reported: ['Evacuation flights, July 2026'] },
  { id: 'webequie', name: 'Webequie First Nation', kind: 'First Nation', province: 'ON', regionId: 'far-north-on', lat: 52.96, lon: -87.37, reported: ['Evacuation, 2025'] },
  { id: 'kasabonika', name: 'Kasabonika Lake First Nation', kind: 'First Nation', province: 'ON', regionId: 'far-north-on', lat: 53.53, lon: -88.61, reported: [] },
  { id: 'eabametoong', name: 'Eabametoong First Nation', kind: 'First Nation', province: 'ON', regionId: 'far-north-on', lat: 51.56, lon: -87.90, reported: [] },
  // Manitoba, Saskatchewan
  { id: 'pimicikamak', name: 'Pimicikamak Cree Nation', kind: 'First Nation', province: 'MB', regionId: 'n-manitoba', lat: 54.62, lon: -97.77, reported: ['Evacuation, 2025'] },
  { id: 'mathias-colomb', name: 'Mathias Colomb Cree Nation', kind: 'First Nation', province: 'MB', regionId: 'n-manitoba', lat: 55.74, lon: -101.32, reported: ['Evacuation, 2025'] },
  { id: 'lac-la-ronge', name: 'Lac La Ronge Indian Band', kind: 'First Nation', province: 'SK', regionId: 'n-sask', lat: 55.10, lon: -105.28, reported: ['Evacuations, 2015 and 2025'] },
  { id: 'peter-ballantyne', name: 'Peter Ballantyne Cree Nation (Pelican Narrows)', kind: 'First Nation', province: 'SK', regionId: 'n-sask', lat: 55.19, lon: -102.93, reported: [] },
  // Alberta
  { id: 'fort-chipewyan', name: 'Fort Chipewyan (Mikisew Cree, Athabasca Chipewyan, Métis)', kind: 'First Nation', province: 'AB', regionId: 'n-alberta', lat: 58.77, lon: -111.12, reported: ['Evacuation, May 2023'] },
  { id: 'sturgeon-lake', name: 'Sturgeon Lake Cree Nation', kind: 'First Nation', province: 'AB', regionId: 'n-alberta', lat: 55.05, lon: -117.50, reported: ['Homes lost, May 2023'] },
  { id: 'east-prairie', name: 'East Prairie Métis Settlement', kind: 'Métis Settlement', province: 'AB', regionId: 'n-alberta', lat: 55.17, lon: -116.05, reported: ['Homes lost, May 2023'] },
  { id: 'paddle-prairie', name: 'Paddle Prairie Métis Settlement', kind: 'Métis Settlement', province: 'AB', regionId: 'n-alberta', lat: 57.95, lon: -117.48, reported: ['Homes lost, 2019'] },
  // BC, NWT
  { id: 'lytton', name: 'Lytton First Nation', kind: 'First Nation', province: 'BC', regionId: 'bc-interior', lat: 50.23, lon: -121.58, reported: ['Evacuation, June 2021'] },
  { id: 'westbank', name: 'Westbank First Nation', kind: 'First Nation', province: 'BC', regionId: 'bc-interior', lat: 49.86, lon: -119.60, reported: ['Evacuation alert, August 2023'] },
  { id: 'katlodeeche', name: 'Kátł’odeeche First Nation', kind: 'First Nation', province: 'NT', regionId: 'nwt-south', lat: 60.83, lon: -115.75, reported: ['Evacuations, 2023'] },
]
