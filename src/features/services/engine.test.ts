import Big from "big.js";
import { describe, expect, it } from "vitest";
import type { Currency } from "@/lib/money/money";
import {
  countMatches,
  defaultQuery,
  runQuery,
  type PriceFilter,
  type QueryResult,
  type ServiceQuery,
} from "./engine";
import { normalizeForSearch } from "./mappers";
import { finalPrice, fixedPrice, fromPrice, shownAmount, type PriceTerms } from "./pricing";
import {
  OTHER_CATEGORY_KEY,
  type Catalogue,
  type Provider,
  type ProviderRating,
  type Service,
  type ServiceType,
} from "./types";

// Small catalogues in the mapped (UI) shape, built for each case. Provider ids, names and the
// ultrasound keys follow the real data where a case depends on them.

const cities = {
  bangkok: {
    city: { slug: "bangkok", name: "Bangkok" },
    country: { code: "TH", name: "Thailand" },
  },
  chiangMai: {
    city: { slug: "chiang-mai", name: "Chiang Mai" },
    country: { code: "TH", name: "Thailand" },
  },
  kathmandu: {
    city: { slug: "kathmandu", name: "Kathmandu" },
    country: { code: "NP", name: "Nepal" },
  },
  newDelhi: {
    city: { slug: "new-delhi", name: "New Delhi" },
    country: { code: "IN", name: "India" },
  },
};

const averageRating: ProviderRating = { kind: "rated", stars: 4, reviewCount: 100 };

function provider(
  id: number,
  name: string,
  currency: Currency,
  where: keyof typeof cities,
  rating = averageRating,
): Provider {
  return { id, name, currency, ...cities[where], rating };
}

const riverside = provider(48, "Riverside International Hospital", "THB", "bangkok", {
  kind: "rated",
  stars: 4.7,
  reviewCount: 1203,
});
const lanna = provider(50, "Lanna Medical Centre", "THB", "chiangMai", {
  kind: "rated",
  stars: 4.2,
  reviewCount: 300,
});
const himal = provider(70, "Himal Hospital", "NPR", "kathmandu", {
  kind: "rated",
  stars: 4.5,
  reviewCount: 80,
});
const delhiCare = provider(90, "Delhi Care Clinic", "INR", "newDelhi", {
  kind: "rated",
  stars: 4,
  reviewCount: 500,
});
// Provider 61 in the real data: rating null, 0 reviews.
const newClinic = provider(61, "Sukhumvit New Clinic", "THB", "bangkok", { kind: "new" });

interface ServiceFixture {
  title?: string;
  type?: ServiceType;
  categoryKey?: string;
  categoryTitle?: string;
  subcategoryKey?: string;
  testAtHome?: boolean;
  // A fixed final price. "0.00" gives a Free service.
  amount?: string;
  // Wellness: one [minutes, final amount] pair per option.
  options?: [number, string][];
}

// Price terms with no discount or charge, so the final price is the amount given.
function termsFor(amount: string): PriceTerms {
  return {
    price: amount,
    discount: "0.00",
    discountType: "amount",
    serviceCharge: "0.00",
    serviceChargeType: "amount",
  };
}

// Prices come from pricing.ts, as in the mapper, so the fixtures can't drift from real shapes.
function service(id: string, owner: Provider, fixture: ServiceFixture = {}): Service {
  const title = fixture.title ?? `Service ${id}`;
  const currency = owner.currency;
  const options = fixture.options?.map(([durationInMinutes, amount]) => ({
    ...termsFor(amount),
    durationInMinutes,
  }));
  const price =
    options === undefined
      ? fixedPrice(termsFor(fixture.amount ?? "1000.00"), currency)
      : fromPrice(options, currency);
  if (price === undefined) throw new Error("A wellness fixture needs at least one option");
  return {
    id,
    title,
    type: fixture.type ?? "package",
    providerId: owner.id,
    categoryKey: fixture.categoryKey ?? "package.health-check-up",
    subcategoryKey: fixture.subcategoryKey,
    testAtHome: fixture.testAtHome ?? false,
    price,
    payableAmounts:
      options === undefined
        ? [shownAmount(price, currency)]
        : options.map((option) => finalPrice(option, currency).final),
    search: {
      title: normalizeForSearch(title),
      category: normalizeForSearch(fixture.categoryTitle ?? "Health Check Up"),
      provider: normalizeForSearch(owner.name),
    },
  };
}

// A price filter in one currency, with an optional range.
function priceFilter(currency: Currency, min?: string, max?: string): PriceFilter {
  return {
    currency,
    min: min === undefined ? undefined : new Big(min),
    max: max === undefined ? undefined : new Big(max),
  };
}

function catalogue(providers: Provider[], services: Service[]): Catalogue {
  return { categories: [], providers, services };
}

function query(overrides: Partial<ServiceQuery> = {}): ServiceQuery {
  return { ...defaultQuery, ...overrides };
}

// Every service id on the page, in order, across all groups.
function shownIds(result: QueryResult): string[] {
  return result.groups.flatMap((group) => group.services.map((s) => s.id));
}

// The same ids alphabetically, for filter tests where the sort doesn't matter.
function matchedIds(result: QueryResult): string[] {
  return shownIds(result).toSorted((a, b) => a.localeCompare(b));
}

// A mixed catalogue for the filter and facet tests.
const mixed = catalogue(
  [riverside, lanna, himal, delhiCare],
  [
    service("r-package", riverside, { type: "package", amount: "4000.00" }),
    service("r-lab-home", riverside, {
      type: "lab_test",
      categoryKey: "lab_test.blood-tests",
      testAtHome: true,
      amount: "900.00",
    }),
    service("l-lab-home", lanna, {
      type: "lab_test",
      categoryKey: "lab_test.blood-tests",
      testAtHome: true,
      amount: "1200.00",
    }),
    service("l-package", lanna, { type: "package", amount: "6000.00" }),
    service("h-lab", himal, { type: "lab_test", categoryKey: "lab_test.blood-tests" }),
    service("d-lab-home", delhiCare, {
      type: "lab_test",
      categoryKey: "lab_test.blood-tests",
      testAtHome: true,
    }),
  ],
);

describe("runQuery: filters", () => {
  it("shows every service when no filter is set", () => {
    const result = runQuery(mixed, defaultQuery);
    expect(result.serviceCount).toBe(6);
    expect(result.providerCount).toBe(4);
  });

  it("treats options within one facet as OR", () => {
    const result = runQuery(mixed, query({ types: ["package", "lab_test"] }));
    expect(result.serviceCount).toBe(6);
  });

  it("treats filters across facets as AND, with 3 filters active at once", () => {
    const result = runQuery(
      mixed,
      query({
        types: ["lab_test"],
        location: { kind: "country", code: "TH" },
        homeTestOnly: true,
      }),
    );
    expect(matchedIds(result)).toEqual(["l-lab-home", "r-lab-home"]);
    expect(result.providerCount).toBe(2);
  });

  it("filters by provider", () => {
    const result = runQuery(mixed, query({ providerIds: [70, 90] }));
    expect(matchedIds(result)).toEqual(["d-lab-home", "h-lab"]);
  });

  it("filters by one city", () => {
    const result = runQuery(mixed, query({ location: { kind: "city", slug: "chiang-mai" } }));
    expect(matchedIds(result)).toEqual(["l-lab-home", "l-package"]);
  });

  it("matches a category key on the category and all of its subcategories", () => {
    const thyroid = "package.ultrasound.thyroid";
    const data = catalogue(
      [riverside],
      [
        service("whole", riverside, { categoryKey: "package.ultrasound" }),
        service("thyroid", riverside, {
          categoryKey: "package.ultrasound",
          subcategoryKey: thyroid,
        }),
      ],
    );
    expect(runQuery(data, query({ categoryKeys: ["package.ultrasound"] })).serviceCount).toBe(2);
    expect(shownIds(runQuery(data, query({ categoryKeys: [thyroid] })))).toEqual(["thyroid"]);
  });

  it("keeps the two ultrasound categories apart", () => {
    const data = catalogue(
      [riverside],
      [
        service("package-scan", riverside, { type: "package", categoryKey: "package.ultrasound" }),
        service("lab-scan", riverside, { type: "lab_test", categoryKey: "lab_test.ultrasound" }),
      ],
    );
    const result = runQuery(data, query({ categoryKeys: ["lab_test.ultrasound"] }));
    expect(shownIds(result)).toEqual(["lab-scan"]);
    expect(result.facetCounts.category.get("package.ultrasound")).toBe(1);
    expect(result.facetCounts.category.get("lab_test.ultrasound")).toBe(1);
  });

  it("shows services with no category under Other", () => {
    const data = catalogue(
      [riverside],
      [
        service("no-category", riverside, { categoryKey: OTHER_CATEGORY_KEY, categoryTitle: "" }),
        service("checkup", riverside),
      ],
    );
    const result = runQuery(data, query({ categoryKeys: [OTHER_CATEGORY_KEY] }));
    expect(shownIds(result)).toEqual(["no-category"]);
    expect(result.facetCounts.category.get(OTHER_CATEGORY_KEY)).toBe(1);
  });
});

describe("runQuery: price filter", () => {
  const data = catalogue(
    [riverside, himal],
    [
      service("thb-cheap", riverside, { amount: "900.00" }),
      service("thb-mid", riverside, { amount: "3000.00" }),
      service("thb-dear", riverside, { amount: "6000.00" }),
      service("npr-mid", himal, { amount: "3000.00" }),
    ],
  );

  it("shows only services in the chosen currency", () => {
    const result = runQuery(data, query({ price: priceFilter("NPR") }));
    expect(shownIds(result)).toEqual(["npr-mid"]);
    expect(result.priceCurrency).toBe("NPR");
  });

  it("keeps prices inside the range, both ends included", () => {
    const result = runQuery(data, query({ price: priceFilter("THB", "900", "3000") }));
    expect(matchedIds(result)).toEqual(["thb-cheap", "thb-mid"]);
  });

  it("never matches a THB range against NPR prices of the same number", () => {
    const result = runQuery(data, query({ price: priceFilter("THB", "3000", "3000") }));
    expect(shownIds(result)).toEqual(["thb-mid"]);
  });

  it("offers the currency a location implies, without filtering by it (D7)", () => {
    const result = runQuery(data, query({ location: { kind: "city", slug: "bangkok" } }));
    expect(result.priceCurrency).toBe("THB");
    expect(result.locationCurrency).toBe("THB");
    expect(result.serviceCount).toBe(3);
  });

  it("a chosen currency wins over the location's, which is still reported", () => {
    const result = runQuery(
      data,
      query({ location: { kind: "city", slug: "bangkok" }, price: priceFilter("NPR") }),
    );
    expect(result.priceCurrency).toBe("NPR");
    expect(result.locationCurrency).toBe("THB");
  });

  it("offers no currency when results can span several", () => {
    expect(runQuery(data, defaultQuery).priceCurrency).toBeUndefined();
  });

  it("matches a wellness service if any of its options is in range", () => {
    // Service 0003: 60 min 1,800 THB, 90 min 2,040 THB.
    const facial = service("0003", riverside, {
      type: "wellness",
      options: [
        [60, "1800.00"],
        [90, "2040.00"],
      ],
    });
    const wellness = catalogue([riverside], [facial]);
    const inRange = query({ price: priceFilter("THB", "2000", "2100") });
    const outOfRange = query({ price: priceFilter("THB", "2100") });
    expect(runQuery(wellness, inRange).serviceCount).toBe(1);
    expect(runQuery(wellness, outOfRange).serviceCount).toBe(0);
  });

  it("treats a Free service as 0 in its provider's currency (service 0006)", () => {
    const free = catalogue([riverside], [service("0006", riverside, { amount: "0.00" })]);
    const upTo100 = query({ price: priceFilter("THB", undefined, "100") });
    const from1 = query({ price: priceFilter("THB", "1") });
    expect(runQuery(free, upTo100).serviceCount).toBe(1);
    expect(runQuery(free, from1).serviceCount).toBe(0);
  });
});

describe("runQuery: search", () => {
  const data = catalogue(
    [riverside, himal],
    [
      service("0007", riverside, { title: "hba1c TEST (Diabetes)" }),
      service("thyroid", himal, { title: "Thyroid Panel", categoryTitle: "Blood Tests" }),
    ],
  );

  it("finds service 0007 by 'hba1c test' with any case and extra spaces", () => {
    expect(shownIds(runQuery(data, query({ search: "  HbA1c   test " })))).toEqual(["0007"]);
  });

  it("matches on the category title and the provider name", () => {
    expect(shownIds(runQuery(data, query({ search: "blood tests" })))).toEqual(["thyroid"]);
    expect(shownIds(runQuery(data, query({ search: "himal" })))).toEqual(["thyroid"]);
  });

  it("finds nothing when no field holds the whole phrase", () => {
    expect(runQuery(data, query({ search: "thyroid riverside" })).serviceCount).toBe(0);
  });
});

describe("countMatches", () => {
  it("gives the same count as runQuery, for filters and search together", () => {
    const queries = [
      defaultQuery,
      query({ types: ["lab_test"], homeTestOnly: true }),
      query({ location: { kind: "country", code: "TH" }, price: priceFilter("THB", "1000") }),
      query({ search: "riverside", types: ["package"] }),
      query({ search: "nothing like this" }),
    ];
    for (const each of queries) {
      expect(countMatches(mixed, each)).toBe(runQuery(mixed, each).serviceCount);
    }
  });
});

describe("runQuery: facet counts", () => {
  // Type and location both set. Each facet's counts must apply the other filter but not its own.
  const result = runQuery(
    mixed,
    query({ types: ["lab_test"], location: { kind: "country", code: "TH" } }),
  );
  const counts = result.facetCounts;

  it("counts types with every filter except the type filter", () => {
    // Thailand only: 2 packages, 2 lab tests. The NPR and INR lab tests are left out.
    expect(counts.type.get("package")).toBe(2);
    expect(counts.type.get("lab_test")).toBe(2);
  });

  it("counts locations with every filter except the location filter", () => {
    // Lab tests only.
    expect(counts.location.get("country:TH")).toBe(2);
    expect(counts.location.get("country:NP")).toBe(1);
    expect(counts.location.get("city:bangkok")).toBe(1);
    expect(counts.location.get("city:kathmandu")).toBe(1);
  });

  it("counts providers with every active filter, as services not providers", () => {
    expect(counts.provider.get(48)).toBe(1);
    expect(counts.provider.get(50)).toBe(1);
    expect(counts.provider.get(70)).toBeUndefined();
  });

  it("counts home tests with every filter except the home test filter", () => {
    expect(counts.homeTest).toBe(2);
  });

  it("counts categories with every active filter", () => {
    expect(counts.category.get("lab_test.blood-tests")).toBe(2);
    expect(counts.category.get("package.health-check-up")).toBeUndefined();
  });

  it("counts currencies without the price filter, but with the location", () => {
    const priced = runQuery(
      mixed,
      query({
        price: priceFilter("THB", undefined, "1000"),
        location: { kind: "country", code: "TH" },
      }),
    );
    expect(priced.facetCounts.currency.get("THB")).toBe(4);
    expect(priced.facetCounts.currency.get("NPR")).toBeUndefined();
  });

  it("counts other locations with the price filter, so each count is what choosing it shows", () => {
    // A THB range up to 1,000 with Bangkok chosen. Both Chiang Mai services cost more, so
    // choosing Chiang Mai would show nothing, and its count says so. Kathmandu has no THB
    // services, so it shows 0 until the price filter is cleared (D5).
    const inBangkok = runQuery(
      mixed,
      query({
        location: { kind: "city", slug: "bangkok" },
        price: priceFilter("THB", undefined, "1000"),
      }),
    );
    expect(inBangkok.serviceCount).toBe(1);
    expect(inBangkok.facetCounts.location.get("country:TH")).toBe(1);
    expect(inBangkok.facetCounts.location.get("city:chiang-mai")).toBeUndefined();
    expect(inBangkok.facetCounts.location.get("city:kathmandu")).toBeUndefined();
  });
});

describe("runQuery: facet counts with every filter set at once", () => {
  // One service passes everything. Each other service fails exactly one filter, so it may only
  // be counted under that filter's own facet. If withoutFacet forgot to clear a filter, or
  // cleared the wrong one, a count below would be off.
  const bangkokTwo = provider(49, "Bangkok Second Hospital", "THB", "bangkok");
  const passes = {
    type: "lab_test",
    categoryKey: "lab_test.blood-tests",
    testAtHome: true,
    amount: "900.00",
  } as const;
  const data = catalogue(
    [riverside, bangkokTwo, lanna],
    [
      service("hit", riverside, passes),
      service("other-type", riverside, { ...passes, type: "package" }),
      service("other-category", riverside, { ...passes, categoryKey: "lab_test.allergy" }),
      service("other-provider", bangkokTwo, passes),
      service("other-location", lanna, passes),
      service("over-range", riverside, { ...passes, amount: "2000.00" }),
      service("not-home", riverside, { ...passes, testAtHome: false }),
    ],
  );
  const result = runQuery(
    data,
    query({
      types: ["lab_test"],
      categoryKeys: ["lab_test.blood-tests"],
      providerIds: [48, 50],
      location: { kind: "city", slug: "bangkok" },
      price: priceFilter("THB", undefined, "1000"),
      homeTestOnly: true,
    }),
  );
  const counts = result.facetCounts;

  it("shows only the service that passes every filter", () => {
    expect(shownIds(result)).toEqual(["hit"]);
  });

  it("counts each facet's options with only its own filter cleared", () => {
    expect(Object.fromEntries(counts.type)).toEqual({ lab_test: 1, package: 1 });
    expect(Object.fromEntries(counts.category)).toEqual({
      "lab_test.blood-tests": 1,
      "lab_test.allergy": 1,
    });
    expect(Object.fromEntries(counts.provider)).toEqual({ 48: 1, 49: 1 });
    expect(Object.fromEntries(counts.location)).toEqual({
      "city:bangkok": 1,
      "city:chiang-mai": 1,
      "country:TH": 2,
    });
    expect(Object.fromEntries(counts.currency)).toEqual({ THB: 2 });
    expect(counts.homeTest).toBe(1);
  });
});

describe("runQuery: currency counts", () => {
  it("counts every currency while one is chosen, so the customer can switch", () => {
    const result = runQuery(mixed, query({ price: priceFilter("THB") }));
    expect(Object.fromEntries(result.facetCounts.currency)).toEqual({ THB: 4, NPR: 1, INR: 1 });
  });
});

describe("runQuery: groups", () => {
  const five = catalogue(
    [riverside],
    ["1", "2", "3", "4", "5"].map((id) => service(`s${id}`, riverside, { amount: `${id}00.00` })),
  );

  it("shows the first 3 services of a group and counts all matching ones", () => {
    const result = runQuery(five, query({ sort: "price-asc" }));
    expect(result.groups).toHaveLength(1);
    expect(result.groups[0]?.services.map((s) => s.id)).toEqual(["s1", "s2", "s3"]);
    expect(result.groups[0]?.matchingCount).toBe(5);
    expect(result.groups[0]?.isOpen).toBe(false);
  });

  it("counts View all N under the active filters", () => {
    const result = runQuery(five, query({ price: priceFilter("THB", undefined, "400") }));
    expect(result.groups[0]?.matchingCount).toBe(4);
  });

  it("shows every matching service of an open group (D10)", () => {
    const result = runQuery(five, query({ sort: "price-asc", openProviderIds: [48] }));
    expect(result.groups[0]?.services.map((s) => s.id)).toEqual(["s1", "s2", "s3", "s4", "s5"]);
    expect(result.groups[0]?.isOpen).toBe(true);
  });

  it("orders groups by their best service under the sort", () => {
    const data = catalogue(
      [riverside, lanna],
      [
        service("r-dear", riverside, { amount: "5000.00" }),
        service("r-cheap", riverside, { amount: "1000.00" }),
        service("l-mid", lanna, { amount: "2000.00" }),
      ],
    );
    const result = runQuery(data, query({ sort: "price-asc" }));
    expect(result.groups.map((g) => g.provider.id)).toEqual([48, 50]);
    expect(shownIds(result)).toEqual(["r-cheap", "r-dear", "l-mid"]);
  });
});

describe("runQuery: sorting", () => {
  it("never interleaves currencies in a price sort with no currency set (D8)", () => {
    const data = catalogue(
      [riverside, himal, delhiCare],
      [
        service("npr-100", himal, { amount: "100.00" }),
        service("thb-500", riverside, { amount: "500.00" }),
        service("inr-50", delhiCare, { amount: "50.00" }),
        service("thb-200", riverside, { amount: "200.00" }),
        service("npr-900", himal, { amount: "900.00" }),
      ],
    );
    const ascending = runQuery(data, query({ sort: "price-asc" }));
    expect(shownIds(ascending)).toEqual(["thb-200", "thb-500", "npr-100", "npr-900", "inr-50"]);
    const descending = runQuery(data, query({ sort: "price-desc" }));
    expect(shownIds(descending)).toEqual(["thb-500", "thb-200", "npr-900", "npr-100", "inr-50"]);
  });

  it("sorts wellness by its from price and Free as 0", () => {
    const data = catalogue(
      [riverside],
      [
        service("fixed-1000", riverside, { amount: "1000.00" }),
        service("0003", riverside, {
          type: "wellness",
          options: [
            [60, "800.00"],
            [90, "2040.00"],
          ],
        }),
        service("0006", riverside, { amount: "0.00" }),
      ],
    );
    const result = runQuery(data, query({ sort: "price-asc", openProviderIds: [48] }));
    expect(shownIds(result)).toEqual(["0006", "0003", "fixed-1000"]);
  });

  it("sorts by rating, then review count, with new providers last", () => {
    const twin = provider(51, "Twin Hospital", "THB", "bangkok", {
      kind: "rated",
      stars: 4.7,
      reviewCount: 50,
    });
    const data = catalogue(
      [newClinic, twin, lanna, riverside],
      [
        service("new", newClinic),
        service("twin", twin),
        service("lanna", lanna),
        service("riverside", riverside),
      ],
    );
    const result = runQuery(data, query({ sort: "rating" }));
    expect(result.groups.map((g) => g.provider.id)).toEqual([48, 51, 50, 61]);
  });

  it("orders relevance by rating when there is no search text (D6)", () => {
    const data = catalogue(
      [newClinic, lanna, riverside],
      [service("new", newClinic), service("lanna", lanna), service("riverside", riverside)],
    );
    expect(shownIds(runQuery(data, defaultQuery))).toEqual(["riverside", "lanna", "new"]);
  });

  it("ranks search matches: title word, title prefix, title, category, provider (D6)", () => {
    // Every service is at a different provider, rated the other way round, so only the rank
    // can put them in this order.
    const rated = (id: number, name: string) =>
      provider(id, name, "THB", "bangkok", { kind: "rated", stars: id, reviewCount: 10 });
    const p1 = rated(1, "Clinic 1");
    const p2 = rated(2, "Clinic 2");
    const p3 = rated(3, "Clinic 3");
    const p4 = rated(4, "Clinic 4");
    const thyroidClinic = rated(5, "Thyroid Clinic");
    const data = catalogue(
      [p1, p2, p3, p4, thyroidClinic],
      [
        service("provider", thyroidClinic, { title: "Blood Count" }),
        service("category", p4, { title: "Neck Scan", categoryTitle: "Thyroid" }),
        service("contains", p3, { title: "Hypothyroidism Check" }),
        service("prefix", p2, { title: "Thyroidectomy Review" }),
        service("word", p1, { title: "Free T4 (Thyroid)" }),
      ],
    );
    expect(shownIds(runQuery(data, query({ search: "thyroid" })))).toEqual([
      "word",
      "prefix",
      "contains",
      "category",
      "provider",
    ]);
  });

  it("breaks ties in search rank by rating, new providers last", () => {
    const data = catalogue(
      [newClinic, lanna, riverside],
      [
        service("new", newClinic, { title: "Thyroid Panel" }),
        service("lanna", lanna, { title: "Thyroid Panel" }),
        service("riverside", riverside, { title: "Thyroid Panel" }),
      ],
    );
    const result = runQuery(data, query({ search: "thyroid" }));
    expect(shownIds(result)).toEqual(["riverside", "lanna", "new"]);
  });
});

describe("runQuery: pagination", () => {
  // 23 providers with one service each: 3 pages of 10, 10 and 3 groups (D9).
  const owners = Array.from({ length: 23 }, (_, index) =>
    provider(100 + index, `Clinic ${String(index)}`, "THB", "bangkok"),
  );
  const data = catalogue(
    owners,
    owners.map((owner) => service(`s${String(owner.id)}`, owner)),
  );

  it("shows 10 provider groups per page", () => {
    const result = runQuery(data, query({ page: 2 }));
    expect(result.groups).toHaveLength(10);
    expect(result.groups[0]?.provider.id).toBe(110);
    expect(result.pageCount).toBe(3);
    expect(result.providerCount).toBe(23);
  });

  it("shows the last page for a page past the end", () => {
    const result = runQuery(data, query({ page: 9 }));
    expect(result.page).toBe(3);
    expect(result.groups).toHaveLength(3);
  });

  it("has one empty page when nothing matches", () => {
    const result = runQuery(data, query({ search: "nothing like this" }));
    expect(result.page).toBe(1);
    expect(result.pageCount).toBe(1);
    expect(result.groups).toEqual([]);
  });
});
