import {
  findFailRule,
  forwardedMockParams,
  MAX_DELAY_MS,
  parseMockFlags,
  type MockEndpoint,
  type MockFlags,
} from "@/lib/mock/flags";

// The one fetch wrapper every features/<task>/api.ts calls. Client only: it reads the page URL
// from window.location. Server code (like Task 1's first render) reads data through src/lib/mock
// instead.
//
// A failed call never throws: every outcome comes back as an ApiResult, and the UI branches on
// `kind`, never on message text.
//
//   ok        2xx. data is the parsed JSON body, or null when there is no body (204, bare 200).
//   offline   the browser is offline, or ?mockOffline=1. Nothing was sent.
//   network   no reply: fetch failed, timed out, or a "network" mock rule dropped the reply.
//             The server may have done the work, so the outcome is unknown (Task 2 retries
//             checkout with the same key).
//   server    any other status, usually 500. status lets a caller tell 404 from 500.
//   declined  402: the payment was refused.
//   conflict  409: something changed on the server.
//             For both, message is the server's specific reason, written for a customer (for
//             example "You can book at most 10 of this test"). When it is undefined, the screen
//             shows its own copy for that kind; faked failures never send one.
export type ApiResult<T> =
  | { kind: "ok"; data: T }
  | { kind: "offline" }
  | { kind: "network" }
  | { kind: "server"; status: number }
  | { kind: "declined"; message: string | undefined }
  | { kind: "conflict"; message: string | undefined };

export type ApiCall = {
  // The name a reviewer uses in ?mockFail=<endpoint>:<kind>.
  endpoint: MockEndpoint;
  // The cart group type for checkout, so ?mockFail=checkout@package:500 can target one group.
  group?: string;
  method?: "GET" | "POST" | "PUT" | "PATCH" | "DELETE";
  // Sent as JSON.
  body?: unknown;
};

// After this long with no reply we give up and report "network". Built from the mockDelay cap,
// with room for the 300 to 800 ms latency, so a slow-state demo never turns into a timeout.
const TIMEOUT_MS = MAX_DELAY_MS + 5_000;

// Text of the :once rules that have already failed a call. It lives as long as the page:
// a reload forgets it, so a reviewer can replay a demo by reloading (ADR 0011).
const firedOnceRules = new Set<string>();

// Flags are read on every call, not once at start, so they follow client-side navigation.
function readPageMockFlags(): MockFlags {
  return parseMockFlags(window.location.search);
}

// The one offline rule. The offline banner (WBS 2.5) uses this too, so they always agree.
// The banner must call it in an effect, not during render: the server can't know, so it
// would render "online" and the first client render would not match.
// fetchApi passes the flags it already read; the banner calls it with no argument.
export function isOffline(flags: MockFlags = readPageMockFlags()): boolean {
  return !navigator.onLine || flags.offline;
}

export async function fetchApi<T>(path: string, call: ApiCall): Promise<ApiResult<T>> {
  const flags = readPageMockFlags();
  if (isOffline(flags)) return { kind: "offline" };

  const rule = findFailRule(flags.failRules, call.endpoint, call.group, firedOnceRules);
  if (rule?.once) firedOnceRules.add(rule.text);

  // path may already carry the endpoint's own params (?date=...). The mock params are added to them.
  const url = new URL(path, window.location.origin);
  for (const [name, value] of forwardedMockParams(flags.delayMs, rule?.kind)) {
    url.searchParams.set(name, value);
  }

  let response: Response;
  try {
    response = await fetch(url, {
      method: call.method ?? "GET",
      headers: call.body === undefined ? undefined : { "Content-Type": "application/json" },
      body: call.body === undefined ? undefined : JSON.stringify(call.body),
      signal: AbortSignal.timeout(TIMEOUT_MS),
    });
  } catch {
    // fetch only throws when there is no HTTP reply at all (connection lost, timeout).
    return { kind: "network" };
  }

  // The request reached the server and it answered, but we pretend the reply was lost.
  // This is the case idempotent checkout exists for (ADR 0007).
  if (rule?.kind === "network") return { kind: "network" };

  return resultFromResponse<T>(response);
}

async function resultFromResponse<T>(response: Response): Promise<ApiResult<T>> {
  if (response.status === 402) return { kind: "declined", message: await readMessage(response) };
  if (response.status === 409) return { kind: "conflict", message: await readMessage(response) };
  if (!response.ok) return { kind: "server", status: response.status };

  try {
    // JSON.parse is untyped, which is why it can be assigned to T. We trust the shape here
    // because the mock API mirrors api-types.ts; the feature's mapper turns it into UI types.
    // An endpoint that answers with no body (204, or a 200 with nothing in it) must be called
    // as fetchApi<null>, because that is what comes back.
    const text = await response.text();
    const data: T = text === "" ? null : JSON.parse(text);
    return { kind: "ok", data };
  } catch {
    // A 2xx that isn't JSON means something broke on the server side.
    return { kind: "server", status: response.status };
  }
}

// A 402 or 409 body may be { message }. Returns undefined when it isn't that shape,
// and the UI shows its own copy instead.
async function readMessage(response: Response): Promise<string | undefined> {
  try {
    const body: unknown = await response.json();
    if (typeof body === "object" && body !== null && "message" in body) {
      return typeof body.message === "string" ? body.message : undefined;
    }
  } catch {
    // Not JSON: fall through.
  }
  return undefined;
}
