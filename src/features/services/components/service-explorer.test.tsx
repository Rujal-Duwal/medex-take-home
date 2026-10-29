import { act, fireEvent, render, screen, within } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { ApiResult } from "@/lib/api/fetch-api";
import { LiveAnnouncerProvider } from "@/lib/a11y/live-announcer";
import { parseMoney } from "@/lib/money/money";
import { loadCatalogue } from "../api";
import { defaultQuery, runQuery } from "../engine";
import { toFiltersView } from "../filters-view";
import type { ResultsView } from "../results-view";
import type { Catalogue } from "../types";
import { ServiceExplorer } from "./service-explorer";

// The hand-over: the server's results show until the client has loaded the catalogue, then
// the client's own results take over. The API call and the router are faked; the engine and
// the view model are real.

vi.mock("../api", () => ({ loadCatalogue: vi.fn() }));

// Next.js re-renders useSearchParams after history.pushState and replaceState. The fake does
// the same: beforeEach wraps both to tell the subscribers the URL changed.
const urlStore = vi.hoisted(() => {
  const listeners = new Set<() => void>();
  return {
    subscribe: (listener: () => void) => {
      listeners.add(listener);
      return () => {
        listeners.delete(listener);
      };
    },
    changed: () => {
      for (const listener of listeners) listener();
    },
  };
});
vi.mock("next/navigation", async () => {
  const { useSyncExternalStore } = await import("react");
  return {
    useSearchParams: () =>
      new URLSearchParams(useSyncExternalStore(urlStore.subscribe, () => window.location.search)),
  };
});

const mockedLoad = vi.mocked(loadCatalogue);

// What the server rendered. The provider name differs from the client's catalogue on purpose,
// so the tests can see which side is showing. The count matches, as it does in the app, so the
// tests can check the hand-over is silent.
const serverView: ResultsView = {
  countText: "2 services from 1 provider",
  announcement: "2 services from 1 provider",
  sections: [
    {
      groups: [
        {
          providerId: 48,
          name: "Riverside (server render)",
          place: "Bangkok, Thailand",
          rating: { kind: "new" },
          services: [],
        },
      ],
    },
  ],
};

const catalogue: Catalogue = {
  categories: [],
  providers: [
    {
      id: 48,
      name: "Riverside International Hospital",
      currency: "THB",
      city: { slug: "bangkok", name: "Bangkok" },
      country: { code: "TH", name: "Thailand" },
      rating: { kind: "rated", stars: 4.7, reviewCount: 1203 },
    },
  ],
  services: ["0001", "0002"].map((id) => ({
    id,
    title: "Executive Health Check (Male)",
    type: "package" as const,
    providerId: 48,
    categoryKey: "other",
    // One of the two is a home test, so ticking that filter changes the count.
    testAtHome: id === "0002",
    price: { kind: "fixed" as const, final: parseMoney("5970.60", "THB") },
    payableAmounts: [parseMoney("5970.60", "THB")],
    search: { title: "executive health check male", category: "", provider: "riverside" },
  })),
};

const loaded: ApiResult<Catalogue> = { kind: "ok", data: catalogue };

function liveRegion(): HTMLElement {
  const region = document.querySelector("output");
  if (region === null) throw new Error("the live region is missing");
  return region;
}

// The server's panel, from the same catalogue (the server's names don't matter for it).
const serverFilters = toFiltersView(catalogue, runQuery(catalogue, defaultQuery), defaultQuery);

function renderExplorer() {
  render(
    <LiveAnnouncerProvider>
      <ServiceExplorer serverView={serverView} serverFilters={serverFilters} />
    </LiveAnnouncerProvider>,
  );
}

// Calls the real method, then tells useSearchParams, as Next.js does.
function fakeHistoryMethod(method: "pushState" | "replaceState") {
  const original = window.history[method].bind(window.history);
  return vi.spyOn(window.history, method).mockImplementation((data, unused, url) => {
    original(data, unused, url);
    urlStore.changed();
  });
}
let pushState: ReturnType<typeof fakeHistoryMethod>;
let replaceState: ReturnType<typeof fakeHistoryMethod>;

beforeEach(() => {
  window.history.replaceState({}, "", "/services");
  mockedLoad.mockReset();
  pushState = fakeHistoryMethod("pushState");
  replaceState = fakeHistoryMethod("replaceState");
});

afterEach(() => {
  vi.useRealTimers();
  vi.restoreAllMocks();
});

describe("ServiceExplorer", () => {
  it("shows the server's results while loading, then the client's", async () => {
    const loading = Promise.withResolvers<ApiResult<Catalogue>>();
    mockedLoad.mockReturnValue(loading.promise);
    renderExplorer();

    expect(screen.getByRole("heading", { name: "Riverside (server render)" })).toBeVisible();

    loading.resolve(loaded);
    expect(
      await screen.findByRole("heading", { name: "Riverside International Hospital" }),
    ).toBeVisible();
    expect(screen.getByRole("heading", { name: "2 services from 1 provider" })).toBeVisible();
    // Same count on both sides, so nothing is read out: nothing changed for the customer.
    expect(liveRegion()).toHaveTextContent("");
  });

  it("a failed load shows the error; Try again moves focus to the results and loads again", async () => {
    mockedLoad.mockResolvedValueOnce({ kind: "server", status: 500 }).mockResolvedValueOnce(loaded);
    renderExplorer();

    const alert = await screen.findByRole("alert");
    expect(alert).toHaveTextContent("We couldn't load services");
    expect(
      screen.queryByRole("heading", { name: "Riverside (server render)" }),
    ).not.toBeInTheDocument();

    fireEvent.click(within(alert).getByRole("button", { name: "Try again" }));

    expect(screen.getByRole("region", { name: "Results" })).toHaveFocus();
    expect(
      await screen.findByRole("heading", { name: "Riverside International Hospital" }),
    ).toBeVisible();
    expect(mockedLoad).toHaveBeenCalledTimes(2);
    // Read out once the retry brings results back, though it is the same as the server's count.
    await vi.waitFor(() => {
      expect(liveRegion()).toHaveTextContent("2 services from 1 provider");
    });
  });

  it("offline keeps the server's results and says they will update", async () => {
    window.history.replaceState({}, "", "/services?mockOffline=1");
    mockedLoad.mockResolvedValue({ kind: "offline" });
    renderExplorer();

    expect(await screen.findByText(/You're offline/)).toBeVisible();
    expect(screen.getByRole("heading", { name: "Riverside (server render)" })).toBeVisible();
    expect(screen.queryByRole("alert")).not.toBeInTheDocument();
  });

  it("back online it loads again and keeps the results up meanwhile", async () => {
    window.history.replaceState({}, "", "/services?mockOffline=1");
    mockedLoad.mockResolvedValueOnce({ kind: "offline" });
    renderExplorer();
    // Let the load come back offline. The banner alone isn't enough: it reads the URL flag and
    // shows before the load has finished, and the online listener starts only once it has.
    await act(async () => {
      await Promise.resolve();
    });

    const loading = Promise.withResolvers<ApiResult<Catalogue>>();
    mockedLoad.mockReturnValueOnce(loading.promise);
    window.history.replaceState({}, "", "/services");
    act(() => {
      globalThis.dispatchEvent(new Event("online"));
    });

    expect(mockedLoad).toHaveBeenCalledTimes(2);
    expect(screen.getByRole("heading", { name: "Riverside (server render)" })).toBeVisible();
    loading.resolve(loaded);
    expect(
      await screen.findByRole("heading", { name: "Riverside International Hospital" }),
    ).toBeVisible();
  });

  it("says it is taking longer after 3 seconds, on screen and to screen readers", () => {
    vi.useFakeTimers();
    mockedLoad.mockReturnValue(new Promise(() => undefined));
    renderExplorer();
    const slow = "This is taking longer than usual. We're still loading services.";

    act(() => {
      vi.advanceTimersByTime(2999);
    });
    expect(screen.queryByText(slow, { selector: "[data-slot=alert-description]" })).toBeNull();

    // 1 ms more starts the note; the live region fills on the next tick.
    act(() => {
      vi.advanceTimersByTime(1);
    });
    act(() => {
      vi.advanceTimersByTime(0);
    });
    expect(screen.getByText(slow, { selector: "[data-slot=alert-description]" })).toBeVisible();
    expect(liveRegion()).toHaveTextContent(slow);
  });
  it("the filters wait for the catalogue; then a tick writes the URL and updates the results", async () => {
    const loading = Promise.withResolvers<ApiResult<Catalogue>>();
    mockedLoad.mockReturnValue(loading.promise);
    renderExplorer();

    const homeTest = screen.getByRole("checkbox", { name: /Available as a home test/ });
    expect(homeTest).toBeDisabled();

    loading.resolve(loaded);
    await vi.waitFor(() => {
      expect(homeTest).toBeEnabled();
    });
    fireEvent.click(homeTest);

    expect(window.location.search).toBe("?home=1");
    expect(await screen.findByRole("heading", { name: "1 service from 1 provider" })).toBeVisible();
    expect(screen.getByRole("checkbox", { name: /Available as a home test/ })).toBeChecked();
    await vi.waitFor(() => {
      expect(liveRegion()).toHaveTextContent("1 service from 1 provider");
    });
  });

  it("a tick adds a history entry; typing adds one for the first letter, then replaces it", async () => {
    mockedLoad.mockResolvedValue(loaded);
    renderExplorer();
    const homeTest = screen.getByRole("checkbox", { name: /Available as a home test/ });
    await vi.waitFor(() => {
      expect(homeTest).toBeEnabled();
    });

    fireEvent.click(homeTest);
    expect(pushState).toHaveBeenCalledTimes(1);

    const search = screen.getByRole("searchbox", { name: "Search" });
    // Only a space is no search, so the view doesn't change and nothing is written.
    fireEvent.change(search, { target: { value: " " } });
    expect(pushState).toHaveBeenCalledTimes(1);
    expect(replaceState).not.toHaveBeenCalled();

    fireEvent.change(search, { target: { value: "e" } });
    expect(pushState).toHaveBeenCalledTimes(2);
    expect(pushState).toHaveBeenLastCalledWith(null, "", "/services?q=e&home=1");

    fireEvent.change(search, { target: { value: "exec" } });
    expect(pushState).toHaveBeenCalledTimes(2);
    expect(replaceState).toHaveBeenLastCalledWith(null, "", "/services?q=exec&home=1");

    // After a tick, the next letter starts a new entry, so Back undoes the tick on its own.
    fireEvent.click(screen.getByRole("checkbox", { name: /Available as a home test/ }));
    fireEvent.change(search, { target: { value: "execu" } });
    expect(pushState).toHaveBeenCalledTimes(4);
    expect(pushState).toHaveBeenLastCalledWith(null, "", "/services?q=execu");
  });

  it("Clear all removes the filters and moves focus to the Filters heading", async () => {
    window.history.replaceState({}, "", "/services?home=1&sort=rating");
    mockedLoad.mockResolvedValue(loaded);
    renderExplorer();

    const clearAll = await screen.findByRole("button", { name: "Clear all" });
    await vi.waitFor(() => {
      expect(clearAll).toBeEnabled();
    });
    fireEvent.click(clearAll);

    expect(window.location.search).toBe("?sort=rating");
    expect(screen.getByRole("heading", { name: "Filters" })).toHaveFocus();
    await vi.waitFor(() => {
      expect(screen.queryByRole("button", { name: "Clear all" })).not.toBeInTheDocument();
    });
  });
});
