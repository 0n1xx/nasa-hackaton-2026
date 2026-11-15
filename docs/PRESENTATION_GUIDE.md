# Presentation timing and live demo guide

Companion to [PRESENTATION_SCRIPT.md](PRESENTATION_SCRIPT.md). Five minutes in total. The script ends at about 4:40, so you have about 20 seconds of margin for a slow page or a nervous pace.

## Timeline

Words are timed at about 135 per minute. Stage time includes pauses, silence and clicks.

| Time | Speaker | Section | Screen | Words |
| --- | --- | --- | --- | --- |
| 0:00–0:14 | 1 | The question, then ten seconds of silence | Slide 1: the question | 10 |
| 0:14–0:29 | 1 | "Five percent." Then the 42% line | Slide 2: 5%, then 42% | 19 |
| 0:29–1:16 | 1 | Thunder Bay, why those places, ancestral land, hand-off question | Slide 2 stays | 103 |
| 1:16–2:20 | 2 | The warning signs, what the site does, who it's for, honest limits | Slide 3: name and line | 135 |
| 2:20–3:50 | 3 | Live demo: five screens | The website | 170 |
| 3:50–4:22 | 2 | The ask: three things | Slide 4: 5% / 42% | 72 |
| 4:22–4:40 | 1 | Callback to the opening number, final line | Slide 4 stays | 34 |
| **Total** | | | | **543** |

Time on stage per person: Speaker 1 about 1:35 (166 words plus the silence), Speaker 2 about 1:35 (207 words), Speaker 3 about 1:30 (170 words plus clicks).

## The pitch techniques, and where each one is used

| Technique | Where | Why it works |
| --- | --- | --- |
| Question plus silence | 0:00 | An open question creates a gap the audience wants closed. Ten seconds of silence makes everyone guess, so the answer lands. |
| Statistic contrast | 0:14–0:29 | 5% against 42% is one comparison anyone can hold in their head. Small number first, big number second. |
| A specific place and story | 0:29 | "North of Thunder Bay, Whitesand, Gull Bay, Collins" is real and recent. Names are remembered; percentages are not. |
| Problem, agitate, solve | 0:00–2:20 | Speaker 1 states the problem and makes it hurt (it keeps happening, to the same places, on ancestral land). Speaker 2 brings the fix. |
| Ending on a question | 1:03 | "What if we could see one coming?" hands off to Speaker 2, who answers it. Nobody needs to say "over to you". |
| Honesty as credibility | 2:08 | Saying what the tool can't do before a judge asks makes everything else more believable. |
| Show, don't tell | 2:20–3:50 | The demo proves it exists. "Now this part is real" flags the NASA imagery as the strongest proof. |
| Rule of three | 3:50–4:22 | Three asks, numbered out loud. Three is easy to remember and feels complete. |
| Callback | 4:22 | Repeating 5% and 42% closes the loop the opening question opened. |
| Clear call to action | 3:50 | Concrete things the audience can fund, build or change. |
| End on a line, not "thank you" | 4:32 | The last words people hear are the message. Hold eye contact and let the applause come. |

## Slides (four, minimal)

The slides are minimal on purpose. People should watch the speaker, then the website.

1. **The question.** White text on black: "What percentage of Canada's population is Indigenous?" Nothing else.
2. **The contrast.** "5%" alone. On Speaker 1's next line, "42%" appears beside it, larger. Small source line at the bottom: *Christianson et al., Canadian Wildland Fire Evacuation Database, 1980–2021. Counts evacuation events, not evacuees.*
3. **The name.** "Before the Smoke", with the line "See fire risk building. Act before anyone has to leave." Optional small text: "NASA FIRMS · NASA GIBS · NASA POWER".
4. **The close.** "5% of the population. 42% of wildfire evacuation events."

## Who advances what

The person who is not speaking next runs the clicker.

| Moment | Who | Action |
| --- | --- | --- |
| 0:14 | Speaker 2 | Slide 1 to Slide 2 (5%) |
| 0:18 | Speaker 2 | Bring in 42% |
| 1:15 | Speaker 1 | Slide 2 to Slide 3 |
| 2:18 | Speaker 1 | Switch the screen from slides to the browser |
| 3:48 | Speaker 3 | Switch to Slide 4, then step away from the laptop |

If the slides and the site are on the same laptop, practise the switch (Alt+Tab, or the presenter's window switcher) until it takes under a second.

## The live demo, click by click

Everything happens on one screen: a full-screen map with one panel on the left. Before you go on stage, the site is on the home screen, the header toggle shows **Simulated**, and the panel shows **Thunder Bay**.

| # | Time | Click | What should appear | If it fails |
| --- | --- | --- | --- | --- |
| 1 | 2:20 | Nothing. Point at the panel. | Big **67**, High, "Critical tomorrow", the warning signs with icons | "Couldn't load data": click **Simulated**. Still failing: play the recording. |
| 2 | 2:50 | Nothing. Sweep a hand over the map. | Regions as coloured circles with their scores | Say the line anyway. |
| 3 | 3:00 | **NASA satellite · 14 July 2026** (bottom of the map) | Real NASA imagery: smoke plumes, red fire detections, First Nations labelled | Imagery slow: say the fallback line, click **Today**. |
| 4 | 3:25 | **Today**, then **Send situation brief** (bottom of the panel) | A one-page brief: risk, signs, communities, what to move in | Say the line and step away. |

The other pages (Early warning, Communities, Air quality, Trends, Data) still exist but are not linked from the home screen. Mention them only if a judge asks; **About the data** in the header covers sources and method.

The figures come from the simulated scenario. If the numbers on screen differ on the day, say what the screen says, not what the script says.

## Before you go on stage

1. **Run the site on the presenting laptop and the venue network beforehand.** Pull `main`, run `npm install`, then `npm run dev` and open <http://localhost:5173>. Click **NASA satellite · 14 July 2026** once, so the NASA imagery is already cached in the browser.
2. **Use the Simulated scenario.** It is November. Live mode will correctly show few or no fires and low risk, which is true and unconvincing on stage. Always say out loud that it is simulated. Never present the scenario as real data. The NASA imagery for 14 July 2026 is real.
3. **Set the starting state.** Home screen (the map), header toggle **Simulated**, panel region **Thunder Bay**, map on **Today**.
4. **Browser:** full screen (F11). Zoom 100%, so the whole panel, including the button at its bottom, fits on screen. Notifications off, other tabs closed, laptop plugged in.
5. **Offline fallback:** `npm run build && npm start`, then open <http://localhost:8787>. Simulated mode needs no internet. The background map tiles and the NASA imagery do.
6. **Screen recording backup:** record the five demo steps (about 80 seconds) and keep the file open in a second window. If the site fails, play it and talk over it.
7. **Rehearse with a timer three times.** The ten seconds of silence will feel far too long. Hold it anyway.

## Questions to expect, with honest answers

**"Is the 42% real?"**
Yes. About 42% of wildfire evacuation events in Canada between 1980 and 2021 were in majority-Indigenous communities. It counts evacuation events, not individual evacuees. Source: Dr. Amy Cardinal Christianson, a Métis fire research scientist, from the Canadian Wildland Fire Evacuation Database, reported by Global News and the Associated Press in 2023. The same analysis found 16 communities evacuated five or more times. All but two were First Nations reserves.

**"Why are reserves in the most fire-prone places?"**
Location and history. Colonial policy placed many reserves on remote, forested land away from settler towns, and later displacements pushed communities further into isolation. Today about 18.9% of people living on reserve are in high wildfire-risk zones, against 2.4% of people living off reserve, which is about eight times the rate. Nationally, about 32% of the on-reserve First Nations population lives where homes meet the forest, against about 12% of all Canadians.
Sources: Garis and Desautels, University of the Fraser Valley CHASI, July 2026 (18.9% and 2.4%); Erni et al., *Canadian Journal of Forest Research*, 2021 (wildland-urban interface shares); Internal Displacement Monitoring Centre, "Canada's Indigenous peoples increasingly at risk of disaster displacement" (colonial displacement and isolation).

**"How accurate is it? Can it predict fires?"**
No, and we don't claim it can. It does not predict where or when a fire will start. It's a transparent index of conditions that make fire more likely to start and spread: heat, dry air, wind, no rain, dry soil, and fire already detected nearby. The weights are our own assumptions, written out on the **Data** page, and haven't yet been tested against fire records. The next step is to test it against Canada's National Fire Database.

**"Why not just use the official Fire Weather Index?"**
The Canadian Fire Weather Index is the right tool for fire agencies, and a real version should show it side by side with ours. What we add is in one place for a community or regional coordinator: the fire conditions, the satellite detections, the smoke they're breathing, which communities are exposed, and a brief that tells responders what to move. Plain language, with every input shown.

**"What exactly is NASA's part?"**
Three things. NASA GIBS gives the daily satellite imagery on the map, including the real 14 July 2026 imagery in the demo with VIIRS fire detections on top. NASA FIRMS gives satellite fire detections from the VIIRS and MODIS instruments for any date once its free key is set; without the key, live mode uses Canada's CWFIS hotspot feed, which comes from the same satellites. NASA POWER gives the long-term climate averages we compare today against.

**"Where does the Thunder Bay detail come from?"**
News reporting from 13 to 22 July 2026 (The Canadian Press, Global News, CTV, CP24). Five First Nations north of Thunder Bay were under evacuation orders: Whitesand, Collins (Namaygoosisagagun), Gull Bay, Lac des Mille Lacs and Lac La Croix. Gull Bay First Nation said about 100 evacuees were sleeping in their cars in Thunder Bay because no hotel rooms were left.

**"Is the weather data measured?"**
No. Weather is gridded model output from Open-Meteo, and air quality comes from the Copernicus model. Both are labelled as model estimates on the site. Many northern communities have no air sensor at all, which is part of our first ask.

**"Did you work with Indigenous communities?"**
Not yet, and the site says so. We use only public community locations, no cultural or land-use information, and we don't speak for any Nation. A real version would be built with communities and governed by them, following the First Nations principles of OCAP®: ownership, control, access and possession.

**"Who would actually use this?"**
Two groups. Fire and emergency management agencies deciding where to pre-position crews and equipment. And community emergency coordinators and leadership, who decide for themselves how to prepare.

**"Why 'events' and not people?"**
The evacuation database counts evacuation events. One event can be a few dozen people or a whole town, so we keep the wording precise.
