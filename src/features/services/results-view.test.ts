import { describe, expect, it } from "vitest";
import { parseMoney, type Currency } from "@/lib/money/money";
import { defaultQuery, type ProviderGroup, type QueryResult, type ServiceQuery } from "./engine";
import { resultCountText, toResultsView } from "./results-view";
import type { Price, Provider, ProviderRating, Service } from "./types";
import type { ServicesUrlState } from "./url-codec";

// Small results in the engine's output shape, built by hand: these tests are about what the
// list shows for a result, not about which services match.

function provider(id: number, name: string, currency: Currency, rating: ProviderRating): Provider {
  const places = {
    THB: { city: { slug: "bangkok", name: "Bangkok" }, country: { code: "TH", name: "Thailand" } },
    NPR: {
      city: { slug: "kathmandu", name: "Kathmandu" },
      country: { code: "NP", name: "Nepal" },
    },
    INR: {
      city: { slug: "new-delhi", name: "New Delhi" },
      country: { code: "IN", name: "India" },
    },
  };
  return { id, name, currency, ...places[currency], rating };
}

const wellRated: ProviderRating = { kind: "rated", stars: 4.7, reviewCount: 1203 };
const riverside = provider(48, "Riverside International Hospital", "THB", wellRated);
const himal = provider(70, "Himal Hospital", "NPR", wellRated);
const sukhumvit = provider(61, "Sukhumvit New Clinic", "THB", { kind: "new" });

function fixed(final: string, currency: Currency, original?: string): Price {
  return original === undefined
    ? { kind: "fixed", final: parseMoney(final, currency) }
    : {
        kind: "fixed",
        final: parseMoney(final, currency),
        original: parseMoney(original, currency),
      };
}

function service(id: string, price: Price, overrides: Partial<Service> = {}): Service {
  return {
    id,
    title: "Executive Health Check (Male)",
    type: "package",
    providerId: 48,
    categoryKey: "package.health-check-up",
    testAtHome: false,
    price,
    payableAmounts: [],
    search: { title: "", category: "", provider: "" },
    ...overrides,
  };
}

function group(
  groupProvider: Provider,
  services: Service[],
  matchingCount = services.length,
  isOpen = false,
): ProviderGroup {
  return { provider: groupProvider, services, matchingCount, isOpen };
}

function result(groups: ProviderGroup[], overrides: Partial<QueryResult> = {}): QueryResult {
  return {
    groups,
    serviceCount: groups.reduce((sum, { matchingCount }) => sum + matchingCount, 0),
    providerCount: groups.length,
    page: 1,
    pageCount: 1,
    facetCounts: {
      type: new Map(),
      category: new Map(),
      provider: new Map(),
      location: new Map(),
      currency: new Map(),
      homeTest: 0,
    },
    ...overrides,
  };
}

function urlState(query: Partial<ServiceQuery> = {}): ServicesUrlState {
  return { query: { ...defaultQuery, ...query }, compareProviderIds: [] };
}

const thbCheckup = service("0001", fixed("5970.60", "THB", "6634.00"));

function onlyGroup(view: ReturnType<typeof toResultsView>) {
  const found = view.sections[0]?.groups[0];
  if (found === undefined) throw new Error("expected one group");
  return found;
}

describe("resultCountText", () => {
  it("says 124 services from 18 providers", () => {
    expect(resultCountText(124, 18)).toBe("124 services from 18 providers");
  });

  it("groups thousands like the prices do", () => {
    expect(resultCountText(2853, 65)).toBe("2,853 services from 65 providers");
  });

  it("uses the singular for one", () => {
    expect(resultCountText(1, 1)).toBe("1 service from 1 provider");
  });

  it("says nothing matches when there are no services", () => {
    expect(resultCountText(0, 0)).toBe("No services match your filters");
  });
});

describe("toResultsView: prices", () => {
  it("service 0001 shows 5,970.60 THB with 6,634.00 THB struck through", () => {
    const view = toResultsView(result([group(riverside, [thbCheckup])]), urlState());
    expect(onlyGroup(view).services[0]?.price).toEqual({
      kind: "fixed",
      final: "5,970.60 THB",
      original: "6,634.00 THB",
    });
  });

  it("a price with no discount has nothing struck through", () => {
    const view = toResultsView(
      result([group(riverside, [service("0005", fixed("450.00", "THB"))])]),
      urlState(),
    );
    expect(onlyGroup(view).services[0]?.price).toEqual({ kind: "fixed", final: "450.00 THB" });
  });

  it("service 0003 shows From 1,800.00 THB with its 60 min duration", () => {
    const facial = service(
      "0003",
      { kind: "from", lowest: parseMoney("1800.00", "THB"), durationInMinutes: 60 },
      { type: "wellness", title: "Signature Facial" },
    );
    const view = toResultsView(result([group(riverside, [facial])]), urlState());
    expect(onlyGroup(view).services[0]?.price).toEqual({
      kind: "from",
      lowest: "1,800.00 THB",
      duration: "60 min",
    });
  });

  it("service 0006 shows Free, never 0.00", () => {
    const view = toResultsView(
      result([group(riverside, [service("0006", { kind: "free" })])]),
      urlState(),
    );
    expect(onlyGroup(view).services[0]?.price).toEqual({ kind: "free" });
  });

  it("labels each service with its type in words", () => {
    const labTest = service("0010", fixed("300.00", "THB"), { type: "lab_test" });
    const view = toResultsView(result([group(riverside, [labTest])]), urlState());
    expect(onlyGroup(view).services[0]?.typeLabel).toBe("Lab test");
  });
});

describe("toResultsView: providers", () => {
  it("shows the rating with one decimal and the review count", () => {
    const view = toResultsView(result([group(riverside, [thbCheckup])]), urlState());
    expect(onlyGroup(view)).toMatchObject({
      name: "Riverside International Hospital",
      place: "Bangkok, Thailand",
      rating: { kind: "rated", stars: "4.7", reviews: "1,203 reviews" },
    });
  });

  it("says 1 review, not 1 reviews", () => {
    const oneReview = provider(49, "Small Clinic", "THB", {
      kind: "rated",
      stars: 5,
      reviewCount: 1,
    });
    const view = toResultsView(result([group(oneReview, [thbCheckup])]), urlState());
    expect(onlyGroup(view).rating).toEqual({ kind: "rated", stars: "5.0", reviews: "1 review" });
  });

  it("provider 61 has no rating yet, so it is new, not 0 stars", () => {
    const view = toResultsView(result([group(sukhumvit, [thbCheckup])]), urlState());
    expect(onlyGroup(view).rating).toEqual({ kind: "new" });
  });
});

describe("toResultsView: View all N services (D10)", () => {
  const preview = [
    thbCheckup,
    service("0011", fixed("100.00", "THB")),
    service("0012", fixed("200.00", "THB")),
  ];

  it("has no link when every matching service already shows", () => {
    const view = toResultsView(result([group(riverside, preview, 3)]), urlState());
    expect(onlyGroup(view).toggle).toBeUndefined();
  });

  it("links to the same view with the group open", () => {
    const view = toResultsView(
      result([group(riverside, preview, 14)]),
      urlState({ search: "check up", page: 1 }),
    );
    expect(onlyGroup(view).toggle).toEqual({
      label: "View all 14 services",
      href: "/services?q=check+up&open=48",
    });
  });

  it("an open group links back to the view without it", () => {
    const view = toResultsView(
      result([group(riverside, preview, 14, true)]),
      urlState({ openProviderIds: [70, 48] }),
    );
    expect(onlyGroup(view).toggle).toEqual({
      label: "Show fewer",
      href: "/services?open=70",
    });
  });
});

describe("toResultsView: an open group with 3 or fewer matches", () => {
  it("has no Show fewer link, since there is nothing to hide", () => {
    const view = toResultsView(
      result([group(riverside, [thbCheckup], 1, true)]),
      urlState({ openProviderIds: [48] }),
    );
    expect(onlyGroup(view).toggle).toBeUndefined();
  });
});

describe("toResultsView: what is read out", () => {
  it("reads out the count alone with one page", () => {
    const view = toResultsView(result([group(riverside, [thbCheckup])]), urlState());
    expect(view.announcement).toBe("1 service from 1 provider");
  });

  it("adds the page when there are several, so a page change is heard", () => {
    const view = toResultsView(
      result([group(riverside, [thbCheckup], 30)], {
        page: 2,
        pageCount: 3,
        serviceCount: 124,
        providerCount: 18,
      }),
      urlState({ page: 2 }),
    );
    expect(view.announcement).toBe("124 services from 18 providers, page 2 of 3");
  });
});

describe("toResultsView: currency sections (D8)", () => {
  const groups = [
    group(riverside, [thbCheckup]),
    group(sukhumvit, [thbCheckup]),
    group(himal, [service("0002", fixed("3000.00", "NPR", "3500.00"), { providerId: 70 })]),
  ];

  it("splits a price sort with no currency chosen into one section per currency", () => {
    const view = toResultsView(result(groups), urlState({ sort: "price-asc" }));
    expect(
      view.sections.map(({ heading, groups: inSection }) => [heading, inSection.length]),
    ).toEqual([
      ["Prices in THB", 2],
      ["Prices in NPR", 1],
    ]);
    expect(view.sectionNote).toBe(
      "Sorted by price within each currency. We don't convert between currencies.",
    );
  });

  it("keeps one section with no heading when the price filter sets a currency", () => {
    const view = toResultsView(
      result(groups.slice(0, 2), { priceCurrency: "THB" }),
      urlState({ sort: "price-desc", price: { currency: "THB" } }),
    );
    expect(view.sections).toHaveLength(1);
    expect(view.sections[0]?.heading).toBeUndefined();
    expect(view.sectionNote).toBeUndefined();
  });

  it("keeps one section with no heading for the relevance sort", () => {
    const view = toResultsView(result(groups), urlState());
    expect(view.sections).toHaveLength(1);
    expect(view.sections[0]?.heading).toBeUndefined();
  });

  it("has no sections when nothing matches", () => {
    expect(toResultsView(result([]), urlState()).sections).toEqual([]);
  });
});

describe("toResultsView: pagination (D9)", () => {
  it("has no pagination with one page", () => {
    expect(
      toResultsView(result([group(riverside, [thbCheckup])]), urlState()).pagination,
    ).toBeUndefined();
  });

  it("links every page, leaving page 1 out of the URL", () => {
    const view = toResultsView(
      result([group(riverside, [thbCheckup])], { page: 2, pageCount: 3 }),
      urlState({ homeTestOnly: true, page: 2 }),
    );
    expect(view.pagination).toEqual({
      label: "Page 2 of 3",
      previousHref: "/services?home=1",
      nextHref: "/services?home=1&page=3",
      pages: [
        { number: 1, href: "/services?home=1", isCurrent: false },
        { number: 2, href: "/services?home=1&page=2", isCurrent: true },
        { number: 3, href: "/services?home=1&page=3", isCurrent: false },
      ],
    });
  });

  it("a page past the end shows the page the engine picked, with no next link", () => {
    const view = toResultsView(
      result([group(riverside, [thbCheckup])], { page: 3, pageCount: 3 }),
      urlState({ page: 9 }),
    );
    expect(view.pagination?.label).toBe("Page 3 of 3");
    expect(view.pagination?.nextHref).toBeUndefined();
    expect(view.pagination?.previousHref).toBe("/services?page=2");
  });

  it("a View all link on a page past the end keeps the page the customer sees", () => {
    const preview = [thbCheckup, thbCheckup, thbCheckup];
    const view = toResultsView(
      result([group(riverside, preview, 5)], { page: 3, pageCount: 3 }),
      urlState({ page: 9 }),
    );
    expect(onlyGroup(view).toggle?.href).toBe("/services?page=3&open=48");
  });
});
