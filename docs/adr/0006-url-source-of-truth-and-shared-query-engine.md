# 0006 URL as the source of truth, one query engine on server and client

- Status: Accepted
- Date: 2026-10-25
- Deciders: Rujal Duwal
- Related: plan D5 to D10; WBS 3.3, 3.4, 3.5; risks R7, R9

## Context and problem

Task 1 must restore the exact view on reload, shared links and back/forward, with no flash of an unfiltered list. Facet counts must update within about 100 ms over 3,200 services, and each facet's counts must apply every filter except its own.

## Options considered

1. URL as the only source of filter state; one pure engine shared by the server render and the client
2. Client state store synced to the URL
3. Server-side filtering on every change through the mock API

## Decision

Option 1. A URL codec turns `searchParams` into filter state and back. The server renders the first page with the engine; the client loads the data and runs the same engine for live counts. Category keys include the type (`package.ultrasound.thyroid`) because slugs repeat.

## Consequences

- Good: one place for filter logic, so server and client cannot disagree.
- Good: the engine is pure and benchmarked on its own.
- Cost: the full service list is loaded in the browser; fine at 3,200 rows, not at 300,000.
- Revisit if: data grows by orders of magnitude, then facet counting moves to the server.
- References: https://nextjs.org/docs/app/api-reference/file-conventions/page and https://react.dev/reference/react/useDeferredValue
