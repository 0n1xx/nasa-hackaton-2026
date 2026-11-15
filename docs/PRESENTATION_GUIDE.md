# Presentation timing and live demonstration guide

Companion to [PRESENTATION_SCRIPT.md](PRESENTATION_SCRIPT.md). Total 5:00, with ten seconds of margin.

## Timeline

| Time | Speaker | Section | Screen | Words |
|---|---|---|---|---|
| 0:00–0:14 | 1 | Question, then ten-second silence | Slide 1: the question | 11 |
| 0:14–0:28 | 1 | "Five percent" and the 42% statistic | Slide 2: 5%, then 42% | 16 |
| 0:28–1:15 | 1 | Why it matters, Thunder Bay, hand-off | Slide 2 stays | 110 |
| 1:15–1:36 | 2 | Introduces BorealWatch and NASA data | Slide 3: logo and tagline | 45 |
| 1:36–2:06 | 2 | The indicators and the risk index | Slide 4: seven icons | 100 |
| 2:06–2:35 | 2 | Honest limits, hand-off | Slide 4 stays | 55 |
| 2:35–3:55 | 3 | Live demonstration (80 s, five screens) | The website | 140 |
| 3:55–4:50 | 3 | Conclusion and call to action | Slide 5: closing line | 135 |

Speaking time is roughly 1:15, 1:20 and 2:15. Speaker 3 carries the demo, which is mostly clicking; to even the split further, Speaker 1 can deliver the three asks at 4:10–4:34 and hand back for the last two lines.

## Slides (five, minimal)

1. The question, white on black. Nothing else.
2. "5%" alone. On Speaker 1's second line, "42%" appears beside it, larger. Small source line: *Christianson et al., Canadian Wildland Fire Evacuation Database, 1980–2021. Evacuation events, not evacuees.*
3. BorealWatch name and tagline.
4. Seven icons in a row: satellite, thermometer, droplet, wind, rain, leaf, lungs. No sentences.
5. "Five percent of the population. Forty-two percent of the evacuations."

Who changes slides: the person not speaking next. Speaker 2 advances for Speaker 1; Speaker 3 for Speaker 2; Speaker 1 switches to the browser at 2:35 and to Slide 5 at 3:55.

## Transitions

- **1 → 2 (1:07):** Speaker 1 ends on a question, "So what would that take?", and turns. Speaker 2 answers it in their first sentence. No "thank you" or "now I will pass to".
- **2 → 3 (2:28):** "Let us show you." Speaker 3 is already at the laptop with a hand on the trackpad.
- **3 → close (3:55):** Speaker 3 physically steps away from the laptop before the conclusion. The movement tells the room the demo is over.

## The live demonstration, click by click

Every step below exists in the site and was exercised in a browser.

| # | Time | Action | What to say it shows |
|---|---|---|---|
| 0 | before | Site open on **Overview**. Top bar: Region = *Thunder Bay District*, Data = **Simulated scenario** | Name it as simulated in the first sentence |
| 1 | 2:47 | Scroll to **Canada at a glance** | Three headline numbers; fires, detections, communities on the map |
| 2 | 3:00 | Menu → **Wildfire map**. The map flies to Thunder Bay. Click **14 Jul 2026** | Real NASA true-colour and thermal imagery for that date |
| 3 | 3:12 | Menu → **Air quality** | The AQI figure, the hourly chart with dashed forecast, health guidance |
| 4 | 3:24 | Menu → **Risk assessment** | Dial, confidence, "What is driving it" bars, 72-hour outlook |
| 5 | 3:38 | Menu → **Community impact**, scroll to **Geographic exposure right now** | Table sorted by nearest fire; the principles panel above it |

Leave out Trends, Preparedness and Data & methods. Mention them only if asked.

## Before you go on stage

1. **Run it on the venue network the day before.** The live integrations and the NASA map tiles have not been tested yet. Open **Data & methods** and confirm each source shows "ok". If the NASA layers in step 2 do not draw, the layer names in `src/components/MapView.tsx` need adjusting, or drop that click and say the sentence over the simulated map.
2. **Decide live or simulated.** In mid-November, live mode will show few or no fires and low risk. That is correct, and unconvincing. The script assumes the simulated scenario plus the real 14 July imagery, and says so out loud. Never present the scenario as real data.
3. **Offline fallback.** `npm run build && npm start` on the laptop needs no internet in simulated mode, apart from the background map tiles. Record a 75-second screen capture of the five steps as a last resort.
4. Browser at 110–125% zoom, full screen, notifications off, laptop on power.
5. Rehearse with a timer three times. The ten-second silence will feel far too long. Hold it anyway.

## Questions to expect

- **"Is the 42% real?"** Yes: 42% of wildfire evacuation *events* occurred in majority-Indigenous communities, 1980–2021, from the Canadian Wildland Fire Evacuation Database (Christianson and colleagues). It is not 42% of evacuees.
- **"How accurate is the prediction?"** It is not a prediction of ignition. It is an unvalidated index of conditions. Next step: test against the National Fire Database and show it beside Canada's official Fire Weather Index.
- **"Did you work with Indigenous communities?"** Not yet, and the site says so. The community list is public locations only. A real version would be co-designed and governed under OCAP® principles.
- **"What is NASA's part?"** VIIRS and MODIS fire detections through FIRMS, daily imagery through GIBS, and climate normals from POWER.
- **"Is the weather data measured?"** No, it is gridded model output from Open-Meteo, and air quality comes from the Copernicus model. Both are labelled as model estimates.
