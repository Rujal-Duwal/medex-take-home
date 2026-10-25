# Design system

How the MedEx take-home looks and speaks, and the rules that keep the three routes consistent.

**Where the values come from.** The exact colours, type sizes, spacing and the ready-made `globals.css` are in `design/HANDOFF.md` and `design/Tokens.dc.html`, made in Claude Design. This file holds the rules. When a value here and the handoff disagree, the handoff wins for values and this file wins for rules. Tokens are ported into `src/app/globals.css` in WBS 2.4.

References: Tailwind v4 theme variables (https://tailwindcss.com/docs/theme), shadcn/ui with Tailwind v4 (https://ui.shadcn.com/docs/tailwind-v4), Design Tokens Community Group (https://www.designtokens.org/), WCAG 2.2 (https://www.w3.org/TR/WCAG22/).

## 1. Principles

- **Calm and trustworthy.** A clinic booking tool, not a shop. Subtle greys and blues, plenty of space, one clear primary action per area.
- **Honest numbers.** Every price shows its currency. Nothing is converted, nothing unknown is shown as zero.
- **Always say what is happening.** Every wait, failure and empty result says what happened and what to do next.
- **Keyboard first.** Anything you can click, you can reach and use by keyboard, with a visible focus ring.

## 2. Tokens

All colours, radii and shadows are CSS variables in `globals.css`, in the shadcn naming scheme (`--background`, `--foreground`, `--primary`, `--muted`, `--destructive`, `--border`, `--ring`, and so on), exposed to Tailwind through `@theme`.

Rules:

- No raw colour values (hex, rgb, oklch) in components. Use the token classes.
- Add semantic tokens, not one-off colours, when something new is needed: for example `--success`, `--warning`, `--unavailable`. Add them in `globals.css` with light and dark values and a contrast note.
- Body text and interactive text meet 4.5:1 contrast against their background; large text and UI boundaries meet 3:1. The handoff lists the checked pairs; keep to them.
- The focus ring uses `--ring`, at least 2 px, never removed. Focus must not be hidden behind sticky bars (WCAG 2.2, 2.4.11).

## 3. Typography

- Font: **IBM Plex Sans**, chosen because it has Thai and Devanagari companions for a future translated UI. Loaded with `next/font`, self-hosted, `display: swap`.
- Use the type scale from the handoff. Prices and times use tabular numbers (`font-variant-numeric: tabular-nums`) so columns line up and nothing shifts while updating.
- Minimum body size 16 px on mobile.

## 4. Spacing, layout and motion

- Spacing and radius follow the handoff scale. Don't invent in-between values.
- Breakpoints: designed at 375 px (mobile) and 1440 px (desktop). Filters move into a drawer below the large breakpoint.
- Reserve space for anything that updates (counts, prices, result cards, slot lists) so updates cause no layout shift.
- Motion is short and functional. Respect `prefers-reduced-motion` by turning transitions off.

## 5. Components

| Need | Component | Notes |
|---|---|---|
| Buttons | shadcn `Button` | One primary per area; destructive only for remove or cancel |
| Filters: multi-select | shadcn `Checkbox` | Option label, count in a fixed-width slot, disabled at 0 |
| Provider filter | shadcn `Command` in a `Popover` (Radix) | Follows the APG combobox pattern |
| Mobile filters | shadcn `Drawer` or `Sheet` | Focus trapped; "Show N results" button at the bottom |
| Compare view, confirm steps | shadcn `Dialog` | Focus moves to the heading on open, back to the trigger on close |
| Notices (merge changes, 409, offline) | shadcn `Alert` | Also announced through the live region |
| Loading | shadcn `Skeleton` | Same size as the content it stands in for |
| Calendar and slot grid | Custom, on the APG grid pattern | Arrow keys, Home and End, Page Up and Page Down |

Custom components go in `src/features/<task>/components` unless at least two tasks use them, then `src/components`.

## 6. Domain display rules

These are design rules as much as code rules.

| Situation | How it looks |
|---|---|
| Discounted price | Final price in body weight; original struck through beside it, muted |
| Wellness, no duration chosen | "From 1,800.00 THB, 60 min" in lists; "Choose a duration" in the cart. Never "0" |
| Free service | "Free", not "0.00 THB" |
| Several currencies | One line per currency. Never a combined total. A short note where it helps: "Prices are in each provider's own currency." |
| No rating yet | "New, no reviews yet" in place of stars; sorted last by rating |
| Unavailable option or item | Muted, with the reason in words; still focusable so the reason is announced |
| Two clocks (booking) | Provider time large and first ("10:40 Bangkok time"); customer time small beneath ("12:25 your time"); "next day" in words when the date differs |
| Booked slot | Visible, muted, labelled "Booked", not selectable |
| Your current booking (reschedule) | Distinct style, labelled "Your current booking" |

## 7. States

Every data area has the same set, with the same look across routes:

- **Loading:** skeletons shaped like the content. No spinners. If it is slow, the skeleton stays and buttons that wait show their own pending label.
- **Empty:** says why, and offers the way out ("Remove the price filter", "Back to services").
- **Error:** says what failed in plain words, "Try again" keeps everything the customer chose.
- **Offline:** a banner at the top; actions that need the network are disabled with the reason.
- **Partial:** what worked is shown as done; only what failed offers a retry.

## 8. Voice and copy

- Plain, short, human. Second person. No em dashes, no jargon, no error codes.
- Say what happened, what it means for the customer, what to do next: "We couldn't book 10:40. Someone else took it a moment ago. Here are the closest times."
- Numbers with their unit: "3 services", "60 min", "2 orders".
- All customer-facing strings are listed in `design/HANDOFF.md` section 4. Use them as written unless the spec says otherwise.

## 9. Accessibility checklist per component

- Reachable and usable by keyboard, in a sensible order.
- Has an accessible name (visible label or `aria-label`).
- State changes that matter are announced through the shared polite live region.
- Focus goes somewhere sensible after it opens, closes, or removes something.
- Passes axe with no serious or critical issues.
