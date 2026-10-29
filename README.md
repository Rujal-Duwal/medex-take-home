# MedEx take-home

One Next.js app for all three tasks: `/services` (service explorer), `/cart` (cart and split checkout) and `/booking` (booking across time zones).

## How to run

You need Node 24 (the version is pinned in `.nvmrc`) and npm.

```sh
nvm use        # or install the version in .nvmrc another way
npm install
npm run dev    # http://localhost:3000
```

| Command                           | What it does                                                                                                                                                                  |
| --------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `npm run dev`                     | Runs the app locally at http://localhost:3000                                                                                                                                 |
| `npm run build` then `npm start`  | Production build, then serves it                                                                                                                                              |
| `npm run check`                   | Lint, type check and tests together. CI runs these plus the build.                                                                                                            |
| `npm run lint`                    | ESLint with strict type-checked, accessibility and the same Sonar rules as SonarQube for IDE, plus the "data only through the mock API" rule. Fails on any warning (ADR 0012) |
| `npm run typecheck`               | Generates Next's route types, then runs the TypeScript compiler                                                                                                               |
| `npm test` / `npm run test:watch` | Vitest, once or in watch mode                                                                                                                                                 |
| `npm run bench`                   | Vitest benchmarks: the Task 1 engine over the real data (see Performance)                                                                                                     |
| `npm run format`                  | Prettier over the code (the docs, data and design folders are left alone)                                                                                                     |
| `npm run audit:data`              | Checks the data audit counts in the specs (not implemented yet)                                                                                                               |

## Why all three tasks

## Architecture

How the app is put together, and why: [docs/ARCHITECTURE.md](docs/ARCHITECTURE.md). The big decisions each have a record in [docs/adr/](docs/adr/).

## Task 1

### Decisions

### Data mistakes and what the customer sees

### Trade-offs

### Left out and next

### Tests

## Task 2

### Decisions

### Data mistakes and what the customer sees

### Trade-offs

### Left out and next

### Tests

## Task 3

### Decisions

### Data mistakes and what the customer sees

### Trade-offs

### Left out and next

### Tests

## Mock API flags

Every mock endpoint waits a random 300 to 800 ms. Add these to the page URL (not the API URL) to see the slow, error and offline states:

| Flag          | Example                                         | What it does                                                                  |
| ------------- | ----------------------------------------------- | ----------------------------------------------------------------------------- |
| `mockDelay`   | `?mockDelay=3000`                               | Adds this many milliseconds to every call (capped at 20,000)                  |
| `mockFail`    | `?mockFail=checkout:500`                        | Makes every call to that endpoint fail. Kinds: `500`, `402`, `409`, `network` |
| `:once`       | `?mockFail=checkout:500:once`                   | Fails only the first matching call, so "Try again" works                      |
| `@group`      | `?mockFail=checkout@package:500:once`           | Fails only checkout of that cart group (Task 2)                               |
| several       | `?mockFail=services:500:once,providers:network` | Comma-separate rules. The first rule that matches a call wins                 |
| `mockOffline` | `?mockOffline=1`                                | The app behaves as if the device is offline. Nothing is sent                  |

Endpoint names for `mockFail` are listed in each spec under "Mock endpoints": `categories`, `providers`, `services`, `cart`, `cart-item`, `cart-delete`, `merge`, `checkout`, `orders`, `provider`, `slots`, `availability`, `book`, `reschedule`. A rule with a mistyped endpoint or kind is ignored.

On `/services`: `?mockDelay=4000` shows the loading skeleton (the first render waits too), then "This is taking longer than usual" while the browser loads the data. `?mockFail=services:500:once` shows the error, and "Try again" brings the results back. `?mockOffline=1` keeps the first results under the offline banner. Links inside the page (pages, "View all") don't carry the flags, so type them again after following one.

Cart groups for `@group` are the cart's group types: `lab_test`, `package`, `wellness`, `unknown`. A group name that doesn't exist is accepted but never matches a call.

How it works (ADR 0011): the browser reads these flags, decides whether each call fails, and forwards only `mockDelay` and `mockStatus` to the endpoint. You can see them in the DevTools network tab. `:once` is remembered until the page reloads, so reloading replays a demo. A `network` failure sends the request and then drops the reply, so the server may have done the work. That is the case where checkout must not charge twice.

## Performance

Task 1 asks for about 100 ms per filter change over all 3,200 services, typing that never blocks, and no layout shift (T1-12). Measured on 29 Oct 2026.

Machine: Apple M2 Pro (10 cores), 16 GB, macOS 27.0.1. The bench runs in Node 24 under Vitest; the browser rows use Chrome 156 on a production build (`npm run build` then `npm start`).

### 1. The engine (`npm run bench`)

`scripts/engine.bench.ts` runs over the real data (2,853 visible services). "Engine" is `runQuery` alone; the spec's target is under 20 ms. "Per change" is everything the page does in JavaScript before React renders: read the URL, run the engine, build the results and filter views. Times in ms.

| Filter state                      | Engine median | Engine p95 | Per change median | Per change p95 |
| --------------------------------- | ------------- | ---------- | ----------------- | -------------- |
| No filters                        | 2.24          | 2.52       | 2.49              | 2.71           |
| Search "thyroid"                  | 1.04          | 1.11       | 1.28              | 1.36           |
| Package, Bangkok, up to 5,000 THB | 0.54          | 0.61       | 0.69              | 0.77           |
| A category and 2 providers        | 0.67          | 0.70       | 0.83              | 0.87           |
| Price low to high in THB          | 4.36          | 4.77       | 4.59              | 5.07           |
| Rating, page 3                    | 2.76          | 2.89       | 2.99              | 3.16           |

The slowest step is the price sort, at about 5 ms. These numbers run slightly high: under Vitest, calls between our own modules go through import getters that a production bundle doesn't have.

### 2. In the browser

Each change is timed from the moment it reaches the explorer (a click, or typing the search box sends on) to the commit that shows its results, as a `filter-change` entry in the Timings track of the DevTools Performance panel. Nothing is logged to the console. To list them, type `performance.getEntriesByName("filter-change")` in the console.

| Step                                  | Throttle | Median   | p95      | Changes |
| ------------------------------------- | -------- | -------- | -------- | ------- |
| Tick a filter, to commit              | none     | 5.5 ms   | 10.5 ms  | 60      |
| Tick a filter, to the next frame      | none     | 8.2 ms   | 16.9 ms  | 60      |
| Type a letter, to commit              | none     | 3.7 ms   | 6.0 ms   | 33      |
| Tick a filter, to commit              | 4x CPU   | 103.7 ms | 206.7 ms | 60      |
| Tick a filter, to the next frame      | 4x CPU   | 161.2 ms | 284.2 ms | 60      |
| Type a letter, to commit              | 4x CPU   | 34.2 ms  | 60.7 ms  | 41      |
| Type a letter, until the box shows it | 4x CPU   | 6.1 ms   | 15.8 ms  | 35      |

INP at 4x CPU, from a person clicking filters, typing a search and changing the sort (69 interactions): DevTools live metrics showed 32 ms. The browser's own event timings for the same session give a worst interaction of 112 ms and about 104 ms at the 98th percentile, which is how INP is worked out. Both are "good" (under 200 ms). The live metrics figure is lower probably because it restarts at each URL change, and every filter change is one; not checked. The slowest interactions were keys in the search box that waited 45 to 73 ms for the results render to finish. No click was slower than 56 ms.

The rows were taken by a throwaway script run in the console (not kept in the repo), ticking the panel's options one after another. "To the next frame" is the time from the click to the first `requestAnimationFrame` after the commit. The unthrottled rows were taken at phone width with DevTools closed, the 4x rows at desktop width (1456 px) with DevTools open, which adds some cost of its own. A busy loop ran 4 to 5 times slower than in Node, which confirms the slowdown was on.

**What this means.** Without throttling, every step is far inside the 100 ms budget. At 4x CPU, typing stays responsive (the box shows each letter within a frame) and INP is good, but a tick and its new results reach the screen a median 161 ms after the click, over the budget. The browser's Long Animation Frame timings show where it goes: one task of 57 to 75 ms per change, almost all React rendering the results and the panel (about 10 ms of it is the engine, and 10 to 15 ms is a layout the commit forces), and 2 to 3 ms of style and layout after it. Not fixed in this package; see "Not finished".

Typing sends the search on at most once every 250 ms, then sends the latest text (Safari limits history changes; see the Task 1 spec's Decisions). A letter can wait up to 250 ms before its change starts, and that wait is not in the "Type a letter" row. The box itself shows every letter straight away.

### 3. Layout shift

CLS 0 on the first load, including the hand-over from the server's results to the client's (checked with `?mockDelay=1500`, using a `layout-shift` PerformanceObserver). The results do move when a filter changes them, but a shift within 500 ms of input doesn't count towards CLS. The slow note floats at the bottom of the window, so it doesn't move anything either. During the 4x session above, shifts not caused by input added up to 0.

### Not finished

- At 4x CPU a tick takes longer than 100 ms to show. Two next steps: draw the tick straight away from the click, before the URL and results catch up, and find which part of the commit forces a layout.

### How to repeat the browser rows

1. `npm run build`, then `npm start`, and open http://localhost:3000/services in Chrome.
2. DevTools, Performance panel: set CPU to "4x slowdown". Live metrics shows INP and CLS as you use the page.
3. Record while ticking filters and typing a search, then read the `filter-change` entries in the Timings track.
4. Lighthouse (navigation, mobile) for CLS on load.

## Accessibility

## Compliance note

All data in this project is fictional, and nothing personal is stored or sent anywhere. A production version would need to meet the data protection law of each country it serves: Thailand's Personal Data Protection Act (PDPA), India's Digital Personal Data Protection Act (DPDP Act) and Nepal's Individual Privacy Act. It would also need to meet WCAG 2.2 AA for accessibility.

## Time spent (planned vs actual)

## Where AI was used
