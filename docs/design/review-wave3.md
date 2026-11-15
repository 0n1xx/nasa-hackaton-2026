# Before the Smoke: wave 3 design review

Independent visual and UX review, 14 November 2026, before the live demo (1440×900 projector) and real use on
phones. I read it against `docs/plans/2026-11-14-community-hub.md` (voice guide) and
`docs/design/critique-and-direction.md` ("a public notice, not a dashboard").

**Evidence.** The screenshots in `.playwright-mcp/` are `hub-home-1440`, `hub-community-asked`, `hub-help-1440`,
`hub-home-390` and `hub-community-390`, checked against the current code. Each issue says whether I saw it on screen
or found it in the code. The blank band in both 390 shots comes from the tall capture viewport, not from the layout,
so I judged the phone by its first ~750 px. **Not reviewed:** the 768 layout, About, live-data mode, print, and the
full letter body (I checked only the `NEEDS` labels and the example marks).

**Verdict.** The panel now reads like a public notice: a sentence first, then the meter and the word, honest
uncertainty, and blue reserved for actions. The weak spots are the map, the example scenario's dates, and the text
that will be read aloud on the projector. All 12 fixes below are S except #1.

**If only three get done:** #1 (the S part: recentre and size the dots by level), #2 and #3.

---

## Issues, ranked by impact on (1) the live demo and (2) a community member on a phone

### 1. Home map: half empty, a carpet of identical dots, and a third of communities missing (demo, phone)

- **Seen in** `hub-home-1440` (layout). Coverage comes from the code and data.
- **Wrong:** The opening frame spends its top 40% on the empty Arctic. About 440 identical 12 px discs and a field of
  blurred rectangles cover the rest, while 201 of the 638 communities never appear at all: ON 64, BC 45, QC 25, YT 23,
  NB 18, NS 11, NT 8, NL 5, PE 2. They are outside `MAP_AREA` (48–62° N, 126–70° W), so they are missing from the map
  and the ranked list. "Use my location" also tells someone in southern Ontario "We could not find a community near
  you", even though search finds their community.
- **Fix:**
  - `HeroMap.tsx:27,246`: on home (no `focus`), frame the covered area with
    `map.fitBounds([[48,-126],[62,-70]], { padding: [24,24] })` and set `zoomSnap={0.25}`, instead of centring on
    58° N at zoom 4.
  - `HeroMap.tsx:345`: when there is no focus, size the discs by level. Low: radius 3.5. Medium: radius 4.5. High: 6.
    Very high: 7. Keep the 1.5 px ink ring on every level, because direction §2 rings them so sand stays visible.
    Only the places that matter should stand out. The small discs are hard to tap on a phone, but the phone map is
    covered by "Open the map" anyway (#8).
  - `HeroMap.tsx:311` and `styles.css:145`: on home, set the field to `fillOpacity 0.25` and `blur(12px)`. The
    direction (§2) said 0.45 and 6 px, but at zoom 4 the 1°×1.5° cells still read as rectangles, and the discs already
    carry the level.
  - `server/ranked.ts:15`: widen `MAP_AREA` to `{ latMin: 41.5, latMax: 69.5, lonMin: -141, lonMax: -52 }`. That is
    about 640 points, or 16 Open-Meteo calls instead of 11, so time live mode once. Once it is widened, keep the home
    view on the 48–62° N band, where most communities and the risk are, and let people pan out.
  - If you don't widen it, put one line under the map and the list: "This map does not yet show communities in the
    North, the Atlantic provinces or southern Ontario and Quebec. Search finds them all." Also fix
    `FindCommunity.tsx:13`: with `NEAR_KM = 300`, someone just outside the box is silently sent to another Nation's
    page, which is worse than the error message. Drop it to about 100 km, or say "The nearest community we have
    is …" before opening it.
- **Reference:** Watch Duty opens on the area that matters, and only notable things are loud.
- **Effort:** M (S without the coverage change).

### 2. The example scenario puts July fire weather on November dates (demo)

- **Seen in** `hub-community-390` and `hub-community-asked`.
- **Wrong:** In northern Ontario in mid-November, the screen says "very high" fire risk, "Sun 15 / Mon 16 / Tue 17",
  heavy smoke, and "hotter than 96 of every 100 mid-July days". A Canadian judge will read that as broken, not as an
  example. Pressing Play also shows "Showing Sunday 15 November (expected)".
- **Fix:**
  - `App.tsx:28`: keep "made up" (every value is invented, as `explain.ts:236–237` says) and add the setting: "Fires,
    weather and smoke here are made up, for a summer day in mid-July shown on today's dates. The NASA satellite photo
    is real." Remove `hidden sm:inline` so phones see a short version too: "Made up, set in mid-July."
  - `words.ts:209–210`: in example mode, add "This example is set in mid-July." to the end of `historySentence`, as
    `TrendSheet.tsx:243` already does. The glossary term "Example scenario" stays.
- **Reference:** the GOV.UK phase banner says in one line what kind of thing you are looking at.
- **Effort:** S.

### 3. The assistant answer the projector shows is long, uses an acronym and breaks an email address (demo)

- **Seen in** `hub-community-asked`.
- **Wrong:** The answer to "Who can send firefighters?" is three sentences but about 75 words. It says "(AFFES)" twice
  (in the text and in a button). It also puts a raw address in the prose, which wraps as `emergencyon-` /
  `urgenceon@sac-isc.gc.ca` and looks like a typo at projector size.
- **Fix:**
  - `shared/assistant.ts:58`: change the agency to "Ontario's forest fire service". Also `:60`: "the Saskatchewan
    Public Safety Agency (SPSA)" becomes "the Saskatchewan Public Safety Agency", and `:64`: "SOPFEU" becomes "SOPFEU,
    Quebec's forest fire service".
  - `:309`: drop `(${iscWays})` from the sentence. The "Email Indigenous Services Canada Ontario" button below already
    carries the address.
  - At the same time, make `:313–314` two independent `if`s, so regions with both a phone and an email (Alberta, BC,
    Quebec, Yukon, Atlantic) get both a Call button and an Email button. Otherwise dropping `iscWays` loses their
    phone number.
  - `:312`: change the label `Official page: …` to `${agency} website`, so there is no colon label.
  - Update `shared/assistant.test.ts:101`: assert the email in `on.actions` (a `mailto:` target), not in `on.text`.
    `:100` (French and Mattawa) can stay.
- **Reference:** Apple Weather and GOV.UK give a short answer and put contact details in buttons, not prose.
- **Effort:** S.

### 4. A wildfire and a "Very high" community are the same red disc (demo, phone)

- **Seen in** `hub-community-asked` (map) and `hub-home-1440` (the south-east Ontario cluster).
- **Wrong:** Fire markers and Very high community discs are both `#A8231C` discs. The 13 px white flame is the only
  difference, and you can't see it from the back of a room or on a small screen.
- **Fix:** The direction (§2 Iconography) said "flame in a dark-red disc". On screen that clashes with the Very high
  fill, so change it to an ink disc. Set `styles.css:152` `.hero-fire-icon` and `:153` `.hero-fire-key` to
  `background: #1b1f1d`, and keep the white flame. This also keeps the palette rule that warm colours mean risk only.
- **Reference:** Watch Duty gives fires their own icon that no other layer shares.
- **Effort:** S.

### 5. No NASA imagery on any default screen of a NASA demo (demo)

- **Seen in** all five shots. The toggle behaviour is from the code.
- **Wrong:** The only NASA visual sits behind a toggle. On the community view that toggle reads just "Satellite
  photo", with no date (`HeroMap.tsx:402`), and for any community it flies away to Thunder Bay (`HeroMap.tsx:244`).
  People can read it as a current photo of their own community.
- **Fix:** This is an asset gap, so raise it with the lead today. Options:
  - (a) Zero code: in the demo script, open the community view with `?nasa=1` (`HeroMap.tsx:166`) as the story beat:
    "This is July from space. The named communities are the Nations ordered to leave that month." Not seen in any
    hub shot, so capture it at 1440 first.
  - (b) S: always show the date ("Satellite photo, July 2026" when narrow). On a community view more than about 300 km
    from the photo's area, hide the toggle.
  - (c) M, after the freeze: the direction's "Your community from space" card, a GIBS `GetMap` true-colour image on a
    hand-picked clear date for the 2–3 demo communities.

  Recommend (a) and (b) now.
- **Reference:** Watch Duty's satellite layers always carry their timestamp.
- **Effort:** S.

### 6. Ask for help: steps read "1, 3", and the letter's buttons are far below the fold (demo)

- **Seen in** `hub-help-1440` (numbering, cut-off placeholder). Button position is from the code.
- **Wrong:** At 1440, "1. What you need" sits beside "3. Your request" (step 2 is hidden lower in the left column).
  Copy, Email and Print sit under a 736 px textarea, about 1,100 px below the first screen, so the payoff never appears
  without a long scroll. The role placeholder is cut off at "For example, emergency coord".
- **Fix:**
  - `AskForHelp.tsx:201,215,235`: drop the numbers. The direction (§3.5) numbered them, but the two-column layout
    breaks the order.
  - Move `actions(false)` from `:265` to just after the To/Subject block (`:254`), and cap the textarea at
    `lg:h-[28rem]` (`:258`).
  - `:240`: change the placeholder to "For example, fire chief".
- **Reference:** GOV.UK step numbers follow the reading order, and the main action sits next to the thing it acts on.
- **Effort:** S.

### 7. The look-ahead hatching runs behind the words (demo, phone)

- **Seen in** `hub-community-asked` and `hub-community-390`.
- **Wrong:** Red diagonal stripes run under "Sun 15 / Very high", which lowers contrast on a washed-out projector and
  on a phone in sunlight. It reads as a texture effect.
- **Fix:** The direction (§2) asked for hatched forecast cells. On screen the hatch sits behind the text, so:
  - Keep the forecast cells white and confine the hatch to an 8 px band at the top. Add a new class `.hatch-band`
    (the `.hatch` rule plus `background-size: 100% 8px; background-repeat: no-repeat;`) and use it in
    `LookAhead.tsx:17`. Leave `.hatch` itself alone, because `RiskStrip.tsx:67,97` uses it.
  - Cap the alpha at 30%.
  - Keep "Further ahead is less certain."
- **Reference:** Apple Weather's daily rows: plain text on a plain background.
- **Effort:** S.

### 8. Phone maps are mostly controls, and the community map traps the scroll (phone)

- **Seen in** `hub-home-390` and `hub-community-390`. The scroll trap is from the code.
- **Wrong:**
  - The 260 px home map carries five controls (layer toggle, Showing/Play, Map key, zoom, Open the map), leaving about
    80 px of map.
  - On the 220 px community map, the chip covers the community's own label ("wnitesand First Natio").
  - That community map has no cover (`Community.tsx:89`), so a thumb swipe over it pans the map instead of scrolling
    the page.
- **Fix:**
  - `HeroMap.tsx`: when `size.h < 300`, render no top bar (`:385–407`), no legend (`:410–445`) and no `ZoomControl`
    (`:295`). Keep only the focus label.
  - `Community.tsx:89`: reuse Home's cover and full-screen pattern (`Home.tsx:10–38`), with the button "Open the map".
- **Reference:** Apple Weather's map tile is a still preview inside the scroll, and a tap opens the full map.
- **Effort:** S.

### 9. The community view never says "call 911" (phone)

- **Seen in** `hub-community-390`: no 911 line anywhere on the page. The rest is from the code.
- **Wrong:** A person who sees "Very high" and "Wildfire 13 km south-west" gets advice about meetings, but no 911 line.
  That line lives only on Ask for help, and the "Not an emergency alerting service" footer (`App.tsx:84–90`) renders
  only on reading pages, not on `/` or `/c/:id`.
- **Fix:**
  - `Community.tsx:75`: right after `<StatusBlock />` (StatusBlock itself unchanged), add a one-line callout that
    shows when today is High or above, or a fire is within 25 km. On desktop it uses about 30 px of the room that
    #12 frees. It reads "Fire or smoke near you now? Call 911 and
    follow any evacuation order." and links to `tel:911`.
  - Add the prototype disclaimer line at the end of the community body and of the home panel (`RiskPanel.tsx:100`).
  - While there: the phone header hides "About the data" (`App.tsx:47`, `hidden sm:inline`), so add that link to the
    end of the home panel.
- **Reference:** Canada.ca hazard pages open with "If you are in immediate danger, call 911."
- **Effort:** S.

### 10. Words a 12-year-old won't know (phone)

- **Seen in** `hub-community-390` and `hub-community-asked`. The popovers are from the code.
- **Wrong:** The main screens still use "µg/m³", "US air quality index 363", an unexplained "being held", "go-bags",
  "readiness check" and acronyms. Two legend popovers also describe symbols that no longer exist.
- **Fix:** The replacements are in the word list below. Files:
  - `words.ts:217` and `words.ts:275–277`
  - `WhatToDo.tsx:35,41,48`
  - `shared/assistant.ts:248,389,412–419`: changing the smoke wording means updating `shared/assistant.test.ts:122`,
    which asserts `/US air quality index \d+/`.
  - `src/explain.ts:93`: the popover promises "bigger, redder dots", but every heat square is the same 6 px orange.
  - `src/explain.ts:110`: the community popover never says the fill colour is its fire risk.

  `shared/letter.test.ts:123` asserts "being held" in the letter. That comes from `letter.ts`, not `words.ts`, so it
  is unaffected. Leave the letter's wording alone, since agencies know the term.
- **Reference:** GOV.UK content design writes for a low reading age and spells out or drops acronyms.
- **Effort:** S.

### 11. The map controls are floating pills with shadows; the panel's are flat squares (demo)

- **Seen in** `hub-home-1440` and `hub-community-asked`.
- **Wrong:** One screen mixes two control styles. The panel uses square, bordered segmented controls. The map and
  header use `rounded-full` pills with `shadow-lg` and `shadow-md` cards, the stock shadcn look that direction §1a
  item 4 flagged. On the 640 px community map, the open key covers about a third of the map, and its "Community"
  swatch is orange (High), which suggests every community is orange.
- **Fix:**
  - In `HeroMap.tsx:287,387,390,393,399,405,410`, use `rounded-md border border-edge bg-white` with `shadow-sm` at
    most.
  - `App.tsx:48–50`: build the header toggle the same way as Look ahead (`LookAhead.tsx:45`).
  - `HeroMap.tsx:200`: change the `roomyKey` test to `visibleW >= 800`, so the key starts collapsed on the community
    map.
  - `HeroMap.tsx:430`: use a white swatch with an ink ring and the label "Community (filled with its fire risk)".
- **Reference:** GOV.UK and Canada.ca use one flat, bordered control style per page.
- **Effort:** S.

### 12. At 1440×900, the third answer is below the fold and grey scrollbars sit mid-screen (demo)

- **Seen in** `hub-home-1440` and `hub-community-asked`.
- **Wrong:**
  - The home panel overflows 808 px, so a Windows scrollbar sits mid-screen and "Our estimate, not an official fire
    danger rating" is off-screen.
  - On the community view, "What you can do now" starts below the fold, and the pinned footer cuts "Why" in half.
  - Two scrollbars show there, the panel's and the assistant's, each in the middle of the projected screen.
- **Fix:**
  - `RiskPanel.tsx:15`: set `SHORT` to 5 from `md` up. This saves about 64 px, roughly the size of the overflow in
    the shot, so verify at 1440×900. If it still scrolls, tighten the row padding at `RiskPanel.tsx:46` from `py-2`
    to `py-1.5`.
  - `Community.tsx:76–78`: order the body Status, How sure, What you can do now, Look ahead, Why. The direction (§3.3)
    put Look ahead first, but on screen its four cells push answer 3 off the first screen, and the status sentence
    already says when. `body()` is shared, so phones get the same order. That suits phones too, because the action
    comes sooner.
  - Add `.quiet-scroll { scrollbar-width: thin; scrollbar-color: var(--color-line) transparent; }` to `styles.css`
    and apply it at `Home.tsx:22`, `Community.tsx:101` and `Assistant.tsx:189`.
- **Reference:** GOV.UK has no nested scroll areas; the page scrolls once.
- **Effort:** S.

---

## "Looks AI" tells that remain

1. Floating pill controls with drop shadows over the map and in the header (§1a item 4). See #11.
2. Blurred-rectangle risk field at national zoom, still a generated-looking heat map (§1a item 7). See #1.
3. About 440 identical outlined discs ("dot soup") as the first thing on the projector. See #1.
4. Diagonal hatch texture behind text in the day cells. See #7.
5. A colon label ("Official page: …") on a stack of identical outlined buttons in the assistant. See #3.

Gone, and good: the giant number, icons on every row, pulsing dots, the clip-art logo, and the sparkle or robot
avatar in the assistant.

## Words a 12-year-old wouldn't understand

| On screen | Where | Say instead | Issue |
| --- | --- | --- | --- |
| "fine smoke particles 311 µg/m³, US air quality index 363" | `words.ts:275–276` | "Smoke reading: 363 on the US air quality scale (over 300 is the worst level)." Move µg/m³ to About. | #10 |
| "US air quality index 363" (assistant smoke answer) | `assistant.ts:412–419` | the same wording as above | #10 |
| "being held" | `words.ts:217` | "being held: not expected to spread for now" | #10 |
| "AFFES", "SPSA" | `assistant.ts:58,60` | "Ontario's forest fire service", "Saskatchewan's wildfire agency" | #3 |
| "go-bags" | `WhatToDo.tsx:41,48`, `assistant.ts:248` | "a packed bag for each person, ready to grab" | #10 |
| "readiness check" | `WhatToDo.tsx:35`, `assistant.ts:389` | "a meeting with leadership and your local fire crew to check you are ready" | #10 |
| Popover: "bigger, redder dots give off more heat" | `explain.ts:93` | "A small orange square is a spot hot enough to be a fire, seen from space. Not every spot is a wildfire." | #10 |
| Popover: "The general location of a First Nation…" | `explain.ts:110` | "Each circle is a First Nation or Métis Settlement, filled with its fire risk colour." | #10 |

Left as is: "Example scenario" (fixed by the glossary; #2 explains it), "evacuation order" (in the 911 box, which must
not change; the audience knows the word) and "N95".

## Two things that must not change

1. **The status block** (`StatusBlock.tsx` with `words.ts` `statusSentence` and `howSure`). It runs: sentence first,
   then the 4-step meter, the word and "(75 out of 100)", then "Our estimate, not an official fire danger rating"
   with the official link, then "How sure are we? Not very sure." with a reason and a range in words. It is more
   honest than any of the references, and it works in greyscale on a washed-out projector. #9 adds a line after this
   block and #12 moves the sections below it; neither edits it.
2. **The safety-and-honesty frame of Ask for help.** It covers four things:
   - 911 first, with the province's report line, its source and its "checked" date.
   - "Nothing is sent by this site: you send it yourself."
   - Contacts only from official pages.
   - The example letter marked "EXAMPLE ONLY" with an empty To line.

   #6 changes only the step labels, where the actions sit and the textarea height; `EmergencyBox` and the letter's
   marks stay as they are.
