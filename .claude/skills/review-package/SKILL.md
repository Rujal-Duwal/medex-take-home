---
name: review-package
description: Check the current uncommitted changes against CLAUDE.md's hard rules and definition of done, run /simplify and /code-review on major packages, then write the end-of-package summary, proposed commits and AI_LOG entry.
disable-model-invocation: true
---

Review the work in progress before Rujal commits it.

For a major package, Rujal types `/review-package /simplify /code-review` so all three load together. Major packages: 2.2, 3.3, 3.4, 3.6, 4.4, 4.5, 5.1, 5.2, 5.4.

1. Run `git status` and `git diff` to see every changed and new file. Work out which WBS package this is and whether it is major.
2. Run `npm run check`. If it fails, say so first and stop there.
3. Delegate a second opinion to the `package-reviewer` subagent, passing the list of changed files and the task spec path. It reads with fresh eyes; it did not write the code.
4. Combine its findings with your own check of:
   - the 9 hard rules in `CLAUDE.md` (data only through the mock, mapping at the edge, exact money, no mixed currencies, unknown is not zero, states reachable, no real "now", accessibility, data mistakes recorded)
   - the definition of done in `CLAUDE.md`
   - the package's "done when" in the spec
5. Fix anything clearly wrong that is inside this package. List anything else as an open point. Don't fix outside the package.
6. **Major packages only: simplify, then code review.**
   - If `/simplify` and `/code-review` were loaded with this command, follow them now, in that order: simplify first, then code review on the simplified code.
   - If they were not loaded, try to invoke `simplify`, then `code-review`, with the Skill tool.
   - If either is blocked or not available, do not imitate it. Finish the rest of this review and, at the top of the summary, tell Rujal to run the missing command(s) himself before committing.
   - Simplifying must not change behaviour or break a rule in `CLAUDE.md`. Keep every test passing; never delete a test to make code simpler.
   - If either step changed code, run `npm run check` again.
7. Write the summary in this order:
   - **Result:** done, or not done and why. Say which reviews ran: review-package, simplify, code-review.
   - **Files changed** and why, in plain words
   - **What simplify and code-review changed or flagged** (major packages only)
   - **Read these carefully:** the 2 or 3 places Rujal should understand before committing, with file and function names
   - **Decisions added** (spec Decisions list or a new ADR)
   - **Not done / open points**
   - **Proposed commits:** conventional style with a scope, smallest sensible steps, each with the files it contains
   - **AI_LOG entry:** one table row ready to paste into `AI_LOG.md`, naming every review command that ran

Do not run `git commit` or `git push`.