# Community location data (First Nations + Alberta Métis Settlements)

## Primary: ISC "First Nation Location" (open.canada.ca, id b6567c5c-8339-4055-99fa-63f92114d9e4)
- Licence: Open Government Licence - Canada (ca-ogl-lgo), https://open.canada.ca/en/open-government-licence-canada . Attribute "Contains information licensed under the Open Government Licence - Canada". Metadata last modified 2026-04-14.
- CSV zip: https://data.sac-isc.gc.ca/geomatics/rest/directories/arcgisoutput/DonneesOuvertes_OpenData/Premiere_Nation_First_Nation/Premiere_Nation_First_Nation_CSV.zip
- Dictionary: .../Premiere_Nation_First_Nation/Reference/First_Nation_Data_Dictionary_CSV.csv
- REST (GeoJSON, CORS-friendly to test): https://geo.sac-isc.gc.ca/geomatics/rest/services/Donnees_Ouvertes-Open_Data/Premiere_Nation_First_Nation/MapServer/0/query?where=1%3D1&outFields=*&outSR=4326&f=geojson&resultRecordCount=5000
- Fields: CSV = BAND_NUMBER, BAND_NAME, LONGITUDE, LATITUDE, COORD_SYS (NAD83 CSRS). GeoJSON = OBJECTID, BAND_NUMBER, BAND_NAME + Point geometry. NO province, address or community-name field.
- Records: 638 (CSV and GeoJSON agree). 437 fall in lat 48-62, lon -126 to -70. None lack geometry.
- Point meaning (per dataset notes): each point is the First Nation's ADMINISTRATIVE OFFICE address as registered in ISC BGMS; if the office is outside its most populated reserve, the point is moved inside that reserve (else another associated reserve, else the city). If unlocatable, best available info (e.g. band website). So: band office / administrative, nudged into reserve; not a reserve polygon centroid.
- Official name only (BAND_NAME as ratified by BCR). Many communities are known by other names, so a search box needs aliases.

### Sample rows (lon, lat)
| Band no. | BAND_NAME | lon | lat |
|---|---|---|---|
| 190 | Whitesand | -89.0433 | 50.3099 |
| 188 | Gull Bay | -89.1066 | 49.8045 |
| 189 | Lac Des Mille Lacs | -90.3298 | 48.8874 |
| 127 | Gakijiwanong Anishinaabe Nation | -92.1612 | 48.3742 |
| 172 | Aamjiwnaang | -82.4161 | 42.9360 |

Caveats on requested names: "Gull Bay" appears under that name only (not "Kiashke Zaaging Anishinaabek"); "Lac La Croix" appears as "Gakijiwanong Anishinaabe Nation" (search alias needed); **Namaygoosisagagun (Collins) is NOT in this dataset** (grep for namay/collins found nothing; it is not a Indian Act band). Needs a manual entry or alias source.

## Alberta Métis Settlements (Government of Alberta, open.alberta.ca id 0a469551-8e68-41b8-8a00-20d708d5d3a2)
- Licence: Open Government Licence - Alberta.
- REST: https://geospatial.alberta.ca/titan/rest/services/boundaries/municipal_metis_settlement_public/FeatureServer/0 (polygons only; fields METIS_NAME, METIS_CODE, GlobalID, Shape__Area/Length).
- 10 polygon parts = 8 settlements (Gift Lake and Kikino are multipart; Buffalo Lake, East Prairie, Elizabeth, Fishing Lake, Paddle Prairie, Peavine). No point layer: we derived points as bounding-box centre of each polygon part (approximate, first ring only; not a townsite/office location). Check the 8 against the official list before shipping; better to hand-pick settlement office coordinates.

## Local files (scratchpad, untrusted-source data, not edited into repo)
Dir: C:\Users\temil\AppData\Local\Temp\claude\d065b534f8559cf9\406136c6-0ad7-4bd6-8d39-a09a54b0e1a0\scratchpad\community-data\
- first_nations.geojson (638 Points), raw\csv\Premiere_Nation_First_Nation.csv (638 rows), raw\dict.csv
- metis_settlements_raw.geojson (10 polygons), metis_settlements_points.geojson (derived approx points)
