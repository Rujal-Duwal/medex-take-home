import { describe, expect, it } from "vitest";
import { parseMoney, type Currency } from "@/lib/money/money";
import {
  canRestore,
  removeCompared,
  restoreCompared,
  toCompareTrayView,
  toCompareView,
  toggleCompared,
} from "./compare";
import { defaultQuery, type ServiceQuery } from "./engine";
import type { ChipView } from "./filters-view";
import { shownAmount } from "./pricing";
import type { Catalogue, Price, Provider, Service } from "./types";
import type { ServicesUrlState } from "./url-codec";

// A small mapped catalogue, run through the real engine, so "matching" means what the results
// list shows.

const thailand = { code: "TH", name: "Thailand" };
const riverside: Provider = {
  id: 48,
  name: "Riverside International Hospital",
  currency: "THB",
  city: { slug: "bangkok", name: "Bangkok" },
  country: thailand,
  rating: { kind: "rated", stars: 4.7, reviewCount: 1203 },
};
const chaoPhraya: Provider = {
  id: 52,
  name: "Chao Phraya Hospital",
  currency: "THB",
  city: { slug: "bangkok", name: "Bangkok" },
  country: thailand,
  rating: { kind: "rated", stars: 4.5, reviewCount: 88 },
};
const himal: Provider = {
  id: 70,
  name: "Himal Hospital",
  currency: "NPR",
  city: { slug: "kathmandu", name: "Kathmandu" },
  country: { code: "NP", name: "Nepal" },
  rating: { kind: "new" },
};
const lanna: Provider = {
  id: 50,
  name: "Lanna Medical Centre",
  currency: "THB",
  city: { slug: "chiang-mai", name: "Chiang Mai" },
  country: thailand,
  rating: { kind: "new" },
};

function fixed(amount: string, currency: Currency): Price {
  return { kind: "fixed", final: parseMoney(amount, currency) };
}

function service(id: string, owner: Provider, price: Price, testAtHome = false): Service {
  return {
    id,
    title: `Service ${id}`,
    type: "package",
    providerId: owner.id,
    categoryKey: "other",
    testAtHome,
    price,
    payableAmounts: [shownAmount(price, owner.currency)],
    search: { title: `service ${id}`, category: "", provider: "" },
  };
}

const catalogue: Catalogue = {
  categories: [],
  providers: [riverside, chaoPhraya, himal, lanna],
  services: [
    service("r1", riverside, fixed("5970.60", "THB")),
    service("r2", riverside, fixed("1200.00", "THB"), true),
    service("r3", riverside, { kind: "free" }),
    service("c1", chaoPhraya, fixed("2500.00", "THB")),
    service("c2", chaoPhraya, {
      kind: "from",
      lowest: parseMoney("1800.00", "THB"),
      durationInMinutes: 60,
    }),
    service("h1", himal, fixed("3000.00", "NPR"), true),
    service("l1", lanna, fixed("1800.00", "THB")),
  ],
};

function urlState(ids: number[], query: Partial<ServiceQuery> = {}): ServicesUrlState {
  return { query: { ...defaultQuery, ...query }, compareProviderIds: ids };
}

function viewFor(ids: number[], query: Partial<ServiceQuery> = {}, chips: ChipView[] = []) {
  return toCompareView(catalogue, urlState(ids, query), chips);
}

function column(view: ReturnType<typeof viewFor>, providerId: number) {
  const found = view.providers.find((item) => item.providerId === providerId);
  if (found === undefined) throw new Error(`provider ${String(providerId)} is not compared`);
  return found;
}

describe("toggleCompared", () => {
  it("adds a provider at the end, and removes it when ticked again", () => {
    expect(toggleCompared([48], 70)).toEqual([48, 70]);
    expect(toggleCompared([48, 70], 48)).toEqual([70]);
  });

  it("never adds a 4th provider", () => {
    expect(toggleCompared([48, 52, 70], 50)).toEqual([48, 52, 70]);
  });
});

describe("removeCompared and restoreCompared (Undo)", () => {
  it("Undo puts the provider back in the place it was removed from", () => {
    const removed = removeCompared([48, 52, 70], 52);
    expect(removed.ids).toEqual([48, 70]);
    expect(restoreCompared(removed.ids, removed.undo)).toEqual([48, 52, 70]);
  });

  it("Undo does nothing if the provider is back already, or there is no room left", () => {
    const removed = removeCompared([48, 52, 70], 52);
    expect(restoreCompared([48, 52, 70], removed.undo)).toEqual([48, 52, 70]);
    expect(restoreCompared([48, 70, 50], removed.undo)).toEqual([48, 70, 50]);
  });

  it("Undo after the list got shorter puts it at the end", () => {
    const removed = removeCompared([48, 52, 70], 70);
    expect(restoreCompared([48], removed.undo)).toEqual([48, 70]);
  });
});

describe("canRestore", () => {
  it("Undo can work while the provider is out and there is room", () => {
    const { undo } = removeCompared([48, 52, 70], 52);
    expect(canRestore([48, 70], undo)).toBe(true);
    expect(canRestore([48, 52, 70], undo)).toBe(false);
    expect(canRestore([48, 70, 50], undo)).toBe(false);
  });
});

describe("toCompareTrayView", () => {
  it("names the chosen providers in the order they were picked", () => {
    const tray = toCompareTrayView(catalogue, [70, 48]);
    expect(tray.providers).toEqual([
      { providerId: 70, name: "Himal Hospital" },
      { providerId: 48, name: "Riverside International Hospital" },
    ]);
    expect(tray.compareLabel).toBe("Compare (2)");
    expect(tray.hint).toBeUndefined();
  });

  it("hints at picking another with 1, and at the limit with 3", () => {
    expect(toCompareTrayView(catalogue, [48]).hint).toBe("Pick at least one more to compare");
    expect(toCompareTrayView(catalogue, [48, 52, 70]).hint).toBe("You can compare up to 3");
  });

  it("is empty with nothing chosen", () => {
    expect(toCompareTrayView(catalogue, []).providers).toEqual([]);
  });
});

describe("toCompareView", () => {
  it("shows each provider's rating, location, matching services and home test", () => {
    const view = viewFor([48, 70]);
    expect(view.title).toBe("Compare 2 providers");
    expect(column(view, 48)).toMatchObject({
      name: "Riverside International Hospital",
      rating: { kind: "rated", stars: "4.7", reviews: "1,203 reviews" },
      place: "Bangkok, Thailand",
      matchingText: "3 services",
      homeTestText: "Yes, 1 service",
    });
    expect(column(view, 70)).toMatchObject({
      rating: { kind: "new" },
      place: "Kathmandu, Nepal",
      homeTestText: "Yes, 1 service",
    });
  });

  it("keeps the order the providers were picked in", () => {
    expect(viewFor([70, 48]).providers.map((item) => item.providerId)).toEqual([70, 48]);
  });

  it("the price range runs from the cheapest to the dearest shown price, Free first", () => {
    expect(column(viewFor([48, 52]), 48).priceRange).toBe("Free to 5,970.60 THB");
  });

  it("a wellness service counts at its From price, like its card", () => {
    expect(column(viewFor([48, 52]), 52).priceRange).toBe("1,800.00 THB to 2,500.00 THB");
  });

  it("one matching service, or all at one price, shows a single amount", () => {
    expect(column(viewFor([48, 70]), 70).priceRange).toBe("3,000.00 NPR");
  });

  it("counts only services that match the filters", () => {
    const view = viewFor([48, 52], { homeTestOnly: true });
    expect(column(view, 48)).toMatchObject({
      matchingText: "1 service",
      priceRange: "1,200.00 THB",
    });
  });

  it("a provider with nothing matching says so, and has no price range", () => {
    const chao = column(viewFor([48, 52], { homeTestOnly: true }), 52);
    expect(chao).toMatchObject({
      matchingText: "None with your filters",
      homeTestText: "No",
    });
    expect(chao.priceRange).toBeUndefined();
    expect(chao.lowestLabel).toBeUndefined();
  });

  it("ignores the provider filter, so a compared provider outside it isn't shown as 0", () => {
    expect(column(viewFor([48, 52], { providerIds: [48] }), 52).matchingText).toBe("2 services");
  });

  it("marks the lowest price among providers in one currency", () => {
    const view = viewFor([48, 52]);
    // Riverside starts at Free, below Chao Phraya's 1,800.00.
    expect(column(view, 48).lowestLabel).toBe("Lowest price");
    expect(column(view, 52).lowestLabel).toBeUndefined();
    expect(view.hasMixedCurrencies).toBe(false);
  });

  it("marks every provider tied on the lowest price", () => {
    const view = viewFor([52, 50]);
    expect(column(view, 52).lowestLabel).toBe("Lowest price");
    expect(column(view, 50).lowestLabel).toBe("Lowest price");
  });

  it("with mixed currencies, marks the lowest only within a currency two providers share", () => {
    const view = viewFor([48, 52, 70]);
    expect(view.hasMixedCurrencies).toBe(true);
    expect(column(view, 48).lowestLabel).toBe("Lowest price in THB");
    expect(column(view, 52).lowestLabel).toBeUndefined();
    // Himal is the only NPR provider: there is nothing to be lowest against.
    expect(column(view, 70).lowestLabel).toBeUndefined();
  });

  it("marks nothing when no two providers share a currency", () => {
    const view = viewFor([48, 70]);
    expect(view.providers.map((item) => item.lowestLabel)).toEqual([undefined, undefined]);
  });

  it("a provider with nothing matching doesn't stop the others being compared", () => {
    const view = viewFor([48, 52, 50], { homeTestOnly: true });
    // Only Riverside has a home test, so it has nothing in its currency to be lowest against.
    expect(column(view, 48).lowestLabel).toBeUndefined();
  });

  it("names the filters the counts are under, leaving out the provider filter", () => {
    const chips: ChipView[] = [
      { id: "chip-type-package", label: "Package", change: { kind: "type", type: "package" } },
      { id: "chip-provider-48", label: "Riverside", change: { kind: "provider", id: 48 } },
      { id: "chip-location", label: "Bangkok", change: { kind: "location" } },
    ];
    expect(viewFor([48, 52], {}, chips).filtersText).toBe("With your filters: Package, Bangkok");
    expect(viewFor([48, 52]).filtersText).toBe("With no filters applied");
  });

  it("View services links to that provider's matching services, opened in place", () => {
    const view = viewFor([48, 52], { homeTestOnly: true, providerIds: [52], page: 3 });
    expect(column(view, 48).viewServicesHref).toBe(
      "/services?provider=48&home=1&open=48&compare=48%2C52",
    );
  });

  it("with 1 provider there is nothing to compare yet", () => {
    const view = viewFor([48]);
    expect(view.title).toBe("Compare 1 provider");
    expect(column(view, 48).lowestLabel).toBeUndefined();
  });
});
