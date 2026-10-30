# .claude folder

Project configuration for Claude Code, committed so the AI workflow is visible to reviewers. See ADR 0010 and `AI_LOG.md`.

| Path | What it does | Docs |
|---|---|---|
| `settings.json` | Shared permissions and hooks. Allows the project's npm scripts and read-only git; asks before installing packages, running `npx`, or editing specs, ADRs and CLAUDE.md; denies `git commit`, `git push`, `git config`, destructive commands, reading `.env` files, and editing `data/`, `docs/briefs/` and `design/` | https://code.claude.com/docs/en/settings |
| `hooks/format-changed-file.mjs` | After each edit, formats that file with Prettier. Does nothing until Prettier is installed | https://code.claude.com/docs/en/hooks |
| `skills/wbs/` | `/wbs 3.2` starts one work package: reads the docs, plans, waits for "go" | https://code.claude.com/docs/en/skills |
| `skills/review-package/` | `/review-package` checks the diff against the hard rules and writes the summary, proposed commits and AI_LOG entry | |
| `skills/adr/` | `/adr <title>` writes a new ADR from the template | |
| `skills/quiz/` | `/quiz task1` asks 8 questions on one area's code, then sets a practice task to do by hand without AI | |
| `agents/package-reviewer.md` | Read-only reviewer subagent used by `/review-package` | https://code.claude.com/docs/en/sub-agents |

Personal overrides go in `.claude/settings.local.json`, which stays out of git.

Why commits are denied: Rujal reviews every diff and commits it himself, so the commit history is his. Claude Code proposes commit messages instead.
