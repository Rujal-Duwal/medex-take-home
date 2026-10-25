# 0002 One Next.js App Router app for all three tasks

- Status: Accepted
- Date: 2026-10-25
- Deciders: Rujal Duwal
- Related: plan D1 (scope)

## Context and problem

All three briefs are built. They share needs: a mock API with latency and failure, money formatting, skeleton and error states, a live announcer. The briefs require React and TypeScript and prefer Next.js, which MedEx uses. Task 1 needs a server render from the URL with no unfiltered flash.

## Options considered

1. One Next.js App Router app with three routes
2. Three separate apps, one per task
3. One Vite single-page app

## Decision

Option 1: routes `/services`, `/cart` and `/booking`, a home page linking to them, and shared code in `src/lib` and `src/components`.

## Consequences

- Good: shared code is written once; one command runs everything; one deploy.
- Good: server components can render Task 1's first page from `searchParams`.
- Cost: a mistake in shared code can affect all three tasks, so shared code gets tests first.
- Revisit if: MedEx asks for one task only. The build order stays the same; only the README framing changes.
