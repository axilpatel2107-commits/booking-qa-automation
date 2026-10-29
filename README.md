# Booking QA Automation

[![CI](https://github.com/axilpatel2107-commits/booking-qa-automation/actions/workflows/ci.yml/badge.svg)](https://github.com/axilpatel2107-commits/booking-qa-automation/actions/workflows/ci.yml)

This is a complete test automation setup for an appointment booking app: UI tests, API tests, accessibility checks, a JMeter load test and a CI pipeline that runs all of it.

Most of my day job is testing booking and scheduling systems, so I built this around the same kind of problems: double-bookings, slots disappearing while someone is filling a form, users seeing each other's data, and what happens when a lot of people hit the system at once.

The app under test (**SlotBook**) is a small demo I wrote and included in the repo, so everything runs locally or in CI with no external dependencies.

---

## What's covered

**UI (Playwright + TypeScript)**
- Sign in, sign out, validation, and making sure empty forms don't call the API at all
- Booking a road test end to end, then checking the backend actually saved it
- A race condition: another user takes the slot while you're still filling in the form
- My bookings: list, cancel (with confirm dialog), dismiss, empty state
- Key flows also run on a mobile viewport (Pixel 7)

**API (Playwright request context)**
- Full CRUD on bookings plus contract checks on the response shape
- Authorization: user A can't read, change or cancel user B's booking (returns 404, not 403, so IDs can't be probed)
- Double booking returns 409
- Boundary values: the 1–21 day booking window, 2 and 60 character names
- Data-driven validation cases, and malformed JSON returning a clean 400

**Accessibility**
- axe-core scan against WCAG 2.1 AA on the main screens
- Keyboard-only check on the booking form

**Performance (JMeter)**
- Realistic user journey: log in → browse → check slots → book → cancel, with think time
- Response time SLA assertion on every request
- A small Node script turns the results into a pass/fail gate for CI (error rate ≤ 1%, p95 ≤ 500 ms), because JMeter exits 0 even when assertions fail

**CI (GitHub Actions)**
- Typecheck → Playwright tests → JMeter load test
- Runs on every push and PR, plus weekday mornings
- HTML reports, traces, JUnit XML and the JMeter dashboard are uploaded as build artifacts
- Load test size can be changed when triggering a run manually

**AI-assisted testing**
- Playwright's planner, generator and healer agents are set up with the Playwright MCP server
- See [docs/ai-workflow.md](docs/ai-workflow.md) for how I use them, and where I don't trust them

---

## Run it

You need Node 20+.

```bash
npm install
npx playwright install chromium

npm test              # everything (starts the app for you)
npm run test:api      # API only, takes a few seconds
npm run test:smoke    # quick smoke set
npm run test:a11y     # accessibility only
npm run report        # open the last HTML report
```

To look around the app yourself: `npm start`, then open http://localhost:3000 and sign in with `demo@slotbook.test` / `Demo123!`.

**Load test** (needs [JMeter 5.6+](https://jmeter.apache.org/download_jmeter.cgi) and Java 17):

```bash
npm start                         # in one terminal
npm run perf                      # in another
USERS=50 DURATION=120 npm run perf
```

The dashboard is written to `performance/report/index.html`.

**Testing another environment:** set `BASE_URL` and Playwright will skip starting the local app.

```bash
BASE_URL=https://staging.example.com npm test
```

---

## Project layout

```
app/                  SlotBook demo app (Express + plain JS)
pages/                Page objects: LoginPage, BookingPage, MyBookingsPage
fixtures/             Custom fixtures: page objects, API clients, auto-cleanup
utils/                API client, test data builders, shared assertions
tests/
  setup/              Signs in once and saves the session
  ui/                 Browser tests
  api/                API tests
  seed.spec.ts        Starting point for the AI agents
performance/          JMeter test plan
scripts/              JMeter runner and results gate
specs/                Test plans written by the planner agent
.claude/agents/       Playwright planner / generator / healer
.github/workflows/    CI pipeline
```

---

## Some decisions worth explaining

- **Set up through the API, assert through the UI.** If a test is about cancelling, it creates the booking via the API first. That keeps UI tests fast and focused, and a broken booking form only fails the tests that are about the booking form.
- **Every API test gets its own fresh user.** No shared state between tests, so they can run in parallel in any order.
- **Tests clean up after themselves.** A `cleanup` fixture cancels anything a test created, even if the test fails halfway.
- **Locators use roles and labels,** the same way a screen reader sees the page. That makes them more stable, and if a test can't find a button by its name, a real user with assistive tech probably can't either.
- **The mobile tests earned their keep on the first CI run.** On a phone-sized screen the Cancel button in My bookings was pushed off the edge of the screen. It passed on my machine because of font differences, and failed on the Linux CI runner. I fixed the layout so bookings show as cards on small screens, and added a regression test that checks the button stays fully on screen.
- **No hard waits.** Everything waits on a real condition, like the right slot list being rendered. The suite passes 3× in a row with 4 parallel workers (`--repeat-each=3`).

---

## About me

I'm a QA Automation Engineer based in Ontario, Canada, with 4.5+ years testing booking, scheduling and internal systems in a government-services setting.
I'm open to freelance work on [Upwork](https://www.upwork.com/freelancers/~01e9131374bdd27f50).
