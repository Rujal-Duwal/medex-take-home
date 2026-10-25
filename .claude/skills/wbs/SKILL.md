---
name: wbs
description: Start one WBS work package from the project plan, for example /wbs 3.2. Reads the docs, plans, and waits for approval before writing code.
argument-hint: "[wbs-id] [optional extra notes]"
disable-model-invocation: true
---

Start work package WBS $ARGUMENTS.

1. Read `CLAUDE.md`, `docs/ARCHITECTURE.md`, `docs/adr/README.md` and any ADR that covers this area.
2. Work out which task this package belongs to (2.x shared, 3.x Task 1, 4.x Task 2, 5.x Task 3, 6.x closing) and read that spec in `docs/specs/`. For UI work also read `docs/design-system.md` and the matching part of `design/HANDOFF.md`. For any pattern listed in `docs/standards.md`, open the linked page.
3. Find this package's goal and "done when" in the spec. If the id isn't in the spec, ask me what it covers.
4. Reply with a plan of 3 to 6 lines: files you'll create or change, tests you'll write first, decisions you'll take from the spec's defaults, anything unclear. Then stop and wait for "go".
5. After "go": tests first for logic, then code. Stay inside this package.
6. When done, run `npm run check` and give me a short note: done or not, and anything you're unsure about. Then stop and ask me to run /review-package. Do not try to run it yourself. Do not commit.
