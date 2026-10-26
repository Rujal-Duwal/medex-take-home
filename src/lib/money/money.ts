import Big from "big.js";

// Money rules for all three tasks (ADR 0004, ARCHITECTURE.md section 6).
// Every amount carries its currency, maths uses big.js, and rounding happens once, in formatMoney.
// A new currency goes in this list and nowhere else.
export type Currency = "THB" | "NPR" | "INR";

export interface Money {
  amount: Big;
  currency: Currency;
}

// Prices arrive as decimal strings ("6200.00"). big.js throws on anything that isn't a number,
// so a bad value fails loudly here instead of becoming NaN on screen.
export function parseMoney(amount: string, currency: Currency): Money {
  return { amount: new Big(amount), currency };
}

// There are no exchange rates, so adding THB to NPR is always a bug in the caller.
export function addMoney(a: Money, b: Money): Money {
  if (a.currency !== b.currency) {
    throw new Error(`Can't add ${b.currency} to ${a.currency}`);
  }
  return { amount: a.amount.plus(b.amount), currency: a.currency };
}

// en-US grouping for every currency, so THB, NPR and INR read the same way in one list.
const groupedTwoDecimals = new Intl.NumberFormat("en-US", {
  minimumFractionDigits: 2,
  maximumFractionDigits: 2,
});

// "5,970.60 THB". Rounds half-up to 2 decimals with big.js, then hands Intl the rounded
// string (not a JS number), so Intl only adds grouping and can't introduce float error.
// Zero prints as "0.00 THB": showing "Free" is the price kind's job, not the formatter's.
export function formatMoney(money: Money): string {
  // toFixed returns a plain decimal string, which is exactly what Intl's string input expects.
  const rounded = money.amount.round(2, Big.roundHalfUp).toFixed(2) as Intl.StringNumericLiteral;
  return `${groupedTwoDecimals.format(rounded)} ${money.currency}`;
}
