// Every mock flag's syntax lives in this file (ADR 0003, ADR 0011).
//
// Two hops:
// 1. The page URL holds what a reviewer typed: ?mockDelay=3000&mockFail=checkout@package:500:once&mockOffline=1
//    The client fetch layer (src/lib/api/fetch-api.ts) parses it with parseMockFlags and picks
//    the rule for each call with findFailRule.
// 2. The client forwards only the outcome to the endpoint: ?mockDelay=3000&mockStatus=500
//    The server helper (latency-and-failure.ts) reads it with readForwardedMockParams.
//
// This file is pure and never imports data/, because the client bundle imports it.

// Names used in ?mockFail=<endpoint>:<kind>. Each spec's "Mock endpoints" section lists them.
// A new endpoint gets its name added here.
const MOCK_ENDPOINTS = [
  // Task 1
  "categories",
  "providers",
  "services",
  // Task 2
  "cart",
  "cart-item",
  "cart-delete",
  "merge",
  "checkout",
  "orders",
  // Task 3
  "provider",
  "slots",
  "availability",
  "book",
  "reschedule",
] as const;
export type MockEndpoint = (typeof MOCK_ENDPOINTS)[number];

// Statuses the server can fake. "network" is faked by the client instead, since a server
// can't send "no reply".
const FAKE_STATUSES = ["500", "402", "409"] as const;
export type FakeStatus = (typeof FAKE_STATUSES)[number];
export type MockFailKind = FakeStatus | "network";

export type MockFailRule = {
  // The rule as typed, for example "checkout@package:500:once". Used to remember a fired :once
  // rule. Two identical rules share this text, so they fire once between them, which is fine.
  text: string;
  endpoint: MockEndpoint;
  // Only fail calls for this cart group (Task 2), for example "package". undefined means every call.
  group: string | undefined;
  kind: MockFailKind;
  once: boolean;
};

export type MockFlags = {
  delayMs: number;
  failRules: MockFailRule[];
  offline: boolean;
};

// Long enough to show a slow state, short enough that a typo like 300000 doesn't hang the page.
export const MAX_DELAY_MS = 20_000;

// .some instead of .includes: TypeScript won't let a plain string be passed to .includes on a
// list of literal names. These guards also tell TypeScript the string is one of the names.
function isMockEndpoint(name: string): name is MockEndpoint {
  return MOCK_ENDPOINTS.some((endpoint) => endpoint === name);
}

function isFakeStatus(value: string): value is FakeStatus {
  return FAKE_STATUSES.some((status) => status === value);
}

function isMockFailKind(value: string): value is MockFailKind {
  return value === "network" || isFakeStatus(value);
}

// "abc", "-5" or a missing value means no extra delay.
function parseDelayMs(value: string | null): number {
  const ms = Number(value);
  if (!Number.isFinite(ms) || ms < 0) return 0;
  return Math.min(Math.round(ms), MAX_DELAY_MS);
}

// "<endpoint>[@<group>]:<kind>[:once]". Anything else returns undefined and is ignored,
// so one typo doesn't break the other rules.
export function parseFailRule(rawText: string): MockFailRule | undefined {
  const text = rawText.trim();
  const [target, kind, onceWord, ...extra] = text.split(":");
  if (target === undefined || kind === undefined || extra.length > 0) return undefined;
  if (onceWord !== undefined && onceWord !== "once") return undefined;
  if (!isMockFailKind(kind)) return undefined;

  const [endpoint, group, ...extraTargets] = target.split("@");
  if (endpoint === undefined || !isMockEndpoint(endpoint)) return undefined;
  if (group === "" || extraTargets.length > 0) return undefined;

  return { text, endpoint, group, kind, once: onceWord === "once" };
}

// search is window.location.search, for example "?mockFail=checkout:500,cart:network".
// Rules can be comma-separated or given as several mockFail params; both are read.
export function parseMockFlags(search: string): MockFlags {
  const params = new URLSearchParams(search);
  const failRules: MockFailRule[] = [];
  for (const text of params.getAll("mockFail").join(",").split(",")) {
    const rule = parseFailRule(text);
    if (rule) failRules.push(rule);
  }
  return {
    delayMs: parseDelayMs(params.get("mockDelay")),
    failRules,
    offline: params.get("mockOffline") === "1",
  };
}

// The first rule that matches this call, in the order the rules were typed.
// firedOnce holds the text of :once rules that already failed a call; those are skipped.
export function findFailRule(
  rules: MockFailRule[],
  endpoint: MockEndpoint,
  group: string | undefined,
  firedOnce: ReadonlySet<string>,
): MockFailRule | undefined {
  return rules.find(
    (rule) =>
      rule.endpoint === endpoint &&
      (rule.group === undefined || rule.group === group) &&
      !(rule.once && firedOnce.has(rule.text)),
  );
}

// Client side of hop 2: the params added to the endpoint URL.
export function forwardedMockParams(
  delayMs: number,
  failKind: MockFailKind | undefined,
): URLSearchParams {
  const params = new URLSearchParams();
  if (delayMs > 0) params.set("mockDelay", String(delayMs));
  if (failKind !== undefined && failKind !== "network") params.set("mockStatus", failKind);
  return params;
}

// Server side of hop 2. Checks the values again, because anyone can type an API URL by hand.
export function readForwardedMockParams(params: URLSearchParams): {
  delayMs: number;
  status: FakeStatus | undefined;
} {
  const status = params.get("mockStatus") ?? "";
  return {
    delayMs: parseDelayMs(params.get("mockDelay")),
    status: isFakeStatus(status) ? status : undefined,
  };
}
