# 0004 Exact money maths with big.js, currency on every amount

- Status: Accepted
- Date: 2026-10-25
- Deciders: Rujal Duwal
- Related: plan D2; WBS 2.4, 3.2; risk R5

## Context and problem

Prices arrive as decimal strings ("6200.00"). The final price applies a discount then a service charge, and must be rounded only for display. Service 0001 must show exactly 5,970.60 THB. Amounts come in THB, NPR and INR, and there are no exchange rates, so different currencies must never be added or compared.

## Options considered

1. big.js decimals
2. Integer minor units (satang, paisa) with JS numbers
3. Plain JS numbers

## Decision

Option 1. Parse strings with big.js, keep every amount as `Money = { amount: Big, currency }`, round to 2 decimal places only in the one formatter that uses `Intl.NumberFormat`.

## Consequences

- Good: percent discounts and charges stay exact without thinking about minor-unit scaling.
- Good: the currency travels with the amount, so code that adds two `Money` values can refuse mismatched currencies.
- Cost: one small dependency to explain.
- Rejected: integer minor units need care with percent maths and mid-calculation rounding; plain numbers risk off-by-0.01 results.
- References: https://mikemcl.github.io/big.js/ and https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/Intl/NumberFormat
