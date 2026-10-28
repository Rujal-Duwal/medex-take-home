import Big from "big.js";
import type { Currency, Money } from "@/lib/money/money";
import type { Price } from "./types";

// Task 1 price rules (spec "Pricing", ADR 0004). Pure: mappers.ts calls these once per service.
// All maths in big.js; nothing is rounded here. formatMoney rounds, once, for display.

// One set of price terms: a service's own, or one wellness option's. The field names are the
// brief's formula names. Amounts are the decimal strings MedEx sends.
export interface PriceTerms {
  price: string;
  discount: string;
  discountType: "percent" | "amount";
  serviceCharge: string;
  serviceChargeType: "percent" | "amount";
}

export interface WellnessOption extends PriceTerms {
  durationInMinutes: number;
}

// A discount or a service charge: a percent of the base, or a fixed amount.
function adjustmentAmount(type: "percent" | "amount", value: string, base: Big): Big {
  return type === "percent" ? base.times(value).div(100) : new Big(value);
}

// The brief's formula after the discount: the service charge is worked out on what is left.
function withServiceCharge(afterDiscount: Big, terms: PriceTerms): Big {
  return afterDiscount.plus(
    adjustmentAmount(terms.serviceChargeType, terms.serviceCharge, afterDiscount),
  );
}

// final is what the customer pays. original is what they would pay without the discount: the
// same formula with the discount left out, so it includes the service charge too. That way the
// discount is the only thing that makes them differ, and final is always the lower one. With a
// percent charge the gap is the discount plus the charge on it (0001: 663.40, not 620).
// original is set only when a discount applies.
export function finalPrice(
  terms: PriceTerms,
  currency: Currency,
): { final: Money; original?: Money } {
  const price = new Big(terms.price);
  const discountAmount = adjustmentAmount(terms.discountType, terms.discount, price);
  const withoutDiscount: Money = { amount: withServiceCharge(price, terms), currency };

  // No discount: 0, or a negative one, which would raise the price, so we treat it as none.
  // A discount larger than the price is a provider mistake (service 0005, spec Decisions).
  // Ignore the discount, keep the service charge. This also catches a percent discount over 100.
  if (discountAmount.lte(0) || discountAmount.gt(price)) {
    return { final: withoutDiscount };
  }
  const final: Money = { amount: withServiceCharge(price.minus(discountAmount), terms), currency };
  return { final, original: withoutDiscount };
}

// A service with one price. Nothing to pay shows as Free (service 0006), never "0.00 THB".
export function fixedPrice(terms: PriceTerms, currency: Currency): Price {
  const { final, original } = finalPrice(terms, currency);
  if (final.amount.eq(0)) return { kind: "free" };
  return { kind: "fixed", final, original };
}

// A wellness service: "From" its cheapest option by final price (service 0003). A tie goes to the
// shorter option. Undefined when there are no options: the price is unknown, never 0, and the
// mapper hides the service.
export function fromPrice(options: WellnessOption[], currency: Currency): Price | undefined {
  let cheapest: Extract<Price, { kind: "from" }> | undefined;
  for (const option of options) {
    const { final, original } = finalPrice(option, currency);
    const isCheaper =
      cheapest === undefined ||
      final.amount.lt(cheapest.lowest.amount) ||
      (final.amount.eq(cheapest.lowest.amount) &&
        option.durationInMinutes < cheapest.durationInMinutes);
    if (isCheaper) {
      cheapest = {
        kind: "from",
        lowest: final,
        durationInMinutes: option.durationInMinutes,
        original,
      };
    }
  }
  return cheapest;
}
