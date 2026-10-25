# Architecture Decision Records

One file per significant decision, in the MADR format (https://adr.github.io/madr/). Copy `template.md` for a new one and use the next number.

Write an ADR when a decision is hard to reverse, affects more than one task, or a reviewer would reasonably ask "why this and not that?". Small, task-local choices go in that task's spec under "Decisions" instead.

An ADR is never edited after it is accepted. To change a decision, write a new ADR that supersedes it, and set the old one's status to "Superseded by NNNN".

| # | Decision | Status |
|---|---|---|
| 0001 | Record architecture decisions | Accepted |
| 0002 | One Next.js App Router app for all three tasks | Accepted |
| 0003 | Mock API as route handlers with query-flag failure injection | Accepted |
| 0004 | Exact money maths with big.js, currency on every amount | Accepted |
| 0005 | Time zones with Luxon behind one resolver | Accepted |
| 0006 | URL as the source of truth, one query engine on server and client | Accepted |
| 0007 | Idempotent checkout with key-derived order ids and saved attempts | Accepted |
| 0008 | Tailwind v4, shadcn/ui and Radix for UI | Accepted |
| 0009 | Vitest and Testing Library for tests | Accepted |
| 0010 | AI-assisted build with human review of every commit | Accepted |
| 0011 | Mock failures chosen by the client, mock server keeps no flag state | Accepted |
| 0012 | Zero-warning quality gate: strict type-checked lint plus SonarJS | Accepted |
