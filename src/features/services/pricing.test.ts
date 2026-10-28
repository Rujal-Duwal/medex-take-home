import { describe, expect, it } from "vitest";
import { formatMoney } from "@/lib/money/money";
import { finalPrice, fixedPrice, fromPrice, type PriceTerms } from "./pricing";
import type { Price } from "./types";

// Default terms: no discount, no charge. Each test overrides only what its case is about.
function terms(overrides: Partial<PriceTerms> = {}): PriceTerms {
  return {
    price: "1000.00",
    discount: "0.00",
    discountType: "amount",
    serviceCharge: "0.00",
    serviceChargeType: "amount",
    ...overrides,
  };
}

// Prices as a customer would read them, so each test states the case in one line.
function describePrice(price: Price | undefined): string {
  if (price === undefined) return "no price";
  if (price.kind === "free") return "Free";
  const was = price.original ? `, was ${formatMoney(price.original)}` : "";
  if (price.kind === "fixed") return `${formatMoney(price.final)}${was}`;
  return `From ${formatMoney(price.lowest)}, ${String(price.durationInMinutes)} min${was}`;
}

describe("fixedPrice", () => {
  it("service 0001 shows 5,970.60 THB, with 6,634.00 THB (6,200 plus the 7% charge) struck through", () => {
    const price = fixedPrice(
      terms({
        price: "6200.00",
        discount: "10.00",
        discountType: "percent",
        serviceCharge: "7.00",
        serviceChargeType: "percent",
      }),
      "THB",
    );
    expect(describePrice(price)).toBe("5,970.60 THB, was 6,634.00 THB");
  });

  it("service 0002 shows 3,000.00 NPR after an amount discount of 500, with 3,500.00 struck through", () => {
    const price = fixedPrice(terms({ price: "3500.00", discount: "500.00" }), "NPR");
    expect(describePrice(price)).toBe("3,000.00 NPR, was 3,500.00 NPR");
  });

  it("adds an amount service charge to both the final and the struck-through price", () => {
    const price = fixedPrice(
      terms({ discount: "10.00", discountType: "percent", serviceCharge: "50.00" }),
      "THB",
    );
    expect(describePrice(price)).toBe("950.00 THB, was 1,050.00 THB");
  });

  it("adds an amount service charge with no discount, and strikes nothing through", () => {
    const price = fixedPrice(terms({ serviceCharge: "50.00" }), "THB");
    expect(describePrice(price)).toBe("1,050.00 THB");
  });

  it("keeps the final price below the struck-through one when a small discount meets a big charge", () => {
    const price = fixedPrice(
      terms({ discount: "1.00", serviceCharge: "20.00", serviceChargeType: "percent" }),
      "THB",
    );
    expect(describePrice(price)).toBe("1,198.80 THB, was 1,200.00 THB");
  });

  it("service 0005 ignores a discount of 600 on a price of 450, and strikes nothing through", () => {
    const price = fixedPrice(terms({ price: "450.00", discount: "600.00" }), "THB");
    expect(describePrice(price)).toBe("450.00 THB");
  });

  it("keeps the service charge when it ignores a discount larger than the price", () => {
    const price = fixedPrice(
      terms({ price: "450.00", discount: "600.00", serviceCharge: "10.00" }),
      "THB",
    );
    expect(describePrice(price)).toBe("460.00 THB");
  });

  it("ignores a percent discount over 100, the same mistake as 0005", () => {
    const price = fixedPrice(
      terms({ price: "450.00", discount: "150.00", discountType: "percent" }),
      "THB",
    );
    expect(describePrice(price)).toBe("450.00 THB");
  });

  it("treats a negative discount as no discount", () => {
    const price = fixedPrice(terms({ discount: "-100.00" }), "THB");
    expect(describePrice(price)).toBe("1,000.00 THB");
  });

  it("service 0006, with price 0.00, shows Free", () => {
    expect(fixedPrice(terms({ price: "0.00" }), "THB")).toEqual({ kind: "free" });
  });

  it("shows Free, with nothing struck through, when a discount equals the price", () => {
    expect(fixedPrice(terms({ discount: "1000.00" }), "THB")).toEqual({ kind: "free" });
  });
});

describe("finalPrice", () => {
  it("rounds only at display: 1.01, 50% off, 1% charge stays 0.51005 and shows 0.51", () => {
    // Rounding the discounted 0.505 to 0.51 first would give 0.5151, shown as 0.52.
    const { final } = finalPrice(
      terms({
        price: "1.01",
        discount: "50.00",
        discountType: "percent",
        serviceCharge: "1.00",
        serviceChargeType: "percent",
      }),
      "THB",
    );
    expect(final.amount.toString()).toBe("0.51005");
    expect(formatMoney(final)).toBe("0.51 THB");
  });

  it("keeps the provider's currency on both amounts", () => {
    const { final, original } = finalPrice(terms({ discount: "100.00" }), "INR");
    expect([final.currency, original?.currency]).toEqual(["INR", "INR"]);
  });
});

describe("fromPrice", () => {
  it("service 0003 shows From 1,800.00 THB, 60 min", () => {
    const price = fromPrice(
      [
        { durationInMinutes: 60, ...terms({ price: "1800.00" }) },
        {
          durationInMinutes: 90,
          ...terms({ price: "2400.00", discount: "15.00", discountType: "percent" }),
        },
      ],
      "THB",
    );
    expect(describePrice(price)).toBe("From 1,800.00 THB, 60 min");
  });

  it("picks the cheapest option by final price, not list price, with its own struck-through price", () => {
    const price = fromPrice(
      [
        { durationInMinutes: 60, ...terms({ price: "2000.00" }) },
        {
          durationInMinutes: 90,
          ...terms({ price: "2400.00", discount: "25.00", discountType: "percent" }),
        },
      ],
      "THB",
    );
    expect(describePrice(price)).toBe("From 1,800.00 THB, 90 min, was 2,400.00 THB");
  });

  it("picks the shorter option when two cost the same", () => {
    const price = fromPrice(
      [
        { durationInMinutes: 90, ...terms() },
        { durationInMinutes: 60, ...terms() },
      ],
      "THB",
    );
    expect(describePrice(price)).toBe("From 1,000.00 THB, 60 min");
  });

  it("ignores a discount larger than the price on a wellness option too", () => {
    const price = fromPrice(
      [{ durationInMinutes: 30, ...terms({ price: "450.00", discount: "600.00" }) }],
      "THB",
    );
    expect(describePrice(price)).toBe("From 450.00 THB, 30 min");
  });

  it("shows From 0.00 for a wellness option priced 0, not Free (spec Decisions)", () => {
    const price = fromPrice([{ durationInMinutes: 30, ...terms({ price: "0.00" }) }], "THB");
    expect(describePrice(price)).toBe("From 0.00 THB, 30 min");
  });

  it("gives no price for a wellness service with no options, never 0", () => {
    expect(fromPrice([], "THB")).toBeUndefined();
  });
});
