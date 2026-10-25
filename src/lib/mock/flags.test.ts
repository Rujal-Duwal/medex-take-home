import { describe, expect, it } from "vitest";
import {
  findFailRule,
  forwardedMockParams,
  parseFailRule,
  parseMockFlags,
  readForwardedMockParams,
} from "./flags";

describe("parseFailRule", () => {
  it("reads endpoint and kind", () => {
    expect(parseFailRule("checkout:500")).toEqual({
      text: "checkout:500",
      endpoint: "checkout",
      group: undefined,
      kind: "500",
      once: false,
    });
  });

  it("reads :once", () => {
    expect(parseFailRule("cart-item:409:once")).toMatchObject({
      endpoint: "cart-item",
      kind: "409",
      once: true,
    });
  });

  it("reads a group target like checkout@package:500:once", () => {
    expect(parseFailRule("checkout@package:500:once")).toEqual({
      text: "checkout@package:500:once",
      endpoint: "checkout",
      group: "package",
      kind: "500",
      once: true,
    });
  });

  it("reads the network kind", () => {
    expect(parseFailRule("slots:network")).toMatchObject({ endpoint: "slots", kind: "network" });
  });

  it("ignores spaces around the rule", () => {
    expect(parseFailRule("  book:409 ")).toMatchObject({ text: "book:409", endpoint: "book" });
  });

  it.each([
    ["unknown endpoint", "checkuot:500"],
    ["unknown kind", "checkout:404"],
    ["missing kind", "checkout"],
    ["something other than once at the end", "checkout:500:twice"],
    ["too many parts", "checkout:500:once:again"],
    ["empty group", "checkout@:500"],
    ["two groups", "checkout@package@wellness:500"],
    ["empty text", ""],
  ])("ignores a rule with %s (%s)", (_case, text) => {
    expect(parseFailRule(text)).toBeUndefined();
  });
});

describe("parseMockFlags", () => {
  it("gives no delay, no failures and online when the URL has no flags", () => {
    expect(parseMockFlags("")).toEqual({ delayMs: 0, failRules: [], offline: false });
  });

  it("reads comma-separated rules in the order written", () => {
    const flags = parseMockFlags("?mockFail=checkout@package:500:once,cart:network");
    expect(flags.failRules.map((rule) => rule.text)).toEqual([
      "checkout@package:500:once",
      "cart:network",
    ]);
  });

  it("reads rules from several mockFail params too", () => {
    const flags = parseMockFlags("?mockFail=checkout:500&mockFail=cart:409,book:network");
    expect(flags.failRules.map((rule) => rule.text)).toEqual([
      "checkout:500",
      "cart:409",
      "book:network",
    ]);
  });

  it("keeps the good rules when one rule is mistyped", () => {
    const flags = parseMockFlags("?mockFail=checkout:500,oops,book:409");
    expect(flags.failRules.map((rule) => rule.text)).toEqual(["checkout:500", "book:409"]);
  });

  it("reads mockDelay in milliseconds", () => {
    expect(parseMockFlags("?mockDelay=3000").delayMs).toBe(3000);
  });

  it.each([
    ["not a number", "abc", 0],
    ["negative", "-500", 0],
    ["a fraction", "250.7", 251],
    ["longer than 20 seconds", "60000", 20000],
  ])("treats a mockDelay that is %s sensibly", (_case, value, expected) => {
    expect(parseMockFlags(`?mockDelay=${value}`).delayMs).toBe(expected);
  });

  it("is offline only when mockOffline=1", () => {
    expect(parseMockFlags("?mockOffline=1").offline).toBe(true);
    expect(parseMockFlags("?mockOffline=0").offline).toBe(false);
    expect(parseMockFlags("?mockOffline=true").offline).toBe(false);
  });

  it("ignores page params that are not mock flags", () => {
    expect(parseMockFlags("?category=lab&tz=Asia/Kathmandu")).toEqual({
      delayMs: 0,
      failRules: [],
      offline: false,
    });
  });
});

describe("findFailRule", () => {
  const rulesFrom = (search: string) => parseMockFlags(search).failRules;
  const noneFired = new Set<string>();

  it("finds a rule for the matching endpoint only", () => {
    const rules = rulesFrom("?mockFail=checkout:500");
    expect(findFailRule(rules, "checkout", undefined, noneFired)?.kind).toBe("500");
    expect(findFailRule(rules, "cart", undefined, noneFired)).toBeUndefined();
  });

  it("a rule without a group hits every group of that endpoint", () => {
    const rules = rulesFrom("?mockFail=checkout:402");
    expect(findFailRule(rules, "checkout", "lab_test", noneFired)?.kind).toBe("402");
    expect(findFailRule(rules, "checkout", "package", noneFired)?.kind).toBe("402");
  });

  it("a rule with a group hits only that group", () => {
    const rules = rulesFrom("?mockFail=checkout@package:500");
    expect(findFailRule(rules, "checkout", "package", noneFired)?.kind).toBe("500");
    expect(findFailRule(rules, "checkout", "lab_test", noneFired)).toBeUndefined();
    expect(findFailRule(rules, "checkout", undefined, noneFired)).toBeUndefined();
  });

  it("the first matching rule wins", () => {
    const rules = rulesFrom("?mockFail=checkout@package:409,checkout:500");
    expect(findFailRule(rules, "checkout", "package", noneFired)?.kind).toBe("409");
    expect(findFailRule(rules, "checkout", "lab_test", noneFired)?.kind).toBe("500");
  });

  it("skips a :once rule that has already fired", () => {
    const rules = rulesFrom("?mockFail=checkout:500:once");
    const fired = new Set(["checkout:500:once"]);
    expect(findFailRule(rules, "checkout", undefined, fired)).toBeUndefined();
  });

  it("after a :once rule fires, the next matching rule applies", () => {
    const rules = rulesFrom("?mockFail=checkout:500:once,checkout:402");
    const fired = new Set(["checkout:500:once"]);
    expect(findFailRule(rules, "checkout", undefined, fired)?.kind).toBe("402");
  });

  it("a rule without :once keeps firing", () => {
    const rules = rulesFrom("?mockFail=checkout:500");
    const fired = new Set(["checkout:500"]);
    expect(findFailRule(rules, "checkout", undefined, fired)?.kind).toBe("500");
  });
});

describe("forwarded params between the client and the mock endpoint", () => {
  it("sends the delay and the status to fake", () => {
    const params = forwardedMockParams(3000, "409");
    expect(params.toString()).toBe("mockDelay=3000&mockStatus=409");
    expect(readForwardedMockParams(params)).toEqual({ delayMs: 3000, status: "409" });
  });

  it("sends nothing when there is no delay and no failure", () => {
    expect(forwardedMockParams(0, undefined).toString()).toBe("");
  });

  it("never sends a network failure to the server, because the client fakes it", () => {
    expect(forwardedMockParams(0, "network").toString()).toBe("");
  });

  it("ignores a status the mock can't fake, typed straight into an API URL", () => {
    const params = new URLSearchParams("mockStatus=404&mockDelay=-5");
    expect(readForwardedMockParams(params)).toEqual({ delayMs: 0, status: undefined });
  });
});
