import Big from "big.js";
import { describe, expect, it } from "vitest";
import { defaultQuery, type ServiceQuery } from "./engine";
import {
  OTHER_CATEGORY_KEY,
  type Catalogue,
  type Category,
  type Provider,
  type ServiceType,
} from "./types";
import {
  parseServicesUrl,
  searchParamsFromRecord,
  toServicesSearchParams,
  type ServicesUrlState,
} from "./url-codec";

// A small catalogue in the mapped (UI) shape. The codec only reads categories and providers.
// The category keys are the real ones: "thyroid" sits under three parents in the data.

// Titles don't matter to the codec, so each category has one subcategory and fixed titles.
function category(type: ServiceType, key: string, subcategoryKey: string): Category {
  return { key, title: key, type, subcategories: [{ key: subcategoryKey, title: "Thyroid" }] };
}

function provider(id: number, citySlug: string, countryCode: string): Provider {
  return {
    id,
    name: `Provider ${String(id)}`,
    currency: countryCode === "NP" ? "NPR" : "THB",
    city: { slug: citySlug, name: citySlug },
    country: { code: countryCode, name: countryCode },
    rating: { kind: "new" },
  };
}

const catalogue: Catalogue = {
  categories: [
    category("package", "package.ultrasound", "package.ultrasound.thyroid"),
    category("lab_test", "lab_test.ultrasound", "lab_test.ultrasound.thyroid"),
    category("lab_test", "lab_test.blood-tests", "lab_test.blood-tests.thyroid"),
  ],
  providers: [
    provider(48, "bangkok", "TH"),
    provider(61, "bangkok", "TH"),
    provider(70, "kathmandu", "NP"),
    provider(105, "chiang-mai", "TH"),
  ],
  services: [],
};

function stateWith(query: Partial<ServiceQuery>, compareProviderIds: number[] = []) {
  return { query: { ...defaultQuery, ...query }, compareProviderIds };
}

function parse(url: string): ServicesUrlState {
  return parseServicesUrl(new URLSearchParams(url), catalogue);
}

function serialize(state: ServicesUrlState): string {
  return toServicesSearchParams(state).toString();
}

describe("round trip for every param", () => {
  // Each row: the state, and the URL it must give. The URL must parse back to the same state.
  const cases: [string, ServicesUrlState, string][] = [
    ["q", stateWith({ search: "thyroid" }), "q=thyroid"],
    ["q with spaces", stateWith({ search: "hba1c test" }), "q=hba1c+test"],
    // Kept as typed, so the search box doesn't lose a space while the customer is typing.
    ["q with a trailing space", stateWith({ search: "thyroid " }), "q=thyroid+"],
    ["type", stateWith({ types: ["package", "lab_test"] }), "type=package&type=lab_test"],
    [
      "cat",
      stateWith({ categoryKeys: ["package.ultrasound.thyroid"] }),
      "cat=package.ultrasound.thyroid",
    ],
    ["cat other", stateWith({ categoryKeys: [OTHER_CATEGORY_KEY] }), "cat=other"],
    ["provider", stateWith({ providerIds: [48, 61] }), "provider=48&provider=61"],
    ["loc city", stateWith({ location: { kind: "city", slug: "bangkok" } }), "loc=city%3Abangkok"],
    ["loc country", stateWith({ location: { kind: "country", code: "TH" } }), "loc=country%3ATH"],
    ["cur", stateWith({ price: { currency: "THB" } }), "cur=THB"],
    [
      "cur, min and max",
      stateWith({ price: { currency: "THB", min: new Big("1000"), max: new Big("5000.5") } }),
      "cur=THB&min=1000&max=5000.5",
    ],
    ["min only", stateWith({ price: { currency: "NPR", min: new Big("0") } }), "cur=NPR&min=0"],
    ["home", stateWith({ homeTestOnly: true }), "home=1"],
    ["sort price-asc", stateWith({ sort: "price-asc" }), "sort=price-asc"],
    ["sort price-desc", stateWith({ sort: "price-desc" }), "sort=price-desc"],
    ["sort rating", stateWith({ sort: "rating" }), "sort=rating"],
    ["page", stateWith({ page: 2 }), "page=2"],
    ["open", stateWith({ openProviderIds: [48, 70] }), "open=48&open=70"],
    ["compare", stateWith({}, [48, 61, 105]), "compare=48%2C61%2C105"],
  ];

  it.each(cases)("%s", (_name, state, url) => {
    expect(serialize(state)).toBe(url);
    expect(parse(url)).toEqual(state);
  });

  it("keeps every param together", () => {
    const state = stateWith(
      {
        search: "check up",
        types: ["package"],
        categoryKeys: ["package.ultrasound"],
        providerIds: [48],
        location: { kind: "city", slug: "bangkok" },
        price: { currency: "THB", min: new Big("1000"), max: new Big("5000") },
        homeTestOnly: true,
        sort: "rating",
        page: 3,
        openProviderIds: [48],
      },
      [48, 61],
    );
    expect(parse(serialize(state))).toEqual(state);
  });

  it("leaves every default out of the URL", () => {
    expect(serialize(stateWith({}))).toBe("");
    expect(parse("")).toEqual(stateWith({}));
  });

  it("writes a huge amount without an exponent", () => {
    // 1 followed by 25 zeros: big.js toString() would write it as "1e+25".
    const digits = "1".padEnd(26, "0");
    const max = new Big(digits);
    const url = serialize(stateWith({ price: { currency: "THB", max } }));
    expect(url).toBe(`cur=THB&max=${digits}`);
    expect(parse(url).query.price?.max).toEqual(max);
  });
});

describe("bad input is dropped quietly", () => {
  it("keeps the good values and drops the rest", () => {
    expect(parse("type=surgery&type=package").query.types).toEqual(["package"]);
    expect(parse("provider=48&provider=abc&provider=4.5&provider=-1").query.providerIds).toEqual([
      48,
    ]);
  });

  it("drops repeated values", () => {
    expect(parse("type=package&type=package").query.types).toEqual(["package"]);
    expect(parse("provider=48&provider=48").query.providerIds).toEqual([48]);
  });

  it("drops search text that is only spaces", () => {
    expect(parse("q=%20%20%20").query.search).toBe("");
  });

  it("drops ids and pages with a leading zero, so one view has one URL", () => {
    expect(parse("provider=048&open=070").query.providerIds).toEqual([]);
    expect(parse("provider=048&open=070").query.openProviderIds).toEqual([]);
    expect(parse("page=02").query.page).toBe(1);
  });

  it.each(["page=0", "page=-1", "page=2.5", "page=abc", "page=", "page=99999999999999999999"])(
    "%s shows page 1",
    (url) => {
      expect(parse(url).query.page).toBe(1);
    },
  );

  it.each(["sort=cheapest", "sort=", "sort=PRICE-ASC"])("%s sorts by relevance", (url) => {
    expect(parse(url).query.sort).toBe("relevance");
  });

  it.each(["home=yes", "home=true", "home=0", "home="])("%s is not the home test filter", (url) => {
    expect(parse(url).query.homeTestOnly).toBe(false);
  });

  it("drops a range with no currency, or an unknown currency", () => {
    expect(parse("min=1000&max=5000").query.price).toBeUndefined();
    expect(parse("cur=EUR&min=1000").query.price).toBeUndefined();
    expect(parse("cur=thb").query.price).toBeUndefined();
  });

  it.each(["-5", "1e3", "10.", ".5", "abc", "", "Infinity", " 100"])(
    "drops the amount %j and keeps the currency",
    (amount) => {
      expect(parse(`cur=THB&min=${encodeURIComponent(amount)}`).query.price).toEqual({
        currency: "THB",
      });
    },
  );

  it("keeps an amount with more than 2 decimals, so whatever is written reads back", () => {
    const state = stateWith({ price: { currency: "THB", max: new Big("99.999") } });
    expect(serialize(state)).toBe("cur=THB&max=99.999");
    expect(parse("cur=THB&max=99.999")).toEqual(state);
  });

  it("drops a range where min is above max, and keeps the currency", () => {
    expect(parse("cur=THB&min=5000&max=1000").query.price).toEqual({ currency: "THB" });
  });

  it("keeps a range where min equals max", () => {
    expect(parse("cur=THB&min=1000&max=1000").query.price).toEqual({
      currency: "THB",
      min: new Big("1000"),
      max: new Big("1000"),
    });
  });

  it("drops providers the customer can't see", () => {
    // 161 is inactive in the real data, so it isn't in the mapped catalogue.
    expect(parse("provider=161&provider=48").query.providerIds).toEqual([48]);
    expect(parse("open=999").query.openProviderIds).toEqual([]);
  });

  it("drops category keys the catalogue doesn't have", () => {
    const url =
      "cat=ultrasound&cat=package.unknown&cat=package.ultrasound.liver&cat=lab_test.ultrasound";
    expect(parse(url).query.categoryKeys).toEqual(["lab_test.ultrasound"]);
  });

  it.each([
    "loc=city:atlantis",
    "loc=country:XX",
    "loc=planet:mars",
    "loc=bangkok",
    "loc=city:",
    "loc=city:bangkok:extra",
  ])("%s has no location", (url) => {
    expect(parse(url).query.location).toBeUndefined();
  });

  it("takes only the first location", () => {
    expect(parse("loc=country:NP&loc=city:bangkok").query.location).toEqual({
      kind: "country",
      code: "NP",
    });
  });

  it("reads only the first value of a single-value param", () => {
    const { query } = parse(
      "sort=rating&sort=price-asc&page=2&page=3&cur=NPR&cur=THB&home=1&home=0",
    );
    expect(query.sort).toBe("rating");
    expect(query.page).toBe(2);
    expect(query.price).toEqual({ currency: "NPR" });
    expect(query.homeTestOnly).toBe(true);
  });

  it("compares at most 3 providers, each once, all visible", () => {
    expect(parse("compare=48,61,70,105").compareProviderIds).toEqual([48, 61, 70]);
    expect(parse("compare=48,48,abc,999,,61").compareProviderIds).toEqual([48, 61]);
  });
});

describe("thyroid under three parents", () => {
  const keys = [
    "package.ultrasound.thyroid",
    "lab_test.ultrasound.thyroid",
    "lab_test.blood-tests.thyroid",
  ];

  it("keeps the three thyroid subcategories distinct", () => {
    const url = keys.map((key) => `cat=${key}`).join("&");
    const state = parse(url);
    expect(state.query.categoryKeys).toEqual(keys);
    expect(serialize(state)).toBe(url);
  });

  it("drops a bare thyroid slug, since it could mean any of the three", () => {
    expect(parse("cat=thyroid").query.categoryKeys).toEqual([]);
  });
});

describe("searchParamsFromRecord", () => {
  it("reads the object Next.js gives a page, with repeated and missing params", () => {
    const params = searchParamsFromRecord({
      q: "thyroid",
      type: ["package", "lab_test"],
      page: undefined,
    });
    expect(parseServicesUrl(params, catalogue)).toEqual(
      stateWith({ search: "thyroid", types: ["package", "lab_test"] }),
    );
  });
});
