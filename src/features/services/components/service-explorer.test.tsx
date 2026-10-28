import { act, fireEvent, render, screen, within } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { ApiResult } from "@/lib/api/fetch-api";
import { LiveAnnouncerProvider } from "@/lib/a11y/live-announcer";
import { parseMoney } from "@/lib/money/money";
import { loadCatalogue } from "../api";
import type { ResultsView } from "../results-view";
import type { Catalogue } from "../types";
import { ServiceExplorer } from "./service-explorer";

// The hand-over: the server's results show until the client has loaded the catalogue, then
// the client's own results take over. The API call and the router are faked; the engine and
// the view model are real.

vi.mock("../api", () => ({ loadCatalogue: vi.fn() }));
vi.mock("next/navigation", () => ({
  useSearchParams: () => new URLSearchParams(window.location.search),
}));

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
    testAtHome: false,
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

function renderExplorer() {
  render(
    <LiveAnnouncerProvider>
      <ServiceExplorer serverView={serverView} />
    </LiveAnnouncerProvider>,
  );
}

beforeEach(() => {
  window.history.replaceState({}, "", "/services");
  mockedLoad.mockReset();
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
});
