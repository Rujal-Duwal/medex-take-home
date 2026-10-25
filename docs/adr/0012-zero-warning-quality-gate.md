# 0012 Zero-warning quality gate: strict type-checked lint plus SonarJS

- Status: Accepted
- Date: 2026-10-25
- Deciders: Rujal Duwal
- Related: issue I-04; quality plan; ADR 0009

## Context and problem

SonarQube for IDE (SonarLint) flagged `Async method 'headers' has no 'await' expression` in `next.config.ts`, while `npm run check` still passed. The definition of done did not require zero warnings, and the repo's lint rules were weaker than the editor's, so issues could pile up unnoticed. Reviewers will open the code in their own editors.

## Options considered

1. Rely on SonarLint in the editor only
2. Bring Sonar's rules into the repo's ESLint (eslint-plugin-sonarjs), use typescript-eslint's strict type-checked rules, and fail on any warning
3. Run SonarQube Cloud analysis in CI

## Decision

Option 2.

- ESLint: Next.js core-web-vitals, typescript-eslint `strictTypeChecked` and `stylisticTypeChecked`, jsx-a11y, `eslint-plugin-sonarjs` recommended, the rest of Sonar way, Prettier last.
- "The rest of Sonar way": SonarQube for IDE's default profile also uses rules from other plugins (core ESLint, typescript-eslint, React, import, jsx-a11y, unicorn, Testing Library, promise). `eslint.sonar-way.mjs` turns on exactly those rules, with Sonar's options and each rule's Sonar key beside it. That needs three more dev dependencies: `eslint-plugin-unicorn` (65.0.1, the last release for ESLint 9), `eslint-plugin-testing-library` and `eslint-plugin-promise`. Only the listed rules are on, not each plugin's full recommended set.
- `npm run lint` runs with `--max-warnings 0`. CI runs the same script.
- A rule is turned off only in `eslint.config.mjs`, with a one-line reason. A single-line `eslint-disable-next-line` needs a reason beside it. The same applies to SonarLint rules turned off in `.vscode/settings.json`.
- Before each commit, Rujal also checks the editor's Problems panel for the changed files. Sonar's improved versions of some rules can still report a little differently from the originals.

## Consequences

- Good: CI and the editor agree on almost everything; warnings can't accumulate.
- Good: an interviewer opening the repo in their own editor sees a clean Problems panel.
- Cost: five dev dependencies and stricter rules; some rules will need small code changes.
- Cost: `eslint.sonar-way.mjs` is a snapshot of Sonar way on 2026-10-25. Its header says how to refresh it after upgrading `eslint-plugin-sonarjs`.
- Known exception: S6772 (`react/jsx-child-element-spacing`) stays off, because Prettier owns JSX whitespace and runs last.
- Revisit if: a Sonar rule conflicts with a decision in an ADR. Then turn that rule off with a reason that names the ADR.
- Revisit if: moving to ESLint 10, which allows the current `eslint-plugin-unicorn`.
- References: https://typescript-eslint.io/users/configs/, https://www.npmjs.com/package/eslint-plugin-sonarjs and the "ESLint rules" tables in its README
