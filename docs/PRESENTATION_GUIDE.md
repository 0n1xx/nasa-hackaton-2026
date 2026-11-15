# Presentation timing and live demo guide

Companion to [PRESENTATION_SCRIPT.md](PRESENTATION_SCRIPT.md). Five minutes in total. The script ends at about 4:40, so you have about 20 seconds of margin for a slow page or a nervous pace.

## Timeline

Words are timed at about 135 per minute. Stage time includes pauses, silence and clicks.

| Time | Speaker | Section | Screen | Words |
| --- | --- | --- | --- | --- |
| 0:00–0:14 | 1 | The question, then ten seconds of silence | Slide 1: the question | 10 |
| 0:14–0:29 | 1 | "Five percent." Then the 42% line | Slide 2: 5%, then 42% | 19 |
| 0:29–1:15 | 1 | Thunder Bay, why those places, ancestral land, hand-off question | Slide 2 stays | 109 |
| 1:15–2:20 | 2 | The warning signs, what the site does, who it helps, honest limit | Slide 3: name and line | 135 |
| 2:20–3:50 | 3 | Live demo: five steps | The website | 170 |
| 3:50–4:22 | 2 | The ask: three things, with the Auditor General's 78% | Slide 4: 5% / 42% | 83 |
| 4:22–4:45 | 1 | Callback to the opening number, final line | Slide 4 stays | 34 |
| **Total** | | | | **560** |

Time on stage per person: Speaker 1 about 1:40 (172 words plus the silence), Speaker 2 about 1:40 (218 words), Speaker 3 about 1:30 (170 words plus typing and clicks).

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
3. **The name.** "Before the Smoke", with the line "See it coming. Ask for help before anyone has to leave." Optional small text: "NASA FIRMS, NASA GIBS, NASA POWER".
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

Before you go on stage: browser full screen (F11), zoom 100%, the home page (**Find your community**) open, header toggle on **Example scenario**, search box empty. Open the community page and click **Satellite photo, July 2026** once beforehand so the NASA photo is cached, then go back home.

| # | Time | Click | What should appear | If it fails |
| --- | --- | --- | --- | --- |
| 1 | 2:20 | Type "White" in the search box, click **Whitesand First Nation** | The community page | Click Whitesand in the **Highest fire risk** list |
| 2 | 2:32 | Point at the first sentence, then scroll the left panel to **Why: 5 warning signs right now** | "Fire risk is very high today…", the 4-step meter, **How sure are we?**, **Why: 5 warning signs right now** | Click **Example scenario**; still failing, play the recording |
| 3 | 2:58 | **Who can send firefighters?** (right column) | 911 first, then 310-FIRE, then Indigenous Services Canada's Ontario emergency office | Say the line; it is in the recording |
| 4 | 3:12 | **Satellite photo, July 2026** (top left of the map) | Real NASA photo of 14 July 2026: smoke and fire | Say the line, click **Map** |
| 5 | 3:28 | **Ask for help** (blue, bottom left) | The 911 box, what you need, who to send it to, the letter | Say the line and step away |

The figures come from the example scenario. If the numbers on screen differ on the day, say what the screen says, not what the script says.

Other screens exist but are not in the demo: **About the data** (how the estimate works, sources, and "Details for experts" with the trend tests and the 42-year NASA record) and **Live data** (in November it correctly shows low risk).

## Before you go on stage

1. **Run the site on the presenting laptop and the venue network beforehand.** Pull `main`, run `npm install`, then `npm run dev` and open <http://localhost:5173>. Open Whitesand First Nation and click **Satellite photo** once, so the NASA imagery is already cached in the browser.
2. **Use the Example scenario.** It is November. Live data will correctly show low risk, which is true and unconvincing on stage. Always say out loud that it is an example. Never present the scenario as real data. The NASA photo for 14 July 2026 is real.
3. **Set the starting state.** The home page (**Find your community**), header toggle **Example scenario**, look ahead **3 days**, search box empty.
4. **Browser:** full screen (F11). Zoom 100%, so the community page's **Ask for help** button and the assistant column both fit on screen. Notifications off, other tabs closed, laptop plugged in.
5. **Offline fallback:** `npm run build && npm start`, then open <http://localhost:8787>. The example scenario and the assistant need no internet. The background map tiles and the NASA photo do.
6. **Screen recording backup:** record the five demo steps (about 80 seconds) and keep the file open in a second window. If the site fails, play it and talk over it.
7. **Rehearse with a timer three times.** The ten seconds of silence will feel far too long. Hold it anyway.

## Questions to expect, with honest answers

**"Is the 42% real?"**
Yes. About 42% of wildfire evacuation events in Canada between 1980 and 2021 were in majority-Indigenous communities. It counts evacuation events, not individual evacuees. Source: Dr. Amy Cardinal Christianson, a Métis fire research scientist, from the Canadian Wildland Fire Evacuation Database, reported by Global News and the Associated Press in 2023. The same analysis found 16 communities evacuated five or more times. All but two were First Nations reserves.

**"Why are reserves in the most fire-prone places?"**
Location and history. Colonial policy placed many reserves on remote, forested land away from settler towns, and later displacements pushed communities further into isolation. Today about 18.9% of people living on reserve are in high wildfire-risk zones, against 2.4% of people living off reserve, which is about eight times the rate. Nationally, about 32% of the on-reserve First Nations population lives where homes meet the forest, against about 12% of all Canadians.
Sources: Garis and Desautels, University of the Fraser Valley CHASI, July 2026 (18.9% and 2.4%); Erni et al., *Canadian Journal of Forest Research*, 2021 (wildland-urban interface shares); Internal Displacement Monitoring Centre, "Canada's Indigenous peoples increasingly at risk of disaster displacement" (colonial displacement and isolation).

**"How accurate is it? Can it predict fires?"**
No, and we don't claim it can. It does not predict where or when a fire will start. It's a transparent index of conditions that make fire more likely to start and spread: heat, dry air, wind, no rain, dry soil, and fire already detected nearby. The weights are our own assumptions, written out on the **About** page, and haven't yet been tested against fire records. What we have checked: on real data from 15 November 2026, at 80 communities, the weather part of our score agreed with Canada's official Fire Weather Index at 66 of the 71 places the official index rated low (only 23 before we fixed how cold, damp air counts). It missed 3 of the 5 places the official index rated high, on the dry prairies, which is why the official index is now an input too. One day of agreement, not a test against real fires. The next step is to test it against Canada's National Fire Database.

**"Why not just use the official Fire Weather Index?"**
We do use it. Canada's official Fire Weather Index from the nearest Natural Resources Canada fire weather station is one of the inputs, for today and the next two days, and in live data the community page shows that station's reading next to ours. The official index is built for fire agencies and stops at three days. What we add is one place for a community: the conditions up to two weeks ahead, the satellite detections, the smoke they're breathing, the 42-year NASA record, and a letter asking for crews and equipment. Plain language, with every input shown.

**"Where are the statistics?"**
On each community page, under "Compared with 42 years of NASA records". For that place, we take NASA POWER daily weather from 1984 to 2025. We rank today's high against the same weeks in every one of those years (a percentile), and we test whether fire-season highs have been rising, with a Mann–Kendall trend test and Sen's slope. The page gives the result in plain words, and the numbers (tau, p-value, degrees per decade) are under "How we tested this". The full method is on About, under "Details for experts". The tests describe the climate record; they don't feed the risk score.

**"Why did fires from the summer show on the map?"**
Canada's wildfire feed keeps a fire on its list until an agency declares it out, and many remote fires are never formally closed. On 15 November 2026 it still listed 105 fires, some from 2020 and 2023. We now leave off any report no one has updated in 14 days unless a satellite still sees heat there; that left 13 current fires, all updated in November.

**"What exactly is NASA's part?"**
Three things, plus Canadian data on top. NASA GIBS gives the daily satellite imagery on the map, including the real 14 July 2026 imagery in the demo with VIIRS fire detections on top. NASA FIRMS gives satellite fire detections from the VIIRS and MODIS instruments for any date once its free key is set; without the key, live mode uses Canada's CWFIS hotspot feed, which comes from the same satellites. NASA POWER gives 42 years of daily weather for each community, which we compare today against and test for trends. Natural Resources Canada adds the reported fires and the official Fire Weather Index.

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

**"Is the assistant an AI chatbot?"**
The suggested questions are answered by built-in rules from the same data as the page, so they work offline and give the same answer every time. If the site is given an Anthropic API key, free-form questions can be answered by Claude, using only that community's page data. On stage it runs without a key.

**"Where do the contacts come from?"**
Only from official government pages we checked on 14 November 2026, each linked with its source: provincial report-a-fire numbers and wildfire services, and Indigenous Services Canada's regional emergency offices. Where we could not confirm a number, the site links the official page instead of guessing.

**"Does the site send the request?"**
No. It writes the letter; the community decides whether to send it, and to whom. In the example scenario the letter is marked as an example and the To line is left empty, so a made-up request can't be emailed by mistake.

**"Where does the 78 percent come from?"**
Auditor General of Canada, Report 8, Emergency Management in First Nations Communities, tabled 15 November 2022: about 78% of Indigenous Services Canada's emergency management spending went to response and recovery rather than preparedness and mitigation.

**"How many communities does it cover?"**
All First Nations in Indigenous Services Canada's open location data (641 places in our directory, including a few Métis settlements from our demonstration list), using the published band-office location. No other community data is used or collected.
