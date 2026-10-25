import { readForwardedMockParams, type FakeStatus } from "./flags";

// Every mock route handler starts with these two lines (CLAUDE.md, "Mock API contract"):
//
//   const fake = await applyMockLatencyAndFailure(request);
//   if (fake) return fake;
//
// The client has already decided whether this call fails (see flags.ts), so this helper keeps
// no memory between requests. That is why :once works the same on every Vercel instance.

const MIN_LATENCY_MS = 300;
const MAX_LATENCY_MS = 800;

// Random 300 to 800 ms, plus the reviewer's ?mockDelay on top.
// random is a parameter so tests can pin it.
export function mockLatencyMs(extraDelayMs: number, random: () => number = Math.random): number {
  return Math.round(MIN_LATENCY_MS + random() * (MAX_LATENCY_MS - MIN_LATENCY_MS)) + extraDelayMs;
}

// A faked failure has a status and no body. One generic message can't fit both a cart 409
// (quantity limit) and a booking 409 (slot taken), so each screen writes its own copy for the
// result kind. Only a real handler error sends a specific { message }.
export function fakeFailureResponse(status: FakeStatus): Response {
  return new Response(null, { status: Number(status) });
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

// Returns the fake failure to send, or null when the handler should carry on and answer.
export async function applyMockLatencyAndFailure(request: Request): Promise<Response | null> {
  const { delayMs, status } = readForwardedMockParams(new URL(request.url).searchParams);
  await sleep(mockLatencyMs(delayMs));
  return status === undefined ? null : fakeFailureResponse(status);
}
