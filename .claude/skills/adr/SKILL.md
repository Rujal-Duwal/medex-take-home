---
name: adr
description: Create a new Architecture Decision Record from the template, for example /adr Use a fixed-offset zone for unknown offsets.
argument-hint: "[decision title]"
disable-model-invocation: true
---

Write a new ADR titled: $ARGUMENTS

1. Read `docs/adr/README.md` and `docs/adr/template.md`. Use the next free number.
2. Ask me for anything you can't find in the conversation, the specs or the code: the context, the options, which one I chose and why. Don't invent my reasons.
3. Create `docs/adr/NNNN-short-kebab-title.md` from the template, status Accepted, today's date, deciders Rujal Duwal, and the related plan decision, WBS id or spec section. Link official sources from `docs/standards.md` where relevant.
4. Add a row to the table in `docs/adr/README.md`.
5. If it replaces an earlier ADR, set that one's status to "Superseded by NNNN". Change nothing else in it.
6. Keep it under 40 lines. Plain words, no em dashes.
