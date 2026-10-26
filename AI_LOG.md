# AI log

Where AI tools were used on this take-home, written as it happens. The README's AI section is copied from here.

Rule for this project: Claude Code writes code one work package at a time from `CLAUDE.md` and the task specs. Rujal reads every diff line by line, changes what he disagrees with, and commits it himself. Nothing is committed that he can't explain.

| Date | Tool | What it was asked | What was kept | What Rujal changed after review |
|---|---|---|---|---|
| 22 Oct | Claude (claude.ai) | Project plan: scope, WBS, schedule, risks, open decisions | The plan structure and the default decisions | Scope, hours and capacity set by Rujal |
| 25 Oct | Claude Design | Screens for /services, /cart, /booking and the compare view | Layout and hierarchy as a guide | |
| 25 Oct | Claude (claude.ai) | Setup pack: CLAUDE.md, three task specs, ARCHITECTURE.md, ADRs 0001 to 0010, design-system.md, standards.md, this log | | |
| 26 Oct | Claude Code (/wbs 2.4, /review-package with package-reviewer) | WBS 2.4 Shared UI: port design tokens, money lib with big.js, live announcer, skeleton/alert/empty/error/offline states | Tokens from the handoff, money functions and tests, announcer, state components, useIsOffline hook | Fonts cut to Plex Sans Latin; shadcn CLI for Skeleton and Alert; money decisions moved to ARCHITECTURE.md with an INR lakh test; next-tick announcer; no demo page (CR-04). Review fixes: Alert role chosen by caller, disabled style without opacity, Alert sizes to handoff, unused shadcn classes trimmed, online test added, !important removed from reduced-motion CSS. Stray `cn` package from the shadcn CLI removed |
