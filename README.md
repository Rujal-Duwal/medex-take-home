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
| `npm run bench`                   | Vitest benchmarks                                                                                                                                                             |
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

Cart groups for `@group` are the cart's group types: `lab_test`, `package`, `wellness`, `unknown`. A group name that doesn't exist is accepted but never matches a call.

How it works (ADR 0011): the browser reads these flags, decides whether each call fails, and forwards only `mockDelay` and `mockStatus` to the endpoint. You can see them in the DevTools network tab. `:once` is remembered until the page reloads, so reloading replays a demo. A `network` failure sends the request and then drops the reply, so the server may have done the work. That is the case where checkout must not charge twice.

## Performance

## Accessibility

## Compliance note

All data in this project is fictional, and nothing personal is stored or sent anywhere. A production version would need to meet the data protection law of each country it serves: Thailand's Personal Data Protection Act (PDPA), India's Digital Personal Data Protection Act (DPDP Act) and Nepal's Individual Privacy Act. It would also need to meet WCAG 2.2 AA for accessibility.

## Time spent (planned vs actual)

## Where AI was used
