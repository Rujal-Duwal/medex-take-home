import Big from "big.js";
import { describe, expect, it } from "vitest";
import { parseMoney, type Currency } from "@/lib/money/money";
import { defaultQuery, runQuery, type ServiceQuery } from "./engine";
import {
  PROVIDER_PREVIEW_SIZE,
  providersInShortList,
  providersMatchingName,
  toFiltersView,
  type FilterOptionView,
} from "./filters-view";
import {
  OTHER_CATEGORY_KEY,
  type Catalogue,
  type Category,
  type Provider,
  type Service,
  type ServiceType,
} from "./types";

// A small mapped catalogue, run through the real engine, so the counts are the engine's.

function provider(
  id: number,
  name: string,
  currency: Currency,
  city: [string, string],
  country: [string, string],
): Provider {
  return {
    id,
    name,
    currency,
    city: { slug: city[0], name: city[1] },
    country: { code: country[0], name: country[1] },
    rating: { kind: "new" },
  };
}

const thailand: [string, string] = ["TH", "Thailand"];
const riverside = provider(
  48,
  "Riverside International Hospital",
  "THB",
  ["bangkok", "Bangkok"],
  thailand,
);
const lanna = provider(50, "Lanna Medical Centre", "THB", ["chiang-mai", "Chiang Mai"], thailand);
const himal = provider(70, "Himal Hospital", "NPR", ["kathmandu", "Kathmandu"], ["NP", "Nepal"]);

// Keys follow the real data: two ultrasound categories, told apart by type.
const categories: Category[] = [
  {
    key: "package.ultrasound",
    title: "Ultrasound",
    type: "package",
    subcategories: [
      { key: "package.ultrasound.thyroid", title: "Thyroid" },
      { key: "package.ultrasound.abdomen", title: "Abdomen" },
    ],
  },
  { key: "lab_test.ultrasound", title: "Ultrasound", type: "lab_test", subcategories: [] },
];

function service(
  id: string,
  owner: Provider,
  type: ServiceType,
  categoryKey: string,
  subcategoryKey?: string,
  testAtHome = false,
): Service {
  const amount = parseMoney("1000.00", owner.currency);
  return {
    id,
    title: `Service ${id}`,
    type,
    providerId: owner.id,
    categoryKey,
    subcategoryKey,
    testAtHome,
    price: { kind: "fixed", final: amount },
    payableAmounts: [amount],
    search: { title: `service ${id}`, category: "", provider: "" },
  };
}

const catalogue: Catalogue = {
  categories,
  providers: [riverside, lanna, himal],
  services: [
    service("1", riverside, "package", "package.ultrasound", "package.ultrasound.thyroid"),
    service("2", riverside, "package", "package.ultrasound", "package.ultrasound.abdomen"),
    service("3", riverside, "lab_test", "lab_test.ultrasound", undefined, true),
    service("4", lanna, "lab_test", "lab_test.ultrasound"),
    service("5", himal, "package", OTHER_CATEGORY_KEY),
  ],
};

function viewFor(overrides: Partial<ServiceQuery> = {}) {
  const query = { ...defaultQuery, ...overrides };
  return toFiltersView(catalogue, runQuery(catalogue, query), query);
}

// label: count, availability, for compact checks.
function summary(options: FilterOptionView[]): string[] {
  return options.map(
    (option) =>
      `${option.label}: ${option.count}${option.isUnavailable ? " unavailable" : ""}${option.isChecked ? " ticked" : ""}`,
  );
}

describe("toFiltersView", () => {
  it("service types: the ones in the catalogue, with their counts", () => {
    expect(summary(viewFor().types)).toEqual(["Package: 3", "Lab test: 2"]);
  });

  it("a type with 0 results is unavailable, but a ticked one with 0 stays available (D5)", () => {
    const nepal = viewFor({ location: { kind: "country", code: "NP" } });
    expect(summary(nepal.types)).toEqual(["Package: 1", "Lab test: 0 unavailable"]);

    const ticked = viewFor({ location: { kind: "country", code: "NP" }, types: ["lab_test"] });
    expect(summary(ticked.types)).toEqual(["Package: 1", "Lab test: 0 ticked"]);
  });

  it("each option carries the change a click asks for", () => {
    const view = viewFor();
    expect(view.types[0]?.change).toEqual({ kind: "type", type: "package" });
    expect(view.providers[0]?.change).toEqual({ kind: "provider", id: 70 });
    expect(view.homeTest.change).toEqual({ kind: "home-test" });
  });

  it("the two ultrasound categories sit under their own type labels", () => {
    const groups = viewFor().categoryGroups.map((group) => ({
      label: group.label,
      categories: summary(group.categories),
    }));
    expect(groups).toEqual([
      { label: "Package", categories: ["Ultrasound: 2"] },
      { label: "Lab test", categories: ["Ultrasound: 2"] },
    ]);
  });

  it("subcategories show only once their category is ticked", () => {
    const [ultrasound] = viewFor().categoryGroups[0]?.categories ?? [];
    expect(ultrasound?.subcategories).toEqual([]);

    const ticked = viewFor({ categoryKeys: ["package.ultrasound"] }).categoryGroups[0]
      ?.categories[0];
    expect(ticked?.isChecked).toBe(true);
    expect(summary(ticked?.subcategories ?? [])).toEqual(["Thyroid: 1", "Abdomen: 1"]);
  });

  it("a ticked subcategory shows its category as partly chosen, with the list open", () => {
    const category = viewFor({ categoryKeys: ["package.ultrasound.thyroid"] }).categoryGroups[0]
      ?.categories[0];
    expect(category?.isChecked).toBe(false);
    expect(category?.isMixed).toBe(true);
    expect(category?.isUnavailable).toBe(false);
    expect(summary(category?.subcategories ?? [])).toEqual(["Thyroid: 1 ticked", "Abdomen: 1"]);
  });

  it("Other is its own option, after the categories", () => {
    expect(summary([viewFor().otherCategory])).toEqual(["Other: 1"]);
    expect(viewFor().otherCategory.change).toEqual({ kind: "category", key: OTHER_CATEGORY_KEY });
  });

  it("providers go by name with their city; those with 0 sink to the end (D5)", () => {
    const bangkok = viewFor({ location: { kind: "city", slug: "bangkok" } });
    expect(summary(bangkok.providers)).toEqual([
      "Riverside International Hospital: 3",
      "Himal Hospital: 0 unavailable",
      "Lanna Medical Centre: 0 unavailable",
    ]);
    expect(bangkok.providers[0]?.detail).toBe("Bangkok");
  });

  it("a ticked provider with 0 stays with the available ones", () => {
    const view = viewFor({ location: { kind: "city", slug: "bangkok" }, providerIds: [70] });
    expect(summary(view.providers)).toEqual([
      "Himal Hospital: 0 ticked",
      "Riverside International Hospital: 3",
      "Lanna Medical Centre: 0 unavailable",
    ]);
  });

  it("location: any, then each country with its cities, counts in the label", () => {
    const { location } = viewFor({ types: ["lab_test"] });
    expect(location.value).toBe("");
    expect(location.any.label).toBe("Any location");
    expect(
      location.countries.map(({ label, options }) => ({
        label,
        options: options.map(
          (option) => `${option.label}${option.isUnavailable ? " unavailable" : ""}`,
        ),
      })),
    ).toEqual([
      { label: "Nepal", options: ["All of Nepal (0) unavailable", "Kathmandu (0) unavailable"] },
      {
        label: "Thailand",
        options: ["All of Thailand (2)", "Bangkok (1)", "Chiang Mai (1)"],
      },
    ]);
  });

  it("the chosen location is the select's value, and stays available with 0", () => {
    const { location } = viewFor({
      types: ["lab_test"],
      location: { kind: "city", slug: "kathmandu" },
    });
    expect(location.value).toBe("city:kathmandu");
    const kathmandu = location.countries[0]?.options[1];
    expect(kathmandu?.value).toBe("city:kathmandu");
    expect(kathmandu?.isUnavailable).toBe(false);
    expect(kathmandu?.change).toEqual({
      kind: "location",
      location: { kind: "city", slug: "kathmandu" },
    });
    expect(location.any.change).toEqual({ kind: "location" });
  });

  it("price: with no currency set, asks for one, with counts (D7)", () => {
    const { price } = viewFor();
    if (price.kind !== "choose-currency") throw new Error("expected the currency choice");
    expect(price.note).toBe(
      "These results use more than one currency. Pick one to set a price range.",
    );
    // Only the currencies the catalogue uses, like the service types. INR has no provider here.
    expect(summary(price.currencies)).toEqual(["THB: 4", "NPR: 1"]);
    expect(price.currencies[0]?.change).toEqual({ kind: "currency", currency: "THB" });
  });

  it("price: when only one currency has results, the note doesn't claim more", () => {
    const { price } = viewFor({ types: ["lab_test"] });
    if (price.kind !== "choose-currency") throw new Error("expected the currency choice");
    expect(price.note).toBe("Pick a currency to set a price range.");
    expect(summary(price.currencies)).toEqual(["THB: 2", "NPR: 0 unavailable"]);
  });

  it("price: a location in one country offers its currency at once, with no Change", () => {
    expect(viewFor({ location: { kind: "country", code: "TH" } }).price).toEqual({
      kind: "range",
      currency: "THB",
      min: "",
      max: "",
      canChangeCurrency: false,
      emptyRangeChange: { kind: "currency" },
    });
  });

  it("price: a chosen currency shows its range, which can be changed", () => {
    expect(
      viewFor({ price: { currency: "NPR", min: new Big("500"), max: new Big("2500.5") } }).price,
    ).toEqual({
      kind: "range",
      currency: "NPR",
      min: "500",
      max: "2500.5",
      canChangeCurrency: true,
      emptyRangeChange: { kind: "currency", currency: "NPR" },
    });
  });

  it("price: no Change currency when the location's currency is the chosen one", () => {
    // Removing the price would show the same THB range again, so Change would only clear it.
    const price = viewFor({
      location: { kind: "city", slug: "bangkok" },
      price: { currency: "THB", max: new Big("5000") },
    }).price;
    expect(price).toMatchObject({
      kind: "range",
      currency: "THB",
      canChangeCurrency: false,
      // An empty Apply removes the price filter, which only leaves the location's THB.
      emptyRangeChange: { kind: "currency" },
    });
  });

  it("price: Change currency stays when the chosen currency isn't the location's", () => {
    const price = viewFor({
      location: { kind: "city", slug: "bangkok" },
      price: { currency: "NPR" },
    }).price;
    expect(price).toMatchObject({ kind: "range", currency: "NPR", canChangeCurrency: true });
  });

  it("home test: its count with the other filters", () => {
    expect(summary([viewFor().homeTest])).toEqual(["Available as a home test: 1"]);
    expect(viewFor({ types: ["package"] }).homeTest.isUnavailable).toBe(true);
  });

  it("sort: the current order and every option", () => {
    const { sort } = viewFor({ sort: "price-asc" });
    expect(sort.value).toBe("price-asc");
    expect(sort.options.map(({ label }) => label)).toEqual([
      "Relevance",
      "Price: low to high",
      "Price: high to low",
      "Rating",
    ]);
    expect(sort.options[3]?.change).toEqual({ kind: "sort", sort: "rating" });
  });

  it("Clear all shows only with a filter or a search set; the sort doesn't count", () => {
    expect(viewFor({ sort: "rating" }).hasActiveFilters).toBe(false);
    expect(viewFor({ search: "thyroid" }).hasActiveFilters).toBe(true);
    expect(viewFor({ homeTestOnly: true }).hasActiveFilters).toBe(true);
  });
});

describe("providersMatchingName", () => {
  it("matches part of a name, in any case and spacing", () => {
    const { providers } = viewFor();
    expect(
      providersMatchingName(providers, "  RIVERSIDE   inter").map(({ label }) => label),
    ).toEqual(["Riverside International Hospital"]);
    expect(providersMatchingName(providers, "")).toHaveLength(3);
    expect(providersMatchingName(providers, "nowhere")).toEqual([]);
  });
});

describe("toFiltersView: active filter chips", () => {
  const labels = (overrides: Partial<ServiceQuery>) => viewFor(overrides).chips.map((c) => c.label);

  it("none without filters", () => {
    expect(viewFor().chips).toEqual([]);
    expect(viewFor({ sort: "rating", search: "   " }).chips).toEqual([]);
  });

  it("one per chosen value, in the panel's order, whatever the URL's order", () => {
    expect(
      labels({
        search: "  thyroid ",
        homeTestOnly: true,
        price: { currency: "THB", min: new Big(1000), max: new Big(5000) },
        location: { kind: "city", slug: "bangkok" },
        providerIds: [48, 70],
        categoryKeys: [OTHER_CATEGORY_KEY, "lab_test.ultrasound", "package.ultrasound.thyroid"],
        types: ["lab_test", "package"],
      }),
    ).toEqual([
      "Package",
      "Lab test",
      "Ultrasound: Thyroid (Package)",
      "Ultrasound (Lab test)",
      "Other category",
      "Himal Hospital",
      "Riverside International Hospital",
      "Bangkok",
      "1,000.00 THB to 5,000.00 THB",
      "Home test available",
      "“thyroid”",
    ]);
  });

  it("the two ultrasound categories read differently", () => {
    expect(labels({ categoryKeys: ["package.ultrasound", "lab_test.ultrasound"] })).toEqual([
      "Ultrasound (Package)",
      "Ultrasound (Lab test)",
    ]);
  });

  it("a country shows its name", () => {
    expect(labels({ location: { kind: "country", code: "NP" } })).toEqual(["Nepal"]);
  });

  it("a chosen currency has its own chip, and each end of the range reads on its own", () => {
    expect(labels({ price: { currency: "NPR" } })).toEqual(["Prices in NPR"]);
    expect(labels({ price: { currency: "NPR", max: new Big(2000) } })).toEqual([
      "Prices in NPR",
      "Up to 2,000.00 NPR",
    ]);
    expect(labels({ price: { currency: "THB", min: new Big(1000) } })).toEqual([
      "Prices in THB",
      "From 1,000.00 THB",
    ]);
  });

  it("no currency chip when the location's currency is the chosen one", () => {
    // The location already limits results to THB, so "Prices in THB" would remove nothing.
    expect(
      labels({ location: { kind: "city", slug: "bangkok" }, price: { currency: "THB" } }),
    ).toEqual(["Bangkok"]);
  });

  it("each chip carries the change that removes it", () => {
    const changes = viewFor({
      search: "thyroid",
      homeTestOnly: true,
      price: { currency: "NPR", max: new Big(2000) },
      location: { kind: "country", code: "NP" },
      providerIds: [70],
      categoryKeys: ["package.ultrasound"],
      types: ["package"],
    }).chips.map((chip) => chip.change);
    expect(changes).toEqual([
      { kind: "type", type: "package" },
      { kind: "category", key: "package.ultrasound" },
      { kind: "provider", id: 70 },
      { kind: "location" },
      // In the location's currency: removing the range removes the price filter, like an
      // empty Apply (WBS 3.6).
      { kind: "currency" },
      { kind: "home-test" },
      { kind: "remove-filter", filter: "search" },
    ]);
  });

  it("removing a range in a chosen currency keeps the currency", () => {
    const [currency, range] = viewFor({ price: { currency: "NPR", max: new Big(2000) } }).chips;
    expect(currency?.change).toEqual({ kind: "currency" });
    expect(range?.change).toEqual({ kind: "currency", currency: "NPR" });
  });

  it("chip ids are unique", () => {
    const ids = viewFor({
      types: ["package"],
      categoryKeys: ["package.ultrasound.thyroid"],
      providerIds: [70],
      price: { currency: "NPR", max: new Big(2000) },
    }).chips.map((chip) => chip.id);
    expect(new Set(ids).size).toBe(ids.length);
  });
});

describe("toFiltersView: ways out of no results", () => {
  const waysOut = (overrides: Partial<ServiceQuery>) =>
    viewFor(overrides).waysOut.map((way) => way.label);

  it("none while there are results", () => {
    expect(viewFor({ types: ["package"] }).waysOut).toEqual([]);
  });

  it("the filter that brings back the most comes first, then Clear all", () => {
    // Nepal has no lab tests. Without the location: 2 lab tests. Without the type: 1 service.
    const view = viewFor({ types: ["lab_test"], location: { kind: "country", code: "NP" } });
    expect(view.waysOut.map((way) => way.label)).toEqual([
      "Remove the location filter (2 services)",
      "Remove the service type filter (1 service)",
      "Clear all filters (5 services)",
    ]);
    expect(view.waysOut.map((way) => way.change)).toEqual([
      { kind: "remove-filter", filter: "location" },
      { kind: "remove-filter", filter: "type" },
      { kind: "clear" },
    ]);
  });

  it("leaves out a filter whose removal still finds nothing", () => {
    // Himal has no lab test and no home test: only removing the provider helps.
    expect(waysOut({ providerIds: [70], types: ["lab_test"], homeTestOnly: true })).toEqual([
      "Remove the provider filter (1 service)",
      "Clear all filters (5 services)",
    ]);
  });

  it("with one filter, Clear all would be the same button, so it isn't offered", () => {
    expect(waysOut({ search: "nothing like this" })).toEqual(["Clear the search (5 services)"]);
  });

  it("a tie keeps the panel's order", () => {
    // Other holds one service, not a home test; the one home test isn't under Other.
    expect(waysOut({ categoryKeys: [OTHER_CATEGORY_KEY], homeTestOnly: true })).toEqual([
      "Remove the category filter (1 service)",
      "Remove the home test filter (1 service)",
      "Clear all filters (5 services)",
    ]);
  });

  it("names the price filter", () => {
    expect(waysOut({ price: { currency: "THB", max: new Big(10) } })).toEqual([
      "Remove the price filter (5 services)",
    ]);
  });
});

describe("providersInShortList", () => {
  const providers: FilterOptionView[] = Array.from(
    { length: PROVIDER_PREVIEW_SIZE + 3 },
    (_, index) => ({
      id: `provider-${String(index)}`,
      label: `Provider ${String(index)}`,
      count: "1",
      isChecked: false,
      isMixed: false,
      isUnavailable: false,
      change: { kind: "provider", id: index },
    }),
  );
  const ids = (options: FilterOptionView[]) => options.map(({ id }) => id);
  const firstFew = ids(providers.slice(0, PROVIDER_PREVIEW_SIZE));

  it("shows the first few", () => {
    expect(ids(providersInShortList(providers, new Set()))).toEqual(firstFew);
  });

  it("also shows a ticked provider further down, so a ticked one is never hidden", () => {
    const ticked = providers.map((option, index) =>
      index === PROVIDER_PREVIEW_SIZE + 1 ? { ...option, isChecked: true } : option,
    );
    expect(ids(providersInShortList(ticked, new Set()))).toEqual([
      ...firstFew,
      `provider-${String(PROVIDER_PREVIEW_SIZE + 1)}`,
    ]);
  });

  it("keeps one the customer just unticked, so the checkbox doesn't vanish under focus", () => {
    const kept = `provider-${String(PROVIDER_PREVIEW_SIZE + 2)}`;
    expect(ids(providersInShortList(providers, new Set([kept])))).toEqual([...firstFew, kept]);
  });
});
