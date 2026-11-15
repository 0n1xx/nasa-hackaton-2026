# Community hub rebuild — plan, checklist and voice guide

Branch: `community-hub` (from `main` at `5ade6c0`, tagged `demo-stable-2026-11-14`).
Merge to `main` only after the final checks pass. Deadline: commit and push by 04:00. Feature freeze 02:30.

## Who this is for

A member of a First Nation whose home has been threatened by fire in recent summers. They open the site on a phone or the band office computer and need four answers fast:

1. Is fire coming near us, and when?
2. How sure are you, and why?
3. What do we do now?
4. Who do we contact to get firefighters and equipment here before it starts?

Second audience: the people they contact (provincial fire service, Indigenous Services Canada, leadership). Third: NASA Space Apps judges watching a 5-minute live demo.

## Product shape

- Keep the map-first home. Add **Find your community** (search) as the main entry.
- **Community view** (one place, one number): plain-language status, how sure, why (warning signs, 42-year NASA context), what to do now, nearest fires and smoke, and the main action **Ask for help**.
- **Ask for help**: builds a request for firefighting resources addressed to the right agencies for that province, with the evidence attached. Nothing is sent by the site; the person copies, emails or prints it and fills in their own name and role. Contacts come only from fetched official pages (with links). 911 and official evacuation orders first.
- **Assistant**: part of the page (a docked panel), knows which community is open. Built-in answers from the same data functions as the page (works offline, no key). Optional Claude answers when `ANTHROPIC_API_KEY` is set; any failure falls back silently to built-in answers.
- One risk number per place: compute at the community's location and feed page, map, assistant and request from it.

## Voice guide (every string in the UI follows this)

- Plain, warm, direct. Short sentences. Everyday words. Reading level of a grade 6–8 text.
- Speak to the reader: "your community", "you can".
- Lead with a sentence, then the number. Numbers are secondary: "High (67 out of 100)".
- Never say we predict a fire will start. Say "fire risk is expected to be very high on Sunday".
- Always clear about what is an estimate: "our estimate, not an official fire danger rating". Point to the official provincial fire danger rating where relevant.
- Communities decide. Use "you may want to", "consider", never commands to a community or its leadership. Do not speak for any Nation.
- No jargon on main screens. Statistics live one click deeper, introduced in words first: "Is this rise real? Yes, it is very unlikely to be chance." then "(Mann–Kendall trend test, p = 0.002)".
- No ALL CAPS labels, no "What: / Source: / How to read:" form labels, no middle-dot chains, no arrows appended to buttons.
- Simulated data is always called out: "Example scenario, not real conditions".

## Glossary (UI words)

| Code / old word | Say in the UI |
|---|---|
| risk index, score | fire risk (score out of 100 as secondary detail) |
| Low / Moderate / High / Critical | Low / Medium / High / Very high |
| predicted, forecast day | expected (e.g. "Expected Sunday: Very high") |
| horizon, 1d 3d 7d 14d | "Look ahead: 1 day, 3 days, 1 week, 2 weeks" |
| warning signs active 5 of 6 | "5 warning signs right now" |
| satellite detections / hotspots | "heat spotted by satellites" |
| active fire, stage OC/BH/UC/EX | "wildfire reported by fire crews": out of control / being held / under control / out |
| PM2.5, US AQI | "smoke in the air" with plain health advice; the number second |
| Simulated mode | "Example scenario" (toggle: "Live data" / "Example scenario") |
| Situation brief | "Ask for help" (the request letter) |
| Mann–Kendall, p-value, R², Sen's slope | only under "Details for experts" |
| VPD, soil moisture | "how dry the plants are", "how dry the ground is" |

## Waves and checklist

- [x] Tag `demo-stable-2026-11-14`, branch `community-hub`
- [ ] Wave 1 (parallel): independent design critique of screenshots; research official contacts and request process per province + federal; research preparedness guidance (sources)
- [ ] Wave 2 (parallel, one owner per file): community data + one-number API; community view UI; ask-for-help flow; assistant (built-in + optional Claude); plain-English pass over all strings and `src/explain.ts`; popover fixes
- [ ] After each wave (me): click-through, panel overflow at 1440×900 and 390, typecheck, tests, build
- [ ] Wave 3: visual cleanup from the critique; design review against references; code review
- [ ] Rewrite script and guide for the new flow; README
- [ ] Fresh clone, `npm ci`, build, start, smoke test
- [ ] Merge to `main`, push `main` and the tag

## Facts and constraints

- No Anthropic credentials on the build machine: the Claude path cannot be tested here; built-in answers must cover the demo.
- Use only public, already-published community locations. No cultural or land-use data. No stock or generated images of people, no Indigenous motifs. NASA imagery is the visual.
- Risk index is unvalidated (see `shared/risk.ts`). Show levels, never a percent chance of fire.
