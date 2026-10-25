# 0003 Mock API as route handlers with query-flag failure injection

- Status: Accepted
- Date: 2026-10-25
- Deciders: Rujal Duwal
- Related: WBS 2.2, 2.3 (cut); traceability G-04, T2-09, T3-11

## Context and problem

The briefs forbid importing the JSON into components. The data must sit behind a mock API with realistic latency, and reviewers must be able to make a specific call slow or fail on demand. The planned dev panel UI was cut to save time.

## Options considered

1. Next.js route handlers under `/api/mock`, failures controlled by query flags on the page URL
2. MSW (Mock Service Worker) in the browser
3. An in-memory service called directly from components

## Decision

Option 1. Every handler goes through one helper in `src/lib/mock` that adds 300 to 800 ms latency and applies flags forwarded by the client fetch wrapper: `?mockDelay=ms`, `?mockFail=<endpoint>:<kind>[:once]`, `?mockOffline=1`.

## Consequences

- Good: real HTTP requests show up in DevTools, like a real backend.
- Good: a reviewer can trigger any state by editing the address bar; no extra UI.
- Good: works the same locally and on Vercel.
- Cost: in-memory server state does not survive Vercel cold starts or span instances. See ADR 0007 for how checkout copes.
- Revisit if: time appears for the dev panel (it would set the same flags).
