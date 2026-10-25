# MedEx take-home

Take-home assessment for MedEx (Senior Frontend Engineer), built by Rujal Duwal.
One Next.js app, three tasks:

- `/services` Task 1: service explorer with live faceted filters
- `/cart` Task 2: multi-provider cart and split checkout
- `/booking` Task 3: appointment booking across time zones

Submission: Friday 30 Oct 2026 by 19:00 NPT (hard limit 23:59 NPT). Feature work stops Friday 17:15 NPT.

## Docs map (read before coding)

| File | What it is | When to read it |
|---|---|---|
| `docs/ARCHITECTURE.md` | Layers, data flow, where state lives, extension points | Every session |
| `docs/adr/` | Architecture Decision Records (MADR) for the big choices | Before touching anything an ADR covers |
| `docs/specs/task1-services.md`, `task2-cart.md`, `task3-booking.md` | Requirements, data audit, decisions, required tests per task | Before any work on that task |
| `docs/design-system.md` | Design rules: tokens, components, display rules, states, voice | Before any UI work |
| `design/HANDOFF.md` and `design/*.dc.html` | Screens and token values from Claude Design (a guide) | Before building a screen |
| `docs/standards.md` | Official links for every standard we follow | Before implementing a pattern it lists |
| `docs/briefs/` | The original MedEx briefs (PDF) | When the spec seems unclear |
| `.claude/README.md` | Permissions, the format hook, the `/wbs`, `/review-package` and `/adr` commands, the reviewer subagent | When a command or permission behaves unexpectedly |

If the spec and the brief disagree, the brief wins; say so in your summary.

When a work package makes a decision that is hard to reverse or affects more than one task, write a new ADR from `docs/adr/template.md` with the next number and add it to `docs/adr/README.md`. Smaller decisions go in the task spec's Decisions list. If a package changes the structure, update `docs/ARCHITECTURE.md` in the same change.

When implementing a pattern listed in `docs/standards.md` (a grid, a combobox, live regions, security headers, idempotency), read the linked official page first. Don't rely on memory, and prefer the official source over blog posts.

## Who owns this code

Rujal has to explain every line and extend it live, without AI, in a 30-minute interview. Write for that.

- Plain code over clever code. No generic helpers "for later", no metaprogramming, no type gymnastics.
- Business rules live in small pure functions with unit tests. Components stay thin.
- Comment the non-obvious parts: why it works this way, and where a change would go.
- Prefer one obvious place for each rule. If a rule lives in two places, that is a bug waiting to happen.
- Names describe the domain: `finalPrice`, `facetCounts`, `resolveTimeZone`, not `processData`.

## Commands

npm is the package manager (one less tool for reviewers).

- `npm install` then `npm run dev`: run locally at http://localhost:3000
- `npm run check`: lint, type check and tests together. Must pass before a package is done.
- `npm test` / `npm run test:watch`: Vitest
- `npm run bench`: Vitest bench for the Task 1 engine
- `npm run audit:data`: asserts the data audit counts in the specs

## Stack (decided, do not change without asking)

- Next.js App Router, React, TypeScript `strict` plus `noUncheckedIndexedAccess`
- Tailwind CSS and shadcn/ui (Radix primitives for combobox, dialog, drawer, checkbox)
- big.js for money maths (decision D2)
- Luxon for time zones (decision D3)
- Vitest and Testing Library
- ESLint: Next.js core-web-vitals, typescript-eslint strictTypeChecked and stylisticTypeChecked, jsx-a11y, eslint-plugin-sonarjs recommended, the rest of Sonar way in `eslint.sonar-way.mjs` (unicorn, Testing Library, promise and others), Prettier last; zero warnings allowed (ADR 0012)
- GitHub Actions CI (lint, type check, tests), Vercel Hobby for the deploy

Ask before adding any other dependency. Say what it saves and what it costs to explain.

## Folder layout

```
data/                     raw JSON from MedEx, never edited
docs/ARCHITECTURE.md      layers, data flow, state placement
docs/adr/                 architecture decision records
docs/design-system.md     design rules
docs/standards.md         official links for each standard
docs/briefs/              the three MedEx briefs (PDF)
docs/specs/               one spec per task (read before coding)
design/                   screens from Claude Design (a guide, not a spec)
scripts/audit-data.ts     checks the audit counts
src/app/                  routes: /, /services, /cart, /booking
src/app/api/mock/         mock API route handlers
src/lib/mock/             latency, failure flags, data loading (the ONLY code that reads /data)
src/lib/api/              fetchApi: the client fetch wrapper and its typed ApiResult
src/lib/money/            parse, calculate, format money
src/lib/a11y/             live announcer
src/components/ui/        shadcn components
src/components/states/    skeleton, empty, error with retry, offline banner
src/features/<task>/      api client, API types, mappers, logic, components for that task
```

Inside each `src/features/<task>/`:

- `api-types.ts`: types that mirror the API field names exactly
- `mappers.ts`: API shapes to UI shapes. Components only ever see UI shapes.
- `api.ts`: fetch functions that call the mock endpoints
- logic files (pure, tested), then `components/`

## Hard rules

Breaking one of these fails the review.

1. **Data only through the mock API.** Nothing outside `src/lib/mock` and `scripts/` imports from `/data`. An ESLint `no-restricted-imports` rule enforces it.
2. **Map at the edge.** Raw API field names stop at `mappers.ts`.
3. **Money is exact.** Prices arrive as decimal strings. Parse with big.js. Never do arithmetic on money with JS numbers. Round only in the formatter, to 2 decimal places.
4. **Currency belongs to the provider.** Every amount carries its currency in its type. Never add, compare, sort across or convert different currencies. There are no exchange rates anywhere.
5. **Unknown is not zero.** A wellness price without a chosen duration is a distinct "unknown" value in the type system, never `0`, `null` coerced to `0`, or an empty string.
6. **Every state is reachable.** Loading uses skeletons, never spinners. Empty, error with retry, slow and offline states exist where the spec asks, and can be triggered with mock query flags.
7. **No real "now" in logic.** Functions that depend on time take `now` as an argument. Only the app shell reads the real clock.
8. **Accessible by default.** WCAG 2.2 AA: everything works by keyboard, focus is moved on purpose after removals and step changes, result changes are announced through the shared live region, text contrast is at least 4.5:1. Use real buttons and Radix primitives, not clickable divs.
9. **Data mistakes are decisions.** When you meet a mistake in the data, handle it, then add a line to the "Decisions" list in that task's spec: what the data says, what the customer sees, why.

## Mock API contract

Every mock endpoint goes through one helper in `src/lib/mock` that applies latency and failure.

- Default latency: random 300 to 800 ms.
- Flags are read from the page URL by the client fetch layer and forwarded to the endpoint, so a reviewer can type them into the address bar:
  - `?mockDelay=3000` adds delay to every call
  - `?mockFail=<endpoint>:<kind>` with kinds `500`, `402`, `409`, `network`. Comma-separate several.
  - add `:once` (for example `checkout:500:once`) to fail only the first matching call, so retry demos can succeed
  - `?mockOffline=1` makes the client behave as offline
- Endpoint names used in flags are listed in each spec.
- The dev panel UI is cut (WBS 2.3). Query flags are the way in. List them in the README.

## Definition of done for every work package

- `npm run check` passes
- npm run lint shows 0 errors and 0 warnings; npm run typecheck shows 0 errors; no eslint-disable without a one-line reason
- strict TypeScript, no `any`, no unexplained `as` casts
- business rules in pure functions with tests
- components read only mapped UI shapes
- the package's states are reachable with query flags
- keyboard path works and focus lands somewhere sensible
- any data mistake met is in the spec's Decisions list
- Rujal can explain every line

## How to run a session

One work package per session. Rujal starts it with `/wbs <id>` (for example `/wbs 3.2`) and ends it with `/review-package`, which runs the `package-reviewer` subagent and writes the summary below.

1. Read this file and the task spec. Restate the package goal and your plan in 3 to 6 lines. Wait for "go" if the prompt says so.
2. Write tests first for logic packages, then the code.
3. Stay inside the package. Do not refactor unrelated code or start the next package.
4. When something is ambiguous: use the default in the spec. If the spec has none, pick the simplest reasonable option, add it to Decisions and flag it in your summary.
5. Finish with a summary:
   - files changed and why, in plain words
   - the 2 or 3 parts Rujal should read most carefully
   - decisions added
   - anything not done
   - proposed commit messages, conventional style with a scope: `feat(services): ...`, `fix(cart): ...`, `test(booking): ...`, `chore(mock): ...`, `docs: ...`
   - a new entry for `AI_LOG.md`

**Do not run `git commit`, `git push` or change git config.** Rujal reviews the diff and commits himself. The commit history is read by MedEx.

## Design

`design/` holds screens made in Claude Design. Use them for layout, hierarchy and tone. They are a guide, not a spec: where a screen conflicts with the brief or a spec (missing states, prices that mix currencies, a hidden zero-count option), follow the spec and mention it in the summary.

## Writing style

Applies to the README, code comments, commit messages and UI copy.

- Plain, short, human. No em dashes. No buzzwords, no filler.
- UI copy speaks to a non-technical customer: what happened, what it means for them, what to do next. "We couldn't load services. Check your connection and try again." Not "Error 500".
- The README is honest about trade-offs and anything unfinished.

## Security and privacy

- All data is fictional. Still treat it like customer data: no logging of full objects to the console in production code.
- No secrets in the repo. There are no real API keys in this project; do not add `.env` files with values.
- No third-party calls at runtime: no analytics, no external APIs. Fonts are self-hosted through `next/font`.
- No card number fields. "Card" is a payment choice; the mock decides the outcome.

## Out of scope

Do not build these. If one would help, mention it as a "with more time" note instead.

- real login (a "Sign in (demo)" button triggers the guest cart merge)
- real payments, exchange rates, translations
- end-to-end browser tests, a database
- the dev panel UI, the video, and every "Should" item in the plan
