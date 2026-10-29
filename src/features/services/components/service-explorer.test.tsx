import { act, fireEvent, render, screen, within } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { ApiResult } from "@/lib/api/fetch-api";
import { LiveAnnouncerProvider } from "@/lib/a11y/live-announcer";
import { parseMoney } from "@/lib/money/money";
import { loadCatalogue } from "../api";
import type { CompareTrayView } from "../compare";
import { defaultQuery, runQuery } from "../engine";
import { toFiltersView } from "../filters-view";
import type { ResultsView } from "../results-view";
import type { Catalogue } from "../types";
import { SEARCH_SEND_INTERVAL_MS } from "./search-box";
import { ServiceExplorer } from "./service-explorer";

// The hand-over: the server's results show until the client has loaded the catalogue, then
// the client's own results take over. The API call and the router are faked; the engine and
// the view model are real.

vi.mock("../api", () => ({ loadCatalogue: vi.fn() }));

// Next.js re-renders useSearchParams after history.pushState and replaceState. The fake does
// the same: beforeEach wraps both to tell the subscribers the URL changed. Like Next, it keeps
// its own copy of the URL, so it only moves when told.
const urlStore = vi.hoisted(() => {
  const listeners = new Set<() => void>();
  let search = "";
  return {
    search: () => search,
    subscribe: (listener: () => void) => {
      listeners.add(listener);
      return () => {
        listeners.delete(listener);
      };
    },
    changed: () => {
      search = window.location.search;
      for (const listener of listeners) listener();
    },
  };
});
vi.mock("next/navigation", async () => {
  const { useSyncExternalStore } = await import("react");
  return {
    useSearchParams: () =>
      new URLSearchParams(useSyncExternalStore(urlStore.subscribe, urlStore.search)),
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
          compare: { isChosen: false, isFull: false },
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

const noCompareTray: CompareTrayView = { providers: [], compareLabel: "Compare (0)" };

function renderExplorer(serverCompareTray = noCompareTray) {
  render(
    <LiveAnnouncerProvider>
      <ServiceExplorer
        serverView={serverView}
        serverFilters={serverFilters}
        serverCompareTray={serverCompareTray}
      />
    </LiveAnnouncerProvider>,
  );
}

// The panel's search box. Below the large breakpoint a second one sits above the results; both
// are in the DOM (jsdom has no CSS), and either writes the same URL.
function searchInPanel(): HTMLElement {
  const panel = screen.getByRole("complementary", { name: "Filters" });
  return within(panel).getByRole("searchbox", { name: "Search" });
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
  urlStore.changed();
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

  it("a change is timed once, up to the commit that shows its results (T1-12)", async () => {
    mockedLoad.mockResolvedValue(loaded);
    renderExplorer();
    const homeTest = screen.getByRole("checkbox", { name: /Available as a home test/ });
    await vi.waitFor(() => {
      expect(homeTest).toBeEnabled();
    });
    performance.clearMeasures("filter-change");

    fireEvent.click(homeTest);
    expect(await screen.findByRole("heading", { name: "1 service from 1 provider" })).toBeVisible();
    expect(performance.getEntriesByName("filter-change")).toHaveLength(1);

    // A change that leaves the URL the same shows nothing new, so it isn't timed.
    fireEvent.change(searchInPanel(), { target: { value: " " } });
    expect(performance.getEntriesByName("filter-change")).toHaveLength(1);
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

    // The search box sends typing on at most once every 250 ms (SearchBox). Fake timers let
    // each letter through.
    vi.useFakeTimers();
    function type(value: string) {
      fireEvent.change(searchInPanel(), { target: { value } });
      act(() => {
        vi.advanceTimersByTime(SEARCH_SEND_INTERVAL_MS);
      });
    }

    // Only a space is no search, so the view doesn't change and nothing is written.
    type(" ");
    expect(pushState).toHaveBeenCalledTimes(1);
    expect(replaceState).not.toHaveBeenCalled();

    type("e");
    expect(pushState).toHaveBeenCalledTimes(2);
    expect(pushState).toHaveBeenLastCalledWith(null, "", "/services?q=e&home=1");

    type("exec");
    expect(pushState).toHaveBeenCalledTimes(2);
    expect(replaceState).toHaveBeenLastCalledWith(null, "", "/services?q=exec&home=1");

    // After a tick, the next letter starts a new entry, so Back undoes the tick on its own.
    fireEvent.click(screen.getByRole("checkbox", { name: /Available as a home test/ }));
    type("execu");
    expect(pushState).toHaveBeenCalledTimes(4);
    expect(pushState).toHaveBeenLastCalledWith(null, "", "/services?q=execu");
  });

  it("Clear all removes the filters and moves focus to the Filters heading", async () => {
    window.history.replaceState({}, "", "/services?home=1&sort=rating");
    mockedLoad.mockResolvedValue(loaded);
    renderExplorer();

    const panel = screen.getByRole("complementary", { name: "Filters" });
    const clearAll = await within(panel).findByRole("button", { name: "Clear all" });
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

// Opens the page at url with the catalogue loaded and the chip row enabled.
async function renderLoadedAt(url: string) {
  window.history.replaceState({}, "", url);
  mockedLoad.mockResolvedValue(loaded);
  renderExplorer();
  const chips = await screen.findByRole("list", { name: "Active filters" });
  await vi.waitFor(() => {
    expect(within(chips).getByRole("button", { name: "Clear all filters" })).toBeEnabled();
  });
  return chips;
}

describe("ServiceExplorer: active filter chips", () => {
  it("removing a chip moves focus to the next one; removing the last moves it to the results", async () => {
    const chips = await renderLoadedAt("/services?type=package&home=1");

    fireEvent.click(within(chips).getByRole("button", { name: "Remove filter: Package" }));
    expect(window.location.search).toBe("?home=1");
    expect(
      await screen.findByRole("button", { name: "Remove filter: Home test available" }),
    ).toHaveFocus();

    fireEvent.click(screen.getByRole("button", { name: "Remove filter: Home test available" }));
    expect(window.location.search).toBe("");
    await vi.waitFor(() => {
      expect(screen.getByRole("region", { name: "Results" })).toHaveFocus();
    });
    expect(screen.queryByRole("list", { name: "Active filters" })).not.toBeInTheDocument();
  });

  it("removing the last chip in the row moves focus to Clear all filters", async () => {
    const chips = await renderLoadedAt("/services?type=package&home=1");

    fireEvent.click(
      within(chips).getByRole("button", { name: "Remove filter: Home test available" }),
    );
    expect(window.location.search).toBe("?type=package");
    await vi.waitFor(() => {
      expect(within(chips).getByRole("button", { name: "Clear all filters" })).toHaveFocus();
    });
  });

  it("Clear all filters in the row removes every filter and moves focus to the results", async () => {
    const chips = await renderLoadedAt("/services?type=package&home=1&sort=rating");

    fireEvent.click(within(chips).getByRole("button", { name: "Clear all filters" }));
    expect(window.location.search).toBe("?sort=rating");
    expect(screen.getByRole("region", { name: "Results" })).toHaveFocus();
  });
});

describe("ServiceExplorer: search chip", () => {
  it("removing the search right after typing adds a history entry, so Back brings it back", async () => {
    await renderLoadedAt("/services?home=1");
    const search = searchInPanel();
    fireEvent.change(search, { target: { value: "e" } });
    fireEvent.change(search, { target: { value: "exec" } });
    // "exec" waits in the search box (sent at most every 250 ms). Clicking the chip takes focus
    // from the box first, which sends it.
    fireEvent.blur(search);
    expect(pushState).toHaveBeenCalledTimes(1);
    expect(replaceState).toHaveBeenLastCalledWith(null, "", "/services?q=exec&home=1");

    fireEvent.click(await screen.findByRole("button", { name: "Remove filter: “exec”" }));
    expect(pushState).toHaveBeenCalledTimes(2);
    expect(pushState).toHaveBeenLastCalledWith(null, "", "/services?home=1");
  });
});

describe("ServiceExplorer: no results", () => {
  it("offers the filters to remove, most results first, and moves focus to the results", async () => {
    // "nothing" finds no service. Without the search: 1 home test. Without the home test
    // filter: still nothing, so it isn't offered.
    window.history.replaceState({}, "", "/services?q=nothing&home=1");
    mockedLoad.mockResolvedValue(loaded);
    renderExplorer();

    expect(await screen.findByRole("heading", { name: "No services match" })).toBeVisible();
    const results = screen.getByRole("region", { name: "Results" });
    const buttons = within(results).getAllByRole("button");
    expect(buttons.map((button) => button.textContent)).toEqual([
      "Clear the search (1 service)",
      "Clear all filters (2 services)",
    ]);
    await vi.waitFor(() => {
      expect(buttons[0]).toBeEnabled();
    });

    fireEvent.click(within(results).getByRole("button", { name: "Clear the search (1 service)" }));

    expect(window.location.search).toBe("?home=1");
    expect(results).toHaveFocus();
    expect(await screen.findByRole("heading", { name: "1 service from 1 provider" })).toBeVisible();
  });
});

// Opens the page at url with the catalogue loaded, then opens the drawer.
async function openDrawerAt(url: string) {
  window.history.replaceState({}, "", url);
  mockedLoad.mockResolvedValue(loaded);
  renderExplorer();
  const trigger = screen.getByRole("button", { name: /^Filters/ });
  await vi.waitFor(() => {
    expect(trigger).toBeEnabled();
  });
  fireEvent.click(trigger);
  return { trigger, drawer: screen.getByRole("dialog", { name: "Filters" }) };
}

describe("ServiceExplorer: compare (WBS 3.10)", () => {
  it("ticking Compare on a card adds the provider to the URL and the tray", async () => {
    mockedLoad.mockResolvedValue(loaded);
    renderExplorer();
    const box = await screen.findByRole("checkbox", {
      name: "Compare Riverside International Hospital",
    });

    fireEvent.click(box);
    expect(window.location.search).toBe("?compare=48");
    expect(pushState).toHaveBeenCalledTimes(1);
    expect(box).toBeChecked();
    const tray = screen.getByRole("region", { name: "Compare tray" });
    expect(within(tray).getByText("Pick at least one more to compare")).toBeVisible();

    fireEvent.click(box);
    expect(window.location.search).toBe("");
    expect(screen.queryByRole("region", { name: "Compare tray" })).not.toBeInTheDocument();
  });

  it("the Compare box and the tray from the server wait for the catalogue, like the filters", () => {
    window.history.replaceState({}, "", "/services?compare=48");
    mockedLoad.mockReturnValue(Promise.withResolvers<ApiResult<Catalogue>>().promise);
    renderExplorer({
      providers: [{ providerId: 48, name: "Riverside International Hospital" }],
      compareLabel: "Compare (1)",
      hint: "Pick at least one more to compare",
    });

    expect(
      screen.getByRole("checkbox", { name: "Compare Riverside (server render)" }),
    ).toBeDisabled();
    const tray = screen.getByRole("region", { name: "Compare tray" });
    for (const button of within(tray).getAllByRole("button")) expect(button).toBeDisabled();
  });

  it("compare is not a filter: a tick and Clear all keep it in the URL", async () => {
    window.history.replaceState({}, "", "/services?compare=48");
    urlStore.changed();
    mockedLoad.mockResolvedValue(loaded);
    renderExplorer();
    const homeTest = screen.getByRole("checkbox", { name: /Available as a home test/ });
    await vi.waitFor(() => {
      expect(homeTest).toBeEnabled();
    });

    fireEvent.click(homeTest);
    expect(window.location.search).toBe("?home=1&compare=48");

    const panel = screen.getByRole("complementary", { name: "Filters" });
    fireEvent.click(await within(panel).findByRole("button", { name: "Clear all" }));
    expect(window.location.search).toBe("?compare=48");
  });
});

describe("ServiceExplorer: mobile filters drawer", () => {
  it("the search box on the page writes the URL as you type, like the panel's", async () => {
    window.history.replaceState({}, "", "/services");
    mockedLoad.mockResolvedValue(loaded);
    renderExplorer();
    // The page's box is the one outside the panel.
    const onPage = screen
      .getAllByRole("searchbox", { name: "Search" })
      .find((box) => box !== searchInPanel());
    if (onPage === undefined) throw new Error("the search box on the page is missing");
    await vi.waitFor(() => {
      expect(onPage).toBeEnabled();
    });

    fireEvent.change(onPage, { target: { value: "exec" } });
    expect(window.location.search).toBe("?q=exec");
  });

  it("the draft starts from the address bar, with text typed just before tapping Filters", async () => {
    window.history.replaceState({}, "", "/services");
    mockedLoad.mockResolvedValue(loaded);
    renderExplorer();
    const onPage = screen
      .getAllByRole("searchbox", { name: "Search" })
      .find((box) => box !== searchInPanel());
    if (onPage === undefined) throw new Error("the search box on the page is missing");
    await vi.waitFor(() => {
      expect(onPage).toBeEnabled();
    });
    fireEvent.focus(onPage);
    fireEvent.change(onPage, { target: { value: "e" } });

    // Next applies a URL change in a transition, so on a quick tap the drawer can open before
    // useSearchParams has the text the box sent on blur. The fake router lags the same way:
    // the address bar moves, useSearchParams doesn't.
    replaceState.mockImplementation((data, unused, url) => {
      History.prototype.replaceState.call(window.history, data, unused, url);
    });
    fireEvent.change(onPage, { target: { value: "exec" } });
    fireEvent.blur(onPage);
    expect(window.location.search).toBe("?q=exec");

    fireEvent.click(screen.getByRole("button", { name: /^Filters/ }));
    const drawer = screen.getByRole("dialog", { name: "Filters" });
    fireEvent.click(within(drawer).getByRole("button", { name: "Show 2 results" }));
    // The draft held "exec", the same as the address bar, so applying it changes nothing.
    expect(window.location.search).toBe("?q=exec");
  });

  it("counts the pending filters without changing the URL, then applies them in one entry", async () => {
    const { trigger, drawer } = await openDrawerAt("/services");
    expect(within(drawer).getByRole("heading", { name: "Filters" })).toHaveFocus();
    // One panel at a time, so ids stay unique.
    expect(screen.queryByRole("complementary", { name: "Filters" })).not.toBeInTheDocument();
    expect(within(drawer).getByRole("button", { name: "Show 2 results" })).toBeVisible();

    fireEvent.click(within(drawer).getByRole("checkbox", { name: /Available as a home test/ }));
    expect(within(drawer).getByRole("button", { name: "Show 1 result" })).toBeVisible();
    expect(window.location.search).toBe("");
    expect(pushState).not.toHaveBeenCalled();
    await vi.waitFor(() => {
      expect(liveRegion()).toHaveTextContent("1 result with these filters");
    });

    fireEvent.click(within(drawer).getByRole("button", { name: "Show 1 result" }));
    expect(window.location.search).toBe("?home=1");
    expect(pushState).toHaveBeenCalledTimes(1);
    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
    await vi.waitFor(() => {
      expect(trigger).toHaveFocus();
    });
    expect(trigger).toHaveAccessibleName("Filters (1)");
  });

  it("Esc throws the draft away and returns focus to Filters", async () => {
    const { trigger, drawer } = await openDrawerAt("/services");
    fireEvent.click(within(drawer).getByRole("checkbox", { name: /Available as a home test/ }));

    fireEvent.keyDown(drawer, { key: "Escape" });
    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
    expect(window.location.search).toBe("");
    await vi.waitFor(() => {
      expect(trigger).toHaveFocus();
    });

    fireEvent.click(trigger);
    const reopened = screen.getByRole("dialog", { name: "Filters" });
    expect(
      within(reopened).getByRole("checkbox", { name: /Available as a home test/ }),
    ).not.toBeChecked();
  });

  it("with nothing found the button says so, stays focusable and does nothing", async () => {
    const { drawer } = await openDrawerAt("/services?q=nothing");
    const apply = within(drawer).getByRole("button", { name: "No results, change filters" });
    expect(apply).toHaveAttribute("aria-disabled", "true");
    expect(apply).toBeEnabled();

    fireEvent.click(apply);
    expect(screen.getByRole("dialog", { name: "Filters" })).toBeVisible();
    expect(pushState).not.toHaveBeenCalled();
  });

  it("Clear removes the drawer's filters and keeps the search, which is on the page", async () => {
    const { drawer } = await openDrawerAt("/services?q=exec&home=1");
    expect(within(drawer).getByRole("button", { name: "Show 1 result" })).toBeVisible();

    fireEvent.click(within(drawer).getByRole("button", { name: "Clear" }));
    fireEvent.click(within(drawer).getByRole("button", { name: "Show 2 results" }));
    expect(window.location.search).toBe("?q=exec");
  });
});
