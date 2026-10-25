import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { readForwardedMockParams } from "@/lib/mock/flags";
import { fakeFailureResponse } from "@/lib/mock/latency-and-failure";

// fetch-api.ts remembers which :once rules have fired for the life of the page.
// Each test imports a fresh copy so that memory starts empty, like a page load.
async function loadFetchApi() {
  vi.resetModules();
  return import("./fetch-api");
}

function setPageUrl(pathAndSearch: string) {
  window.history.replaceState({}, "", pathAndSearch);
}

// Stands in for a mock endpoint, built from the real server helpers (minus the latency), so these
// tests check the client against the real wire format. fetchApi always calls fetch with a URL.
// The type names init too, so tests can read the options fetch was called with.
const fakeServer = vi.fn<(url: URL, init?: RequestInit) => Promise<Response>>((url) => {
  const { status } = readForwardedMockParams(url.searchParams);
  return Promise.resolve(
    status === undefined ? Response.json({ hello: "world" }) : fakeFailureResponse(status),
  );
});

function requestedUrl(call: number): URL {
  const url = fakeServer.mock.calls[call]?.[0];
  if (url === undefined) throw new Error(`fetch was not called ${String(call + 1)} times`);
  return url;
}

beforeEach(() => {
  setPageUrl("/");
  fakeServer.mockClear();
  vi.stubGlobal("fetch", fakeServer);
});

afterEach(() => {
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
});

describe("fetchApi", () => {
  it("returns ok with the data when nothing fails", async () => {
    const { fetchApi } = await loadFetchApi();
    expect(await fetchApi("/api/mock/cart", { endpoint: "cart" })).toEqual({
      kind: "ok",
      data: { hello: "world" },
    });
  });

  it("checkout:500:once fails the first call and lets the retry through", async () => {
    const { fetchApi } = await loadFetchApi();
    setPageUrl("/cart?mockFail=checkout:500:once");

    const first = await fetchApi("/api/mock/checkout", { endpoint: "checkout", method: "POST" });
    const retry = await fetchApi("/api/mock/checkout", { endpoint: "checkout", method: "POST" });

    expect(first).toEqual({ kind: "server", status: 500 });
    expect(retry.kind).toBe("ok");
    expect(requestedUrl(0).searchParams.get("mockStatus")).toBe("500");
    expect(requestedUrl(1).searchParams.has("mockStatus")).toBe(false);
  });

  it("checkout@package:500:once fails only the package group, once", async () => {
    const { fetchApi } = await loadFetchApi();
    setPageUrl("/cart?mockFail=checkout@package:500:once");
    const checkout = (group: string) =>
      fetchApi("/api/mock/checkout", { endpoint: "checkout", group, method: "POST" });

    expect((await checkout("lab_test")).kind).toBe("ok");
    expect((await checkout("package")).kind).toBe("server");
    expect((await checkout("wellness")).kind).toBe("ok");
    expect((await checkout("package")).kind).toBe("ok");
  });

  it("a rule without :once fails every matching call", async () => {
    const { fetchApi } = await loadFetchApi();
    setPageUrl("/booking?mockFail=book:409");

    expect((await fetchApi("/api/mock/bookings", { endpoint: "book" })).kind).toBe("conflict");
    expect((await fetchApi("/api/mock/bookings", { endpoint: "book" })).kind).toBe("conflict");
  });

  it("a faked 402 is declined with no message, so the screen uses its own copy", async () => {
    const { fetchApi } = await loadFetchApi();
    setPageUrl("/cart?mockFail=checkout:402");

    expect(await fetchApi("/api/mock/checkout", { endpoint: "checkout" })).toEqual({
      kind: "declined",
      message: undefined,
    });
  });

  it("forwards mockDelay to the endpoint", async () => {
    const { fetchApi } = await loadFetchApi();
    setPageUrl("/services?mockDelay=3000");

    await fetchApi("/api/mock/service", { endpoint: "services" });

    expect(requestedUrl(0).searchParams.get("mockDelay")).toBe("3000");
  });

  it("keeps the endpoint's own query params", async () => {
    const { fetchApi } = await loadFetchApi();
    setPageUrl("/booking?mockDelay=100");

    await fetchApi("/api/mock/providers/7/slots?date=2026-10-30", { endpoint: "slots" });

    const url = requestedUrl(0);
    expect(url.pathname).toBe("/api/mock/providers/7/slots");
    expect(url.searchParams.get("date")).toBe("2026-10-30");
    expect(url.searchParams.get("mockDelay")).toBe("100");
  });

  it("a network rule sends the request, then loses the reply", async () => {
    const { fetchApi } = await loadFetchApi();
    setPageUrl("/cart?mockFail=checkout:network:once");

    const first = await fetchApi("/api/mock/checkout", { endpoint: "checkout", method: "POST" });
    const retry = await fetchApi("/api/mock/checkout", { endpoint: "checkout", method: "POST" });

    expect(first).toEqual({ kind: "network" });
    expect(retry.kind).toBe("ok");
    // The server did see the first request: the outcome is unknown, not "never sent".
    expect(fakeServer).toHaveBeenCalledTimes(2);
  });

  it("returns offline without sending anything when mockOffline=1", async () => {
    const { fetchApi } = await loadFetchApi();
    setPageUrl("/cart?mockOffline=1");

    expect(await fetchApi("/api/mock/cart", { endpoint: "cart" })).toEqual({ kind: "offline" });
    expect(fakeServer).not.toHaveBeenCalled();
  });

  it("being offline does not use up a :once rule", async () => {
    const { fetchApi } = await loadFetchApi();
    setPageUrl("/cart?mockFail=checkout:500:once&mockOffline=1");
    await fetchApi("/api/mock/checkout", { endpoint: "checkout", method: "POST" });

    setPageUrl("/cart?mockFail=checkout:500:once");
    const backOnline = await fetchApi("/api/mock/checkout", {
      endpoint: "checkout",
      method: "POST",
    });

    expect(backOnline).toEqual({ kind: "server", status: 500 });
  });

  it("returns offline when the browser says it is offline", async () => {
    const { fetchApi } = await loadFetchApi();
    vi.spyOn(navigator, "onLine", "get").mockReturnValue(false);

    expect(await fetchApi("/api/mock/cart", { endpoint: "cart" })).toEqual({ kind: "offline" });
    expect(fakeServer).not.toHaveBeenCalled();
  });

  it("sends the body as JSON", async () => {
    const { fetchApi } = await loadFetchApi();

    await fetchApi("/api/mock/cart/items/l1", {
      endpoint: "cart-item",
      method: "PATCH",
      body: { quantity: 3 },
    });

    const init = fakeServer.mock.calls[0]?.[1];
    expect(init).toMatchObject({ method: "PATCH", body: '{"quantity":3}' });
  });

  it("gives every request a timeout signal, so a hung call ends as network", async () => {
    const { fetchApi } = await loadFetchApi();

    await fetchApi("/api/mock/cart", { endpoint: "cart" });

    expect(fakeServer.mock.calls[0]?.[1]?.signal).toBeInstanceOf(AbortSignal);
  });

  // Both reach the same catch: fetch only throws when there is no HTTP reply at all.
  it.each([
    ["the connection fails", new TypeError("Failed to fetch")],
    ["the timeout aborts it", new DOMException("The operation timed out.", "TimeoutError")],
  ])("returns network when %s", async (_case, error) => {
    const { fetchApi } = await loadFetchApi();
    vi.stubGlobal(
      "fetch",
      vi.fn(() => Promise.reject(error)),
    );

    expect(await fetchApi("/api/mock/cart", { endpoint: "cart" })).toEqual({ kind: "network" });
  });
});

// Calls fetchApi once with fetch answering this exact response.
async function resultFor(response: Response) {
  const { fetchApi } = await loadFetchApi();
  vi.stubGlobal(
    "fetch",
    vi.fn(() => Promise.resolve(response)),
  );
  return fetchApi("/api/mock/cart", { endpoint: "cart" });
}

describe("fetchApi turns each HTTP status into a result kind", () => {
  it("201 is ok", async () => {
    expect(await resultFor(Response.json({ orderId: "o1" }, { status: 201 }))).toEqual({
      kind: "ok",
      data: { orderId: "o1" },
    });
  });

  it("204 is ok with no data", async () => {
    expect(await resultFor(new Response(null, { status: 204 }))).toEqual({
      kind: "ok",
      data: null,
    });
  });

  it("a 200 with an empty body is ok with no data", async () => {
    expect(await resultFor(new Response("", { status: 200 }))).toEqual({
      kind: "ok",
      data: null,
    });
  });

  it("402 is declined, with the server's message", async () => {
    const response = Response.json({ message: "Card refused" }, { status: 402 });
    expect(await resultFor(response)).toEqual({ kind: "declined", message: "Card refused" });
  });

  it("409 is conflict, with the server's message", async () => {
    const response = Response.json(
      { message: "You can book at most 10 of this test" },
      { status: 409 },
    );
    expect(await resultFor(response)).toEqual({
      kind: "conflict",
      message: "You can book at most 10 of this test",
    });
  });

  it("409 without a readable message is still a conflict", async () => {
    expect(await resultFor(new Response("not json", { status: 409 }))).toEqual({
      kind: "conflict",
      message: undefined,
    });
  });

  it.each([500, 503, 404, 400])("%s is server, with the status", async (status) => {
    expect(await resultFor(new Response(null, { status }))).toEqual({ kind: "server", status });
  });

  it("a 200 whose body isn't JSON is server, not a crash", async () => {
    expect(await resultFor(new Response("<html>", { status: 200 }))).toEqual({
      kind: "server",
      status: 200,
    });
  });
});

describe("isOffline", () => {
  it("follows mockOffline=1 so the banner and the fetch layer agree", async () => {
    const { isOffline } = await loadFetchApi();
    expect(isOffline()).toBe(false);
    setPageUrl("/cart?mockOffline=1");
    expect(isOffline()).toBe(true);
  });
});
