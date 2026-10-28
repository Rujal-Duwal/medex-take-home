import { afterEach, describe, expect, it, vi } from "vitest";
import {
  applyMockDelayToPage,
  applyMockLatencyAndFailure,
  fakeFailureResponse,
  mockLatencyMs,
} from "./latency-and-failure";

describe("mockLatencyMs", () => {
  it("is at least 300 ms", () => {
    expect(mockLatencyMs(0, () => 0)).toBe(300);
  });

  it("is at most 800 ms", () => {
    expect(mockLatencyMs(0, () => 0.9999)).toBe(800);
  });

  it("adds mockDelay on top of the random part", () => {
    expect(mockLatencyMs(3000, () => 0.5)).toBe(3550);
  });
});

describe("fakeFailureResponse", () => {
  it.each([
    ["500", 500],
    ["402", 402],
    ["409", 409],
  ] as const)("fakes a %s with no body, so the screen shows its own copy", async (status, code) => {
    const response = fakeFailureResponse(status);
    expect(response.status).toBe(code);
    expect(await response.text()).toBe("");
  });
});

describe("applyMockLatencyAndFailure", () => {
  afterEach(() => {
    vi.useRealTimers();
  });

  it("waits, then returns the faked failure the client asked for", async () => {
    vi.useFakeTimers();
    const pending = applyMockLatencyAndFailure(
      new Request("http://localhost/api/mock/checkout?mockStatus=409"),
    );
    await vi.advanceTimersByTimeAsync(800);
    expect((await pending)?.status).toBe(409);
  });

  it("returns null when there is no failure, so the handler carries on", async () => {
    vi.useFakeTimers();
    const pending = applyMockLatencyAndFailure(new Request("http://localhost/api/mock/cart"));
    await vi.advanceTimersByTimeAsync(800);
    expect(await pending).toBeNull();
  });

  it("is still waiting before mockDelay has passed", async () => {
    vi.useFakeTimers();
    let settled = false;
    void applyMockLatencyAndFailure(
      new Request("http://localhost/api/mock/cart?mockDelay=3000"),
    ).then(() => {
      settled = true;
    });
    await vi.advanceTimersByTimeAsync(3000);
    expect(settled).toBe(false);
    await vi.advanceTimersByTimeAsync(800);
    expect(settled).toBe(true);
  });
});

// Resolves to whether the page's wait was over by `afterMs`.
async function doneAfter(pageSearch: string, afterMs: number): Promise<boolean> {
  vi.useFakeTimers();
  let done = false;
  void applyMockDelayToPage(new URLSearchParams(pageSearch)).then(() => {
    done = true;
  });
  await vi.advanceTimersByTimeAsync(afterMs);
  return done;
}

describe("applyMockDelayToPage", () => {
  afterEach(() => {
    vi.useRealTimers();
  });

  it("waits out ?mockDelay=3000 from the page URL", async () => {
    expect(await doneAfter("mockDelay=3000", 2999)).toBe(false);
    expect(await doneAfter("mockDelay=3000", 3000)).toBe(true);
  });

  it("doesn't wait at all without mockDelay, not even the random latency", async () => {
    expect(await doneAfter("q=thyroid&mockFail=services:500", 0)).toBe(true);
  });
});
