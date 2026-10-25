# 0001 Record architecture decisions

- Status: Accepted
- Date: 2026-10-25
- Deciders: Rujal Duwal

## Context and problem

The brief asks for the decisions and trade-offs to be explained, and the follow-up interview will ask "why this and not that?". Decisions made in chat or in the plan get lost by the time the README is written.

## Options considered

1. Keep decisions only in the README
2. Architecture Decision Records in the repo (Nygard style, MADR format)
3. Decisions only in the project plan

## Decision

Option 2. ADRs live in `docs/adr/`, written in MADR format. Big, cross-task decisions get an ADR; small task-local decisions go in that task's spec under "Decisions", which feeds the README.

## Consequences

- Good: the reasoning sits next to the code and shows in the commit history.
- Good: the README can link to ADRs instead of repeating them.
- Cost: a few minutes per decision.
- References: https://cognitect.com/blog/2011/11/15/documenting-architecture-decisions and https://adr.github.io/madr/
