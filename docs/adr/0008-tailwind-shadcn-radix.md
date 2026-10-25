# 0008 Tailwind v4, shadcn/ui and Radix for UI

- Status: Accepted
- Date: 2026-10-25
- Deciders: Rujal Duwal
- Related: WBS 2.1, 2.4; design handover

## Context and problem

The UI needs an accessible combobox, dialog, drawer and checkbox, with correct focus handling, built fast. The design handover ships tokens as Tailwind v4 CSS variables in the shadcn format.

## Options considered

1. Tailwind v4 with shadcn/ui components on Radix primitives
2. A full component library (MUI, Chakra)
3. Hand-built components with CSS modules

## Decision

Option 1. shadcn components are copied into `src/components/ui`, so the code is ours to read and change. Radix handles focus traps, roles and keyboard support.

## Consequences

- Good: accessible primitives without writing focus traps by hand.
- Good: tokens from the design map straight onto CSS variables.
- Cost: Tailwind class lists can get long; keep components small.
- References: https://ui.shadcn.com/docs/tailwind-v4, https://www.radix-ui.com/primitives/docs/overview/introduction, https://tailwindcss.com/docs/theme
