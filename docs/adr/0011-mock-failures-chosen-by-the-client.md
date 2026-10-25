# 0011 Mock failures chosen by the client, mock server keeps no flag state

- Status: Accepted
- Date: 2026-10-25
- Deciders: Rujal Duwal
- Related: ADR 0003, ADR 0007, WBS 2.2, Task 2 spec "Mock endpoints"

## Context and problem

ADR 0003 puts failure flags on the page URL, including `:once` ("fail only the first matching call") and group targets such as `checkout@package:500:once`. Something has to remember that a `:once` rule already fired. On Vercel the mock server's memory is per instance and resets on cold starts, and a reviewer replaying a demo expects a reload to start fresh. We also need a "network" failure, which a server cannot really send.

## Options considered

1. The server parses `mockFail` and remembers fired `:once` rules in memory
2. The client fetch wrapper parses `mockFail`, picks the rule for each call, remembers fired `:once` rules for the life of the page, and forwards only the outcome (`?mockStatus=500`)
3. Store fired rules in `sessionStorage`

## Decision

Option 2. The server helper only reads `mockDelay` and `mockStatus`, so it behaves the same on every instance. A reload forgets fired `:once` rules, so a demo can be replayed by reloading. A `network` rule is faked by the client: the request is sent and handled, then the reply is thrown away. That is the realistic "outcome unknown" case that idempotent checkout (ADR 0007) must survive.

## Consequences

- Good: `:once` is deterministic per page load, locally and on Vercel.
- Good: the server helper is stateless and tiny; every flag's syntax lives in `src/lib/mock/flags.ts`.
- Accepted cost: typing `?mockFail=...` straight into an API URL does nothing; use `?mockStatus=500` there instead.
- Accepted cost: after a reload during checkout, a `:once` rule fires again on the resumed attempt. The retry after that succeeds, so the resume path still finishes.
- Revisit if: a demo needs a `:once` rule to survive a reload. Option 3 would do it with a few lines.
