# Before the Smoke: design critique and direction for the community hub

Independent critique, 14 November 2026. For the builders of wave 2 and 3. Read with
`docs/plans/2026-11-14-community-hub.md` (voice guide and glossary win over anything here).

Evidence: `.playwright-mcp/` screenshots `critique-home-popover`, `v4-7day`, `v4-fire-popup`,
`v3-trend`, `v4-history`, `critique-risk`, `v2-home-390`, `v2-brief-1440`, checked against the
current code. Note: the `v2-*` shots are older than the code (the 390 shot shows region circles,
not the grid; the brief now says "Next 3 days", not "Next 72 h"). Findings below are confirmed
in code unless marked "screenshot only".

**The one-line diagnosis.** The current site is a well-built analyst dashboard. Every element is
a control, every control is a popover, and the biggest thing on every screen is a number. A
community member needs the opposite: a sentence first, the number second, one control at a
time, and one obvious next step.

---

## 1. What reads as AI-generated, and what nobody can understand

### 1a. "Looks AI" tells (element, screen, why)

1. **Giant coloured hero number.** "67" at 76 px condensed bold beside a small "High"
   (`RiskPanel.tsx:215`, home; `Risk.tsx` Dial at 96 px; Brief at 44 px). The big KPI number
   is the most common generated-dashboard trope, and it is the least meaningful fact on screen.
2. **Three-up stat cards.** Big number, small caption, three in a row: "Rising / +3.3 pts/day /
   +7.2 °C" (`TrendSheet.tsx` StatCard) and "+0.2 °C / 87% / 2021" (`HistoryContext.tsx`), plus
   the Brief's 3-column `dl`. This is the canonical template layout.
3. **An accent-coloured icon on every row.** Ember Lucide icons on each warning sign, plus
   TrendingUp, Truck, LineChart and a paper-plane Send (`RiskPanel.tsx:44-46, 223, 231, 289`).
   `CloudOff` is used for both "days without rain" and "smoke", so one icon means two things.
   It also reads as "offline". Icons chosen by name from a library are a strong tell.
4. **Pills everywhere.** "Live/Simulated", "1d 3d 7d 14d" (twice on one screen), "Today / NASA
   satellite", dashed-border day chips, all `rounded-full` on grey tracks. The panel is a
   `rounded-2xl` card with a large soft shadow, floating 16 px off the edge (`Home.tsx`). This is
   the stock shadcn/Tailwind look.
5. **"PREDICTED" in red capitals with tracking**, wedged into the day strip
   (`HeroMap.tsx:287`), with dashed outlines that nothing explains. It is decorative encoding.
6. **Dozens of pulsing red dots** (`.fire-pulse`, `styles.css:127`). Motion used to make the
   map "feel alive" reads as a demo effect, and it is alarmist for people who have been
   evacuated before.
7. **A blocky heat-map with floating numbers.** Hard-edged translucent rectangles in salmon
   and mustard, with bold unlabelled numbers (40, 54, 60, 82, 76, 77, 47) in invisible circles
   (`HeroMap.tsx:190-231`). It looks like a debug layer or a generated "risk heatmap".
8. **A form-label explainer card** on every word: "What: / Source: / How to read:"
   (`ui.tsx:151-154`). Every label, number and legend item is a button. When everything is
   explained, the screen looks auto-annotated.
9. **Statistics as decoration.** Mann–Kendall, R², p-values, Sen's slope and a "95% band" sit
   one click from the home screen, with "−0.0 mm/day (p = 0.85)" (negative zero, `signed()` in
   `TrendSheet.tsx:31`).
10. **Copy tells.** A rhetorical headline ("Are fire conditions lining up in Thunder Bay?") under
    a kicker ("Early warning"). Colon titles ("Risk trend: Thunder Bay"). "What is driving it",
    "Move before ignition", six-item comma lists in the intro, and middle-dot chains ("Tuesday,
    Nov 17 · predicted", "NASA satellite · 14 July 2026", "Thunder Bay District, Northwestern
    Ontario · November 14…"). "← Back to map".
11. **Condensed poster type on data UI.** Archivo at 72 % width with negative tracking on every
    heading and number (`.condensed`, used in 9 files). It reads as "fire-danger signage" styling
    applied everywhere, rather than as a typographic system.
12. **Clip-art logo.** A triangle tree with an orange dot (`App.tsx` Logo). Use the wordmark alone.

### 1b. "I click it and don't know what it means" (every unexplained thing)

New strings follow the voice guide. The day names and numbers are from the example scenario.

**Home panel (`RiskPanel.tsx`)**

| On screen now | Problem | Say instead |
| --- | --- | --- |
| "Thunder Bay" with a chevron | A region, not my community. Nothing says it can be changed. | Search: "Find your community". Heading = the Nation's name, province below. |
| "Simulated scenario" (12 px, mustard) | Too small for a projector. "Simulated" is jargon. | Full-width banner: "Example scenario, not real conditions." |
| "67" | 67 of what? | "High (67 out of 100)", after the sentence |
| "High" | High what? Compared to what? | "Fire risk is high today." |
| "Predicted Critical tomorrow" | "Predicted" overclaims. "Critical" is not in the glossary. | "It is expected to be very high from Sunday." |
| "Pre-position crews by today" | Whose crews? Jargon, and it reads as an order to the community. | Remove from the page. In the letter: "We are asking for crews to be ready by Saturday." |
| "1d 3d 7d 14d" + ⓘ (twice: panel and map) | Abbreviations, and no hint of what changes | Once, in the panel: "Look ahead: 1 day, 3 days, 1 week, 2 weeks" |
| "See trend" | Trend of what? | "How the risk changed this week" |
| Bar strip: heights, pale vs solid vs top-bordered bars | No scale, no words, encoding unexplained | Day cells: weekday, 4-step meter, level word |
| "Past / Today / Predicted" (each a button) | A legend that is itself a control | Remove. Forecast cells are hatched, with "Further ahead is less certain". |
| "Warning signs 5 of 6" | Which is the sixth? The brief says "6 of 7" (it counts the outlook sign; home does not). | "5 warning signs right now", plus a button "See all 6" |
| "+10° this week" | Is it 10 degrees? A rise? °C or °F? | "Hotter: today's high is 10 °C above last week's." |
| "Humidity 29%" | Good or bad? | "Dry air: humidity is down to 29%. We count it as a warning sign at 35% or lower." |
| "6 days without rain" | It means *soaking* rain (2.5 mm or more) | "No soaking rain for 6 days." |
| "Wind 34 km/h ahead" | "Ahead" when? | "Strong wind expected Sunday, up to 34 km/h." |
| "10 fire detections nearby" | Detected by what? How near? When? | "Heat spotted by satellites 10 times within 100 km in the last day." |
| "First Nations nearby ⓘ 6" | Near what? Why this list? | Gone from home (search replaces it). On the community view: "Other communities within 50 km" |
| "13 km from fire" | Which fire? Is it real? Which direction? | "Nearest wildfire: 13 km north-west, being held (example fire)" |
| "+3 more" | Looks like a link but is a `<p>` and does nothing | A button: "Show all 6" |
| "Send situation brief" + paper plane | Send to whom? The site sends nothing. | "Ask for help" |
| Short names "Collins", "Gull Bay" (`shortName()` in RiskPanel and HeroMap) | The Nation's own name is removed and the English place name kept. That is disrespectful. | "Namaygoosisagagun First Nation", with "(Collins)" as secondary text |

**Map (`HeroMap.tsx`, `App.tsx`)**

| On screen now | Problem | Say instead |
| --- | --- | --- |
| Header "Live / Simulated" | Jargon | "Live data / Example scenario" |
| Top-right "Today" | It is a map layer, not a date, and it clashes with the "Today" day pill | "Map" |
| "NASA satellite · 14 July 2026" | Every other date on screen is November. Middle dot. | "Satellite photo, 14 July 2026" with the caption "A real NASA photo from this summer's fires" |
| Map numbers 40/54/60/82/76/77/47 | Unlabelled. **The selected region shows 77 while the panel says 67**: autoplay ends on the last forecast day (`HeroMap.tsx:117` returns `lastIdx`) while the panel shows today. This breaks "one number per place". | Remove. Communities carry their level; the map rests on Today. |
| Coloured squares | What is a square? Why is it square? | Legend title "Fire risk (our estimate)". Soften the edges. Hide Low. |
| Black dots | No names | Name on hover or tap; the selected community is always labelled |
| Pulsing red dots | Fire? A satellite detection? Both look the same. | Flame marker = "Wildfire reported by fire crews". Small square = "Heat spotted by satellites". |
| "Tuesday, Nov 17 · predicted" | Middle dot, "predicted" | "Showing Tuesday 17 November (expected)" |
| "T 10 W 11 T 12 F 13 S 15" (1 week, 2 weeks) | T = Tuesday or Thursday? S = Saturday or Sunday? | Remove the map timeline. Panel cells use "Tue 17". |
| Play button | Plays what? It also auto-plays on load and leaves the map on a future day. | Optional "Play the next 3 days", which ends back on Today |
| Legend "Moderate", "Critical" | Not glossary words | "Medium", "Very high" (display map, see fix 8) |

**Fire popup (`HeroMap.tsx` Card, `v4-fire-popup`)**

| On screen now | Say instead |
| --- | --- |
| "Simulated fire / Invented for demonstration; not real." | "Example fire (not real)" |
| "Name SIM ON 001" | Leave it out (or "Example fire 1") |
| "Agency ON" | "Reported by Ontario fire crews" |
| "Stage Being held" | "Being held: not expected to spread past its edges for now." |
| "Size 13,663 ha" | "About 137 square kilometres" |
| "Reported 2026-11-08" | "Reported Sunday 8 November" |
| "Location 49.977, -88.788" | "13 km north-west of Whitesand First Nation" |
| "Source: … Updated: …" | "From the Canadian Wildland Fire Information System. Updated 14 November, 10:34 p.m." |

**Trend sheet (`TrendSheet.tsx`, `HistoryContext.tsx`)**

| On screen now | Problem | Say instead |
| --- | --- | --- |
| "Risk trend: Thunder Bay" | Colon title, region | "How fire risk changed this week" |
| Y axis 0–100 with tinted bands | The bands have no labels | Axis title "Fire risk, out of 100", level words on the bands |
| "Observed / Predicted / Trend with 95% band" | Jargon | "Past days / Expected". The band moves under "Details for experts". |
| "Trend test (Mann–Kendall) Rising p = 0.002" | Jargon first | "Is this rise real? Yes, it is very unlikely to be chance." Expert line underneath. |
| "Linear trend +3.3 pts/day, R² 0.96" | Jargon | "Up about 3 points a day this week." |
| "Temperature anomaly +7.2 °C… July normal (22.7 °C)" vs "a typical mid-July day 25 °C" | **Two different "normals" on one sheet.** Both say July, but the screen says November. | One normal everywhere. In example mode: "This example is set in mid-July." |
| "Rain −0.0 mm/day (p = 0.85)" | Negative zero | "No real change" |
| "Sen's slope", "+0.2 °C per decade, no significant trend; Mann–Kendall p = 0.19" | Jargon | "Summers here have warmed a little since 1984, not enough to rule out chance." |
| "Today vs history 87%" | A percentage next to risk | "Hotter than 87 in every 100 mid-July days since 1984" |

**Risk page (`Risk.tsx`)**: "Confidence: Low" is shown in mustard, the same colour as a risk
level, so it reads as "risk is low". "Why: inputs are simulated; all inputs present; model is
unvalidated." "Uncertainty band 53–81". "Vapour pressure deficit (vegetation dry…" is truncated.
"2.99 kPa", "0.13 m³/m³", "+14.8 /18", "Historical fire activity (regional baseline) 0.60".
"Hover a row for the scoring rule" cannot work on a phone or a projector. Recommendation: retire
the page from navigation and move it to /about, under "Details for experts".

**Brief (`Brief.tsx`)**: Communities are sorted alphabetically (`Brief.tsx:122`), so "Fort
William, 166 km" comes first while home sorts by distance. Full official names here, short
English names on home. "Critical" has no day attached. "Move before ignition". "Copy text /
Print" does not say who to send it to.

**Phone (`v2-home-390`, screenshot only)**: There is no search. The map takes the top half
with no "you are here". The panel scrolls inside the page scroll (two scrollbars). "NASA · 14
Jul". The giant "67" fills a quarter of the screen.

---

## 2. Visual direction: "a public notice, not a dashboard"

**References, for patterns only.** From GOV.UK and Canada.ca: one job per screen, plain
headings, the details/expander pattern, warning callouts, a phase banner for "Example scenario".
Do **not** use government wordmarks, flags, the Canada.ca header or official colours. The site
must read as trustworthy, never as official. From Watch Duty: fires as clear named icons with a
status and an "updated" time, a calm map, and no alarm motion. From Apple Weather: a short "look
ahead" row of days with one word each, big readable type and few facts. From Windy: a smooth
risk field instead of blocks. Do not copy their colours or layouts.

**Palette** (tokens in `styles.css` `@theme`; levels in `shared/risk.ts`):

| Token | Value | Use |
| --- | --- | --- |
| ground | `#F7F6F2` | page behind the panels (warm off-white) |
| surface | `#FFFFFF` | panel, cards |
| ink | `#1B1F1D` | text |
| ink-2 | `#4A524E` | secondary text (8:1 on white) |
| line | `#DAD9D2` | rules |
| action | `#1F4E79` | the primary button ("Ask for help"), links. Never ember: warm colours mean risk only. |
| danger | `#B3261E` | the 911 box border and its text only |
| example | `#E9EEF3` with a 4 px ink left bar | the Example scenario banner (cool, so it never reads as a level) |
| smoke | `#6E7C88` | smoke haze and the smoke row |
| level Low | `#E6DDBF` (sand) | no green: an unvalidated estimate should never say "safe" |
| level Medium | `#F0B43C` (amber) | ink text |
| level High | `#E36F27` (orange) | ink text (5:1) |
| level Very high | `#A8231C` (deep red) | white text (7:1) |

Level colours are **fills only**. Text is always ink (white only on Very high). Meter segments
and community discs get a 1.5 px ink outline, so sand Low stays visible on the basemap and in
greyscale print. The current code uses `LEVEL_COLORS` as a text colour in `RiskPanel.tsx:216`,
`Brief.tsx:178,182` and the `Risk.tsx` Dial. Switch those to ink, or sand and amber text will
land on white.

**Type.** IBM Plex Sans only (already bundled, weights 400 and 600). Drop `.condensed` and
Archivo from the UI; Archivo at normal width may stay for the wordmark. At 1440: status sentence
26/34, page heading 28, section heading 19/600, body 17, minimum 15. At 390: status 22/30,
body 17, minimum 14. Use tabular figures for numbers. No negative letter-spacing.

**Iconography.** Lucide in ink, at 20 px, only where an icon carries meaning: a flame (fire
marker and the nearest-fire row), a smoke cloud, phone, mail, printer, copy, search and locate.
No icon per list row, no icon on the primary button, and one icon never means two things. Map
symbols: wildfire = flame in a dark-red disc; satellite heat = 6 px orange square (a pixel, which
is what it is); community = an ink-ringed disc filled with its level colour.

**Density.** First screen: 5 facts at most, each a sentence. Detail goes in expanders ("Why, in
detail", "Details for experts"). Popovers only on the map legend. No ⓘ dots in the panel: if a
word needs an explanation, rewrite the word.

**Map and panel.** The panel is the answer; the map is context. Desktop: the panel sits flush on
the left, full height, 440 px, with a hairline border (no floating card, no shadow). The map
follows the panel: the selected community and the selected day. The day control lives only in
the panel. The map keeps zoom, a layer toggle ("Map / Satellite photo, 14 July 2026"), a legend,
and one caption at top left: "Showing Today" or "Showing Sunday 15 November (expected)". On the
community view the map zooms to level 8 with rings at 10 and 25 km.

**Risk field.** Hide Low cells. Draw Medium and above at 0.45 opacity (projectors wash out
pastels) with soft edges: try `.leaflet-hero-zones-pane svg { filter: blur(6px) }`, and fall back
to plain rectangles if panning stutters on the demo laptop.

**Motion.** A 200 ms fade on content change. A 0.8 s fly-to when a community is chosen. No
pulsing, no autoplay, no count-up numbers, and no typing animation in the assistant. Day playback
is opt-in and returns to Today. Honour `prefers-reduced-motion`.

**Levels (colour + words).** Every level shows three things: a word, a 4-step meter (1 to 4
filled segments, so it works without colour, in greyscale print and on a washed-out projector),
and optionally the number: `[▮▮▮▯] High (67 out of 100)`. Never colour alone, never a number
alone. Display words come from a label map: Low, Medium, High, Very high.

**Uncertainty, for a lay person.**
- "How sure are we?" uses three words mapped from `confidence`: High = "Fairly sure", Medium =
  "Somewhat sure", Low = "Not very sure". Add one reason: "This is example data, and our estimate
  has not yet been checked against past fires."
- Give the range as words, not numbers: "It could be anywhere from Medium to Very high." Show it
  as a bracket over the meter. Never write "Uncertainty band 53–81".
- Hatch the forecast day cells, getting lighter further out, with the caption "Further ahead is
  less certain."
- No percentages anywhere near risk or certainty. No error bands on main screens.
- Next to every level, the first time it appears: "Our estimate, not an official fire danger
  rating." Link the provincial rating (the URL comes from the contacts research).

**Imagery (NASA only; no people, no motifs).** **Asset gap, raise it today:** the only NASA
imagery is one region (Thunder Bay) on one date (14 July 2026). A community hub needs imagery per
community. Options:
- (a) A "Your community from space" card on the community view: a GIBS WMS `GetMap` true-colour
  image for a box around the community on a clear recent date. It is real, per community and free,
  but needs a hand-picked cloud-free date for each demo community.
- (b) Keep the 14 July layer as the demo's story beat: "This is what this summer looked like
  from space."
- (c) A date-matched VIIRS thermal overlay on the community map.

Recommend (a) for the 2–3 communities used in the demo and (b) in the script. Do not put the
July photo behind every community: weak or mismatched assets degrade trust.

**Names.** Use the Nation's own name first and the English or common name second. In Example
scenario mode, any real community shown "13 km from fire" must have the example banner visible on
the same screen, because screenshots travel.

---

## 3. Information architecture and wireframes

```
/                 Home: Find your community (search, "use my location", highest-risk list) + map
/c/:id            Community view: status, how sure, look ahead, why, what to do,
                  nearest fire and smoke, Ask for help. Assistant docked on the right (desktop)
/c/:id/help       Ask for help: 911 first, what you need, who to contact, letter
/c/:id/ask        Phone only: assistant as a full page (desktop shows it as a column)
/about            About the data, with Details for experts (trend tests, 42-year NASA record,
                  formula)
Redirect /brief to /c/:id/help. Take /overview, /risk, /trends, /air, /communities and /map out
of the navigation. Keep the community and the look-ahead in the URL (?ahead=3) so demo links
reproduce the same screen.
```

Height budget at 1440×900: header 56 + example banner 36 leaves **808 px**. Home has no panel
scroll. On the community view the four answers (status, how sure, what to do, Ask for help)
fit above the fold, "Ask for help" is pinned to the panel bottom, and lower sections scroll
beneath it. The phone has one page scroll and no nested scroll areas.

### 3.1 Home, 1440

```
+------------------------------------------------------------------------------------------------+
| Before the Smoke                               About the data   ( Live data | Example scenario ) |
|------------------------------------------------------------------------------------------------|
|| Example scenario, not real conditions. Fires, weather and smoke here are made up. Use live data|
|-------------------------------------+----------------------------------------------------------|
| Find your community                 |  Showing Today                  ( Map | Satellite photo )  |
| See the fire risk for the next few  |                                                          |
| days, what you can do, and who to   |           (#) Kiashke Zaaging Anishinaabek               |
| ask for help.                       |                                                          |
|                                     |    (#)          [flame]                                  |
| +---------------------------------+ |              (#) Whitesand First Nation                  |
| | First Nation or nearby town   Q | |    ~ ~ soft risk field, Low hidden ~ ~                   |
| +---------------------------------+ |                                                          |
| [ Use my location ]                 |    (#) = community, filled with its level                |
|                                     |                                                          |
| Highest fire risk, next 3 days      |                                                          |
| ----------------------------------- |                                                          |
| Whitesand First Nation              |  +---------------------------+                           |
| Ontario           [####] Very high  |  | Fire risk (our estimate)  |                           |
| ----------------------------------- |  | [#   ] Low   [##  ] Medium|                           |
| Namaygoosisagagun First Nation      |  | [### ] High  [####] Very  |                           |
| Ontario           [### ] High       |  |                     high  |                           |
| ----------------------------------- |  | [flame] Wildfire reported |                           |
| (3 more rows, then "Show all")      |  | [sq] Heat spotted by      |                           |
|                                     |  |      satellites           |                       [+] |
| Our estimate, not an official fire  |  +---------------------------+                       [-] |
| danger rating. Official rating:     |                                                          |
| <provincial link>                   |                                                          |
+-------------------------------------+----------------------------------------------------------+
```

### 3.2 Home, 390

```
+--------------------------------------+
| Before the Smoke              [Menu] |   Menu: About the data, Live data / Example scenario
|--------------------------------------|
|| Example scenario, not real          |
|| conditions.         Use live data   |
|--------------------------------------|
| Find your community                  |
| See the fire risk for the next few   |
| days, what you can do, and who to    |
| ask for help.                        |
| +----------------------------------+ |
| | First Nation or nearby town    Q | |   48 px tall, 17 px text
| +----------------------------------+ |
| [ Use my location ]                  |
|                                      |
| Highest fire risk, next 3 days       |
| Whitesand First Nation               |   whole row is the tap target
| [####] Very high from Sunday         |
| ------------------------------------ |
| Namaygoosisagagun First Nation       |
| [### ] High                          |
| ------------------------------------ |
| +----------------------------------+ |
| |  map, 260 px, does not grab the  | |
| |  scroll; tap to open full screen | |
| +----------------------------------+ |
| Our estimate, not an official fire   |
| danger rating.                       |
+--------------------------------------+
```

### 3.3 Community view, 1440 (assistant docked right)

```
+------------------------------------------------------------------------------------------------+
| Before the Smoke   [ Find a community     Q ]       About the data  ( Live data | Example )    |
|| Example scenario, not real conditions.                                          Use live data |
|---------------------------------------------+------------------------+-------------------------|
| All communities                             | map, zoom 8            | Ask a question          |
| Whitesand First Nation                      |                        | About Whitesand First   |
| Ontario                                     | Showing Today          | Nation. Answers use the |
|                                             | [ Play the next 3 days]| same data as this page. |
| Fire risk is high today. It is expected     |   ( 25 km )            |                         |
| to be very high from Sunday.                |    ( 10 km )           | [Why is the risk high? ]|
| [### ] High (67 out of 100)                 |      (#)               | [What can we do this   ]|
| Our estimate, not an official rating.       |   [flame] 13 km NW     | [  week?               ]|
|                                             |   smoke haze           | [Who can send          ]|
| How sure are we? Not very sure. This is     |                        | [  firefighters?       ]|
| example data, and our estimate has not yet  |                        | [Is the smoke safe?    ]|
| been checked against past fires.            |                        | [How sure are you?     ]|
|                                             |                        |                         |
| Look ahead  1 day [3 days] 1 week 2 weeks   |                        |                         |
| +---------+---------+---------+---------+   |                        |                         |
| | Today   | Sun 15  | Mon 16  | Tue 17  |   |                        |                         |
| | [### ]  | [####]  | [####]  | [### ]  |   |                        |                         |
| | High    |Very high|Very high| High    |   |                        |                         |
| +---------+---------+---------+---------+   |                        |                         |
| Further ahead is less certain.              |                        |                         |
|                                             |                        |                         |
| Why: hotter than last week, dry air and no  |                        |                         |
| soaking rain for 6 days. [ See all 5 signs ]|                        |                         |
|                                             |                        |                         |
| What you can do now                         |                        |                         |
| You may want to hold a readiness check with |                        | +---------------------+ |
| leadership and your local fire crew.        |                        | | Type a question     | |
| [ More ways to prepare ]                    |                        | +---------------------+ |
| [            Ask for help              ]    |  pinned to panel bottom|                 [ Ask ] |
+---------------------------------------------+------------------------+-------------------------+
  Height check (808 px): name 92, status and meter 150, how sure 66, look ahead 130,
  why 70, what to do 110, pinned button 72 = 690. All four answers fit with no scroll.
  Below the fold (scrolls under the pinned button):
  The other warning signs, each as a sentence (see §1b), and the other ways to prepare.
  Nearest fire and smoke: "Wildfire 13 km north-west, being held (example fire)".
    Smoke line: "Smoke in the air: light today." followed by the health advice from the
    preparedness research (pending), then the number.
  Your community from space (GIBS image card, option a)
  How the risk changed this week (opens the trend, plain first, experts below)
  Other communities within 50 km
Columns: panel 440, map about 640, assistant 360. The assistant can collapse to a 48 px rail.
Look ahead at 1 week: 8 cells of 50 px (weekday and date, meter, no word), with the sentence
"Highest: Very high on Sunday 15 November." above them. At 2 weeks: the same cells in two rows
of 7 and 8. Phone: always a vertical list (§3.4), which simply grows longer.
```

Example "What you can do now" copy at High, adapted from `src/actions.ts` (swap in the
preparedness research when it lands): "You may want to hold a readiness check with leadership
and your local fire crew." "Consider checking pumps, hoses and sprinklers." "Consider setting up a
clean-air room for Elders and anyone with breathing problems."

### 3.4 Community view, 390

```
+--------------------------------------+
| All communities               [Menu] |
|| Example scenario, not real.         |
|--------------------------------------|
| Whitesand First Nation               |
| Ontario                              |
|                                      |
| Fire risk is high today. It is       |
| expected to be very high from        |
| Sunday.                              |
| [### ] High (67 out of 100)          |
| Our estimate, not an official rating.|
|                                      |
| How sure are we? Not very sure.      |
| Example data, not yet checked        |
| against past fires.                  |
|                                      |
| Look ahead                           |
| (1 day|[3 days]|1 week|2 weeks)      |
| Today        [### ] High             |
| Sunday 15    [####] Very high        |
| Monday 16    [####] Very high        |
| Tuesday 17   [### ] High             |
| Further ahead is less certain.       |
|                                      |
| Why: 5 warning signs right now       |
| Hotter: today's high is 10 °C above  |
|   last week's.                       |
| Dry air: humidity is down to 29%.    |
| No soaking rain for 6 days.          |
| [ See all warning signs ]            |
|                                      |
| What you can do now                  |
| You may want to hold a readiness     |
|   check with leadership and your     |
|   local fire crew.                   |
| (2 more)  [ More ways to prepare ]   |
|                                      |
| Nearest fire and smoke               |
| [flame] Wildfire 13 km north-west,   |
|   being held. Example fire.          |
| Smoke in the air: light today.       |
| +----------------------------------+ |
| | map, 220 px, tap for full screen | |
| +----------------------------------+ |
|======================================|
| [  Ask for help  ] [ Ask a question ]|   sticky bar, 64 px, both 48 px tall
+--------------------------------------+
```

### 3.5 Ask for help, 1440

```
+------------------------------------------------------------------------------------------------+
| header + example banner                                                                    [?] |
|------------------------------------------------------------------------------------------------|
| Whitesand First Nation                                                                         |
| Ask for help before a fire starts                                                              |
| This page writes a request for you. Nothing is sent by this site: you send it yourself.        |
| +--------------------------------------------------------------------------------------------+ |
| | If there is fire or smoke near you now, call 911. Follow any evacuation order from your    | |
| | leadership or the province.                                         (danger border, 18 px) | |
| +--------------------------------------------------------------------------------------------+ |
| 1. What you need                               | 3. Your request                               |
| [x] Firefighters ready nearby                  | To: <agency email, from the official page>    |
| [x] Pumps, hoses and sprinklers for homes      | Subject: Request for wildfire help,           |
| [ ] Help clearing brush near homes             |   Whitesand First Nation                      |
| [ ] Plans and transport if people need to      |                                               |
|     leave                                      | Hello,                                        |
| [ ] Air cleaners for a clean-air room          | My name is [your name]. I am [your role] at   |
|                                                | Whitesand First Nation. Fire risk near our    |
| 2. Who to send it to                           | community is high today and expected to be    |
| +--------------------------------------------+ | very high from Sunday 15 November. We are     |
| | <Provincial fire service>                  | | asking for firefighters and pumps to be ready |
| | For firefighters and equipment.            | | by Saturday 14 November.                      |
| | Phone <from official page>                 | |                                               |
| | Email <from official page>                 | | What the data shows:                          |
| | From <page title>, checked <date>          | | - 5 warning signs right now (list)            |
| +--------------------------------------------+ | - Nearest wildfire: 13 km north-west          |
| | Indigenous Services Canada, <region>       | | Estimate from Before the Smoke, not an        |
| | For emergency support and funding.         | | official fire danger rating.                  |
| +--------------------------------------------+ |                                               |
| | Your Chief and Council                     | | [ Copy the letter ] [ Open in email ] [ Print ]|
| | Send them a copy.                          | |                                               |
| +--------------------------------------------+ |                                               |
+------------------------------------------------+-----------------------------------------------+
[?] = the assistant, collapsed to a rail on this page; it opens as the right column.
Contacts are placeholders: fill them only from the contacts research, each with its source link.
The "What you need" options and each agency's one-line role are drafts: check them against the
contacts and preparedness research before shipping.
```

### 3.6 Ask for help, 390

```
+--------------------------------------+
| Whitesand First Nation        [Menu] |
|| Example scenario, not real.         |
|--------------------------------------|
| Ask for help before a fire starts    |
| We write the request. You send it.   |
| +----------------------------------+ |
| | Fire or smoke near you now?      | |
| | Call 911. Follow any evacuation  | |
| | order.           [ Call 911 ]    | |
| +----------------------------------+ |
| 1. What you need                     |
| [x] Firefighters ready nearby        |
| [x] Pumps, hoses and sprinklers      |
| [ ] Help clearing brush near homes   |
| [ ] Plans and transport to leave     |
| [ ] Air cleaners for a clean-air room|
|                                      |
| 2. Who to send it to                 |
| <Provincial fire service>            |
| For firefighters and equipment.      |
| [ Call ]  [ Email ]                  |
| From <page title>, checked <date>    |
| ------------------------------------ |
| Indigenous Services Canada, <region> |
| [ Call ]  [ Email ]                  |
|                                      |
| 3. Your request                      |
| Your name  [____________________]    |
| Your role  [____________________]    |
| (letter preview, collapsed after the |
|  first 6 lines, "Show the whole      |
|  letter")                            |
|======================================|
| [Copy the letter] [Email] [Print]    |   sticky bar
+--------------------------------------+
```

### 3.7 Assistant, 1440 (docked column, after one question)

```
+--------------------------------+
| Ask a question       [Hide]    |
| About Whitesand First Nation   |
|--------------------------------|
| You asked                      |
| Why is the risk high?          |
|                                |
| 5 warning signs are showing.   |
| The biggest: it is 10 °C       |
| hotter than last week, the air |
| is dry, and there has been no  |
| soaking rain for 6 days.       |
| Strong wind is expected Sunday.|
| From the weather forecast and  |
| our fire risk estimate.        |
| [ Show me on the page ]        |  scrolls to and highlights "Why"
|--------------------------------|
| More questions                 |
| [ What can we do this week? ]  |
| [ Who can send firefighters?]  |
| [ How sure are you?         ]  |
|--------------------------------|
| [ Type a question      ][ Ask ]|
| Answers use the same data as   |
| this page.                     |
+--------------------------------+
```

Rules: the suggested questions map one to one to built-in answers (the demo must not depend on
Claude). Answers are at most 3 sentences, in the same voice, with a "From…" line and a link back
into the page. They appear instantly: no typing dots, no sparkle icon, no robot avatar, and no
"AI assistant" label. If the Claude path answered, add the small line "Written with Claude from
this page's data." For an unknown question: "I can answer questions about fire risk, smoke, what
to do and who to contact for Whitesand First Nation. Try one of these:" followed by the chips.

### 3.8 Assistant, 390 (full page from the sticky bar; also a section at the end of /c/:id)

```
+--------------------------------------+
| Whitesand First Nation        [Close]|
|--------------------------------------|
| Ask a question                       |
| Answers use the same data as the     |
| community page.                      |
|                                      |
| [ Why is the risk high?            ] |   full-width, 48 px, wrap text
| [ What can we do this week?        ] |
| [ Who can send firefighters?       ] |
| [ Is the smoke safe to breathe?    ] |
| [ How sure are you?                ] |
|                                      |
| (question and answer thread)         |
|                                      |
|======================================|
| [ Type a question          ] [ Ask ] |   sticky, sits above the keyboard
+--------------------------------------+
```

---

## 4. Top 15 fixes to the existing screens (grouped by file, one owner per file)

Effort: S under 30 min, M 30–90 min, L over 90 min. Priority: **P1** = seen in the live demo.

| # | File | Change | Effort | Pri |
| --- | --- | --- | --- | --- |
| 1 | `src/App.tsx` | Toggle labels "Live data" / "Example scenario". Add a full-width banner under the header on every route (36 px, 15 px text): "Example scenario, not real conditions. Fires, weather and smoke here are made up." with a "Use live data" button. Remove the triangle logo SVG and keep the wordmark. | S | P1 |
| 2 | `src/components/HeroMap.tsx` | Rest on Today. Delete the autoplay effect (lines 103–110). Playback becomes opt-in ("Play the next 3 days") and ends at `todayIdx`, not `lastIdx` (line 117). This fixes 77 on the map vs 67 in the panel. | S | P1 |
| 3 | `src/components/HeroMap.tsx` | Remove the map's `HorizonSelector` (274), the "PREDICTED" caps label (287), the `pillDay` single-letter pills and the day-pill bar. Add one caption chip at top left: "Showing Today" / "Showing Sunday 15 November (expected)" (no middle dot). The play button moves into that chip as "Play the next 3 days". The map reads the selected day from `state.tsx` (fix 10) instead of its local `dayPick`. Rename the layer toggle "Map" / "Satellite photo, 14 July 2026". | S | P1 |
| 4 | `src/components/HeroMap.tsx` | Fire popup (`Card`, lines 234–243): sentences from the fire-popup table in §1b. Distance and direction from the selected community; hectares shown as km²; no coordinates, codes or "Source:" labels. Fire markers static (drop `fire-pulse`), drawn as a flame `divIcon`; satellite heat as small squares. | M | P1 |
| 5 | `src/components/HeroMap.tsx` | Replace the region-score tooltips (lines 213–231) with community markers filled with their level (from the one-number API). Label the selected community with the Nation's own name (fix `shortName`, line 52). Legend: title "Fire risk (our estimate)", glossary words, Low hidden on the map. Soften the zone edges (see §2). | M | P1 |
| 6 | `src/components/ui.tsx` | `InfoPopover`: render via `createPortal(document.body)` with `position: fixed` from `getBoundingClientRect`. This ends the clipping and the horizontal scrollbar in the panel (`critique-home-popover`). Content: title, one plain sentence, a small "From …" line. Delete "What: / Source: / How to read:". 15 px text. Use only on legend items. | M | P1 |
| 7 | `src/explain.ts` | Change the shape to `{ title, plain, from, expert? }`. `plain` is one grade 6–8 sentence. Formula weights, thresholds, MW, AOD, p-values go in `expert`, shown only on /about. No "Critical", "Moderate", "predicted" or "index" in `plain`. | M | P1 |
| 8 | `shared/risk.ts`, `shared/signals.ts` | Add `LEVEL_LABEL = { Low: 'Low', Moderate: 'Medium', High: 'High', Critical: 'Very high' }` and use it for every displayed level (do not rename the type). Set `LEVEL_COLORS` to the §2 ramp, and in the same change switch its text uses to ink (`RiskPanel.tsx:216`, `Brief.tsx:178,182`, `Risk.tsx` Dial). Add `activeSignCount()` used by the panel, letter and assistant, so "5 warning signs" is the same everywhere (count the outlook sign everywhere or nowhere). | S | P1 |
| 9 | `src/components/RiskPanel.tsx` | Lead with the sentence ("Fire risk is high today. It is expected to be very high from Sunday."), then the meter and "High (67 out of 100)" at 17 px. Delete the 76 px number, the TrendingUp and Truck icons, and "Pre-position crews…". Add "How sure are we?" from `confidence` (§2). Show "Our estimate, not an official rating." once. | M | P1 |
| 10 | `src/components/RiskPanel.tsx` + `src/state.tsx` | Add the selected `day` to `state.tsx` next to `horizon`, so the panel and the map share one day. Tapping a cell selects it and the map follows. `DayStrip` becomes "Look ahead" cells: weekday and date, meter, level word (1 week and 2 weeks per the note under §3.3); forecast cells hatched; caption "Further ahead is less certain." Remove the inline `HorizonSelector` and ⓘ (line 96), the bracket label, and the Past/Today/Predicted popover legend (148–152). "See trend" becomes "How the risk changed this week". | M | P1 |
| 11 | `src/components/RiskPanel.tsx` | Warning-sign strings in `signText()` per the §1b table, with heading "Why: 5 warning signs right now". Icons ink-coloured or removed (stop reusing `CloudOff`). "+3 more" becomes a real button. "Send situation brief" becomes "Ask for help": action blue, no icon. Fix `shortName` (line 60) to keep the Nation's own name. | S | P1 |
| 12 | `src/pages/Home.tsx` | Desktop: the panel flush left, full height, 440 px, `overflow-x-hidden`, no `rounded-2xl` or shadow. Phone: a single page scroll (no `overflow-y-auto` aside), search first, map 260 px below the list, the map not capturing scroll. | M | P1 |
| 13 | `src/components/TrendSheet.tsx`, `HistoryContext.tsx` | Plain answer first in each block. Mann–Kendall, R², p, Sen's slope and the 95 % band go into `<details>` "Details for experts". Fix `signed()` so a value under 0.05 in size reads "No real change". Use one temperature normal in both files: today TrendSheet uses the July monthly mean (`r.climate.tempC`, 22.7 °C) and HistoryContext uses the mid-July window mean (`t.window.mean`, 25 °C). Pick the mid-July window and say so. Y axis "Fire risk, out of 100" with level words. Title without a colon. In example mode: "This example is set in mid-July." The "87%" card becomes "Hotter than 87 in every 100 mid-July days since 1984". | M | P2 |
| 14 | `src/pages/Brief.tsx` | Becomes Ask for help (`/c/:id/help`, §3.5): 911 box first; agency cards from the contacts research with source links; name and role fields; editable letter; one community (or sorted by distance, not alphabetically, line 122), with the Nation's own name. Remove "Move before ignition" and "← Back to map". Buttons: "Copy the letter", "Open in email", "Print or save as PDF". | L | P1 |
| 15 | `src/styles.css` | Apply the §2 tokens. Remove `.condensed` from the UI (9 files use it; grep `condensed`). Remove the `.fire-pulse` keyframes. Body 17 px. Raise every `text-[11px]`, `text-[12px]` and `text-[12.5px]` on the hub screens (RiskPanel 4, HeroMap 6, ui 4, HorizonSelector 1) to the §2 minimums. Ground `#F7F6F2` behind the panels. | S | P1 |

Not in the top 15, but do if there is time: retire `Risk.tsx`, `Overview.tsx`, `Trends.tsx` and
`Air.tsx` from the navigation, with their content under /about "Details for experts". In
`Risk.tsx`, "Confidence: Low" in mustard reads as a risk level, so show it in ink with words.
Make the phone header a menu.

**Before calling it done** (per the standing instructions): screenshot home, community view and
Ask for help at 390, 768 and 1440. Put them side by side with Watch Duty and a GOV.UK service
page, and check that nothing reads as a template, that no number appears without its sentence,
and that the panel's score matches the map for the same community and day.
