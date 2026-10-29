import Big from "big.js";
import { describe, expect, it } from "vitest";
import { defaultQuery, type ServiceQuery } from "./engine";
import {
  activeFilterGroups,
  applyFilterChange,
  readPriceRange,
  type FilterChange,
} from "./filter-changes";
import { OTHER_CATEGORY_KEY, type Category } from "./types";

// Keys follow the real data: "thyroid" sits under three parents, and the two ultrasound
// categories differ only by type.
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
  {
    key: "lab_test.blood-tests",
    title: "Blood Tests",
    type: "lab_test",
    subcategories: [{ key: "lab_test.blood-tests.thyroid", title: "Thyroid" }],
  },
];

const onPage3: ServiceQuery = { ...defaultQuery, page: 3 };

function apply(change: FilterChange, query: ServiceQuery = defaultQuery): ServiceQuery {
  return applyFilterChange(query, change, categories);
}

function categoryKeysAfter(changes: string[], start: string[] = []): string[] {
  let query: ServiceQuery = { ...defaultQuery, categoryKeys: start };
  for (const key of changes) query = apply({ kind: "category", key }, query);
  return query.categoryKeys;
}

describe("applyFilterChange", () => {
  it("every change goes back to page 1", () => {
    const changes: FilterChange[] = [
      { kind: "type", type: "package" },
      { kind: "category", key: "lab_test.ultrasound" },
      { kind: "provider", id: 48 },
      { kind: "location", location: { kind: "city", slug: "bangkok" } },
      { kind: "currency", currency: "THB" },
      { kind: "price-range", currency: "THB", max: new Big(5000) },
      { kind: "home-test" },
      { kind: "search", text: "thyroid" },
      { kind: "sort", sort: "rating" },
      { kind: "remove-filter", filter: "type" },
      { kind: "clear" },
    ];
    for (const change of changes) expect(apply(change, onPage3).page).toBe(1);
  });

  it("a type is ticked and unticked, keeping the others", () => {
    const withLabTest = { ...defaultQuery, types: ["lab_test" as const] };
    const both = apply({ kind: "type", type: "package" }, withLabTest);
    expect(both.types).toEqual(["lab_test", "package"]);
    expect(apply({ kind: "type", type: "lab_test" }, both).types).toEqual(["package"]);
  });

  it("a provider is ticked and unticked", () => {
    const withRiverside = apply({ kind: "provider", id: 48 });
    expect(withRiverside.providerIds).toEqual([48]);
    expect(apply({ kind: "provider", id: 48 }, withRiverside).providerIds).toEqual([]);
  });

  it("the home test filter turns on and off", () => {
    const on = apply({ kind: "home-test" });
    expect(on.homeTestOnly).toBe(true);
    expect(apply({ kind: "home-test" }, on).homeTestOnly).toBe(false);
  });

  it("a location is set, replaced and cleared", () => {
    const bangkok = apply({ kind: "location", location: { kind: "city", slug: "bangkok" } });
    const nepal = apply({ kind: "location", location: { kind: "country", code: "NP" } }, bangkok);
    expect(nepal.location).toEqual({ kind: "country", code: "NP" });
    expect(apply({ kind: "location" }, nepal).location).toBeUndefined();
  });

  it("choosing a currency drops any range; Change currency clears the price filter", () => {
    const range = apply({ kind: "price-range", currency: "THB", max: new Big(5000) });
    expect(range.price).toEqual({ currency: "THB", max: new Big(5000) });

    expect(apply({ kind: "currency", currency: "NPR" }, range).price).toEqual({ currency: "NPR" });
    expect(apply({ kind: "currency" }, range).price).toBeUndefined();
  });

  it("a range with no bounds still sets the currency", () => {
    expect(apply({ kind: "price-range", currency: "INR" }).price).toEqual({ currency: "INR" });
  });

  it("search text is kept as typed", () => {
    expect(apply({ kind: "search", text: "  HbA1c " }).search).toBe("  HbA1c ");
  });

  it("sort changes the sort only", () => {
    const withType = { ...defaultQuery, types: ["package" as const] };
    expect(apply({ kind: "sort", sort: "price-asc" }, withType)).toEqual({
      ...withType,
      sort: "price-asc",
    });
  });

  it("clear removes every filter and the search, and keeps the sort and open groups", () => {
    const busy: ServiceQuery = {
      search: "thyroid",
      types: ["package"],
      categoryKeys: ["package.ultrasound"],
      providerIds: [48],
      location: { kind: "city", slug: "bangkok" },
      price: { currency: "THB", max: new Big(5000) },
      homeTestOnly: true,
      sort: "rating",
      page: 2,
      openProviderIds: [48],
    };
    expect(apply({ kind: "clear" }, busy)).toEqual({
      ...defaultQuery,
      sort: "rating",
      openProviderIds: [48],
    });
  });
});

describe("remove-filter (the empty state's ways out)", () => {
  const busy: ServiceQuery = {
    search: "thyroid",
    types: ["package", "lab_test"],
    categoryKeys: ["package.ultrasound", "lab_test.blood-tests.thyroid"],
    providerIds: [48, 61],
    location: { kind: "city", slug: "bangkok" },
    price: { currency: "THB", max: new Big(5000) },
    homeTestOnly: true,
    sort: "rating",
    page: 1,
    openProviderIds: [48],
  };

  it("removes the whole of one filter and keeps the rest", () => {
    expect(apply({ kind: "remove-filter", filter: "search" }, busy)).toEqual({
      ...busy,
      search: "",
    });
    expect(apply({ kind: "remove-filter", filter: "type" }, busy)).toEqual({ ...busy, types: [] });
    expect(apply({ kind: "remove-filter", filter: "category" }, busy)).toEqual({
      ...busy,
      categoryKeys: [],
    });
    expect(apply({ kind: "remove-filter", filter: "provider" }, busy)).toEqual({
      ...busy,
      providerIds: [],
    });
    expect(apply({ kind: "remove-filter", filter: "location" }, busy)).toEqual({
      ...busy,
      location: undefined,
    });
    expect(apply({ kind: "remove-filter", filter: "price" }, busy)).toEqual({
      ...busy,
      price: undefined,
    });
    expect(apply({ kind: "remove-filter", filter: "homeTest" }, busy)).toEqual({
      ...busy,
      homeTestOnly: false,
    });
  });
});

describe("activeFilterGroups", () => {
  it("lists the filters in use, in the panel's order", () => {
    expect(activeFilterGroups(defaultQuery)).toEqual([]);
    expect(
      activeFilterGroups({
        ...defaultQuery,
        homeTestOnly: true,
        search: "thyroid",
        price: { currency: "THB" },
        providerIds: [48],
      }),
    ).toEqual(["search", "provider", "price", "homeTest"]);
  });

  it("search text that is only spaces is not a filter", () => {
    expect(activeFilterGroups({ ...defaultQuery, search: "   " })).toEqual([]);
  });
});

describe("category tree", () => {
  it("ticking a category chooses all of it", () => {
    expect(categoryKeysAfter(["package.ultrasound"])).toEqual(["package.ultrasound"]);
  });

  it("ticking a subcategory narrows its category to it", () => {
    expect(categoryKeysAfter(["package.ultrasound", "package.ultrasound.thyroid"])).toEqual([
      "package.ultrasound.thyroid",
    ]);
  });

  it("a second subcategory is added beside the first", () => {
    expect(
      categoryKeysAfter([
        "package.ultrasound",
        "package.ultrasound.thyroid",
        "package.ultrasound.abdomen",
      ]),
    ).toEqual(["package.ultrasound.thyroid", "package.ultrasound.abdomen"]);
  });

  it("unticking the last subcategory goes back to the whole category", () => {
    expect(
      categoryKeysAfter(["package.ultrasound.thyroid"], ["package.ultrasound.thyroid"]),
    ).toEqual(["package.ultrasound"]);
  });

  it("with a hand-typed URL holding both keys, unticking the subcategory keeps the category", () => {
    expect(
      categoryKeysAfter(
        ["package.ultrasound.thyroid"],
        ["package.ultrasound", "package.ultrasound.thyroid"],
      ),
    ).toEqual(["package.ultrasound"]);
  });

  it("unticking a category clears it and its subcategories", () => {
    expect(
      categoryKeysAfter(
        ["package.ultrasound"],
        ["package.ultrasound.thyroid", "package.ultrasound.abdomen"],
      ),
    ).toEqual([]);
  });

  it("other categories are left alone, including a thyroid under another parent", () => {
    expect(
      categoryKeysAfter(
        ["package.ultrasound.thyroid"],
        ["lab_test.blood-tests.thyroid", "lab_test.ultrasound", "package.ultrasound"],
      ),
    ).toEqual([
      "lab_test.blood-tests.thyroid",
      "lab_test.ultrasound",
      "package.ultrasound.thyroid",
    ]);
  });

  it("the two ultrasound categories are ticked separately", () => {
    expect(categoryKeysAfter(["package.ultrasound", "lab_test.ultrasound"])).toEqual([
      "package.ultrasound",
      "lab_test.ultrasound",
    ]);
    expect(
      categoryKeysAfter(["lab_test.ultrasound"], ["package.ultrasound", "lab_test.ultrasound"]),
    ).toEqual(["package.ultrasound"]);
  });

  it("Other is ticked and unticked like a category with no subcategories", () => {
    expect(categoryKeysAfter([OTHER_CATEGORY_KEY])).toEqual([OTHER_CATEGORY_KEY]);
    expect(categoryKeysAfter([OTHER_CATEGORY_KEY], [OTHER_CATEGORY_KEY])).toEqual([]);
  });
});

describe("readPriceRange", () => {
  it("two empty boxes are a range with no bounds", () => {
    expect(readPriceRange("", " ")).toEqual({ kind: "ok" });
  });

  it("reads plain amounts, with or without decimals", () => {
    expect(readPriceRange("1000", "5000.50")).toEqual({
      kind: "ok",
      min: new Big(1000),
      max: new Big("5000.50"),
    });
  });

  it("allows grouping commas and spaces around the number", () => {
    expect(readPriceRange(" 1,000 ", "")).toEqual({ kind: "ok", min: new Big(1000) });
  });

  it("an amount that isn't a plain number is pointed out on its own box", () => {
    expect(readPriceRange("abc", "5000")).toMatchObject({ kind: "invalid", field: "min" });
    expect(readPriceRange("", "1e3")).toMatchObject({ kind: "invalid", field: "max" });
    expect(readPriceRange("-5", "")).toMatchObject({ kind: "invalid", field: "min" });
  });

  it("a lowest price above the highest is pointed out on the lowest", () => {
    expect(readPriceRange("6000", "5000")).toMatchObject({ kind: "invalid", field: "min" });
    expect(readPriceRange("5000", "5000")).toEqual({
      kind: "ok",
      min: new Big(5000),
      max: new Big(5000),
    });
  });
});
