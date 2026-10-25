# 0010 AI-assisted build with human review of every commit

- Status: Accepted
- Date: 2026-10-25
- Deciders: Rujal Duwal
- Related: plan change CR-01; risk R8; `AI_LOG.md`

## Context and problem

The briefs allow AI tools but require the candidate to explain every line and to say where AI was used. The interview includes a 30-minute live extension without AI. About 27 hours of build work fit in five days.

## Options considered

1. Write everything by hand
2. Claude Code writes one work package at a time from `CLAUDE.md` and the specs; Rujal reviews and commits
3. Generate whole features and review at the end

## Decision

Option 2. Each session covers one WBS package. Claude Code plans, waits for approval, writes tests and code, and proposes commits. Rujal reads the diff, changes what he disagrees with, commits it himself, and logs it in `AI_LOG.md`.

## Consequences

- Good: the build fits the schedule, and the commit history shows small, reviewed steps.
- Good: the README's AI section is written from the log, not memory.
- Cost: review time per package; a risk of code Rujal can't explain, checked at every 22:00 review and by a self-quiz after each task.
- Revisit if: two packages in a row are hard to explain; then write the next one by hand.
