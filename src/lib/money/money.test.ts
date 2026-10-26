import { describe, expect, it } from "vitest";
import { addMoney, formatMoney, parseMoney } from "./money";

describe("formatMoney", () => {
  it("shows a THB price with grouping, 2 decimals and the code after a space", () => {
    expect(formatMoney(parseMoney("5970.6", "THB"))).toBe("5,970.60 THB");
  });

  it("shows NPR the same way", () => {
    expect(formatMoney(parseMoney("1250", "NPR"))).toBe("1,250.00 NPR");
  });

  it("shows INR the same way", () => {
    expect(formatMoney(parseMoney("23009.5", "INR"))).toBe("23,009.50 INR");
  });

  it("uses en-US grouping for INR over 100,000, not Indian lakh grouping", () => {
    // en-IN would print 1,23,456.00. We keep one grouping style so mixed lists read the same.
    expect(formatMoney(parseMoney("123456", "INR"))).toBe("123,456.00 INR");
  });

  it("rounds half-up to 2 decimals only when formatting", () => {
    expect(formatMoney(parseMoney("10.005", "THB"))).toBe("10.01 THB");
    expect(formatMoney(parseMoney("10.004", "THB"))).toBe("10.00 THB");
  });

  it("keeps large amounts exact, with no float drift", () => {
    expect(formatMoney(parseMoney("12345678901234.565", "THB"))).toBe("12,345,678,901,234.57 THB");
  });

  it("prints zero as a number, never as Free (the price kind decides Free)", () => {
    expect(formatMoney(parseMoney("0.00", "THB"))).toBe("0.00 THB");
  });
});

describe("parseMoney", () => {
  it("refuses text that is not a decimal number", () => {
    expect(() => parseMoney("abc", "THB")).toThrow();
    expect(() => parseMoney("", "THB")).toThrow();
  });
});

describe("addMoney", () => {
  it("adds two amounts in the same currency exactly", () => {
    const sum = addMoney(parseMoney("0.1", "THB"), parseMoney("0.2", "THB"));
    expect(sum.currency).toBe("THB");
    expect(sum.amount.toString()).toBe("0.3");
  });

  it("never adds different currencies", () => {
    expect(() => addMoney(parseMoney("100", "THB"), parseMoney("100", "NPR"))).toThrow(
      "Can't add NPR to THB",
    );
  });
});
