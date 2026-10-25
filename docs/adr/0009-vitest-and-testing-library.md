# 0009 Vitest and Testing Library for tests

- Status: Accepted
- Date: 2026-10-25
- Deciders: Rujal Duwal
- Related: WBS 2.1; quality plan

## Context and problem

The briefs ask for tests of the most important logic, not full coverage. The riskiest logic is pure: pricing, facets, URL codec, quantity queue, checkout reducer, merge, time zones, slots. Task 1 also needs a benchmark.

## Options considered

1. Vitest (unit tests and bench) plus Testing Library for a few components
2. Jest plus a separate benchmark tool
3. Playwright end-to-end tests

## Decision

Option 1. Logic tests are named after the data case they protect ("service 0001 shows 5,970.60 THB"). Component tests only where behaviour matters (five fast taps, focus after removal). End-to-end tests are out of scope.

## Consequences

- Good: one fast tool for tests and benchmarks, TypeScript out of the box.
- Cost: no browser-level coverage; manual keyboard and screen reader checks fill the gap.
- References: https://vitest.dev/guide/ and https://testing-library.com/docs/guiding-principles
