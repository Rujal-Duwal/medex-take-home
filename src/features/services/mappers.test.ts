import { describe, expect, it } from "vitest";
import { formatMoney } from "@/lib/money/money";
import type {
  ApiCategory,
  ApiProvider,
  ApiService,
  ApiSubcategory,
  ApiWellnessOption,
} from "./api-types";
import { mapCatalogue, normalizeForSearch, tidyText } from "./mappers";
import { OTHER_CATEGORY_KEY } from "./types";

// Small fixtures in the shape of data/task1-service-explorer.json. Ids and slugs match the
// real data where a case depends on them (the ultrasound and thyroid slugs).

function subcategory(
  id: string,
  slug: string,
  parent: Pick<ApiCategory, "id" | "type">,
  status = true,
): ApiSubcategory {
  return { id, title: slug, slug, type: parent.type, position: 1, status, parentId: parent.id };
}

function category(
  id: string,
  slug: string,
  type: ApiCategory["type"],
  childSlugs: string[] = [],
  status = true,
): ApiCategory {
  const parent = { id, type };
  return {
    id,
    title: slug,
    slug,
    type,
    position: 1,
    status,
    parentId: null,
    children: childSlugs.map((childSlug) => subcategory(`${id}-${childSlug}`, childSlug, parent)),
  };
}

function provider(id: number, overrides: Partial<ApiProvider> = {}): ApiProvider {
  return {
    id,
    name: "Riverside International Hospital",
    username: "riverside-international-hospital",
    status: "active",
    providerInformation: {
      companyName: "Riverside International Hospital",
      slug: "riverside-international-hospital",
      types: ["package", "lab_test", "service"],
      currency: "THB",
      city: { id: "3d77", name: "Bangkok", slug: "bangkok" },
      country: { id: 219, name: "Thailand", alphaCode: "TH" },
      rating: 4.7,
      reviewCount: 1203,
    },
    ...overrides,
  };
}

function service(id: string, overrides: Partial<ApiService> = {}): ApiService {
  return {
    id,
    title: "Executive Health Check (Male)",
    slug: "executive-health-check-male",
    type: "package",
    userId: 48,
    categoryId: "checkup",
    subCategoryId: null,
    price: "6200.00",
    discount: "10.00",
    discountType: "percent",
    serviceCharge: "7.00",
    serviceChargeType: "percent",
    status: true,
    testAtHome: false,
    homeTestCharge: null,
    wellnessPricing: [],
    createdAt: "2025-03-25T04:00:00.000Z",
    ...overrides,
  };
}

const checkup = category("checkup", "health-check-up", "package");

// A wellness service keeps its prices in wellnessPricing, with the service's own price fields null.
const wellnessFields = {
  type: "wellness" as const,
  price: null,
  discount: null,
  discountType: null,
  serviceCharge: null,
  serviceChargeType: null,
};

// A wellness option with an amount discount and no service charge.
function option(durationInMinutes: number, price: string, discount = "0.00"): ApiWellnessOption {
  return {
    id: `option-${String(durationInMinutes)}`,
    durationInMinutes,
    price,
    discount,
    discountType: "amount",
    serviceCharge: "0.00",
    serviceChargeType: "amount",
  };
}

describe("tidyText", () => {
  it("trims and collapses spaces in the title of service 0007", () => {
    expect(tidyText("  hba1c   TEST (Diabetes) ")).toBe("hba1c TEST (Diabetes)");
  });
});

describe("normalizeForSearch", () => {
  it("lowercases service 0007's title and turns its brackets into spaces", () => {
    expect(normalizeForSearch("  hba1c   TEST (Diabetes) ")).toBe("hba1c test diabetes");
  });

  it("splits words on punctuation, so check-up matches check up", () => {
    expect(normalizeForSearch("Women's Check-Up")).toBe("women s check up");
  });

  it("keeps Thai and Devanagari vowel signs inside a word", () => {
    expect(normalizeForSearch("ตรวจสุขภาพ")).toBe("ตรวจสุขภาพ");
    expect(normalizeForSearch("स्वास्थ्य जाँच")).toBe("स्वास्थ्य जाँच");
  });
});

describe("mapCatalogue: services", () => {
  it("shows service 0007's title trimmed with single spaces", () => {
    const raw = service("0007", { title: "  hba1c   TEST (Diabetes) " });
    const { services } = mapCatalogue([checkup], [provider(48)], [raw]);
    expect(services[0]?.title).toBe("hba1c TEST (Diabetes)");
  });

  it("maps provider, type and home test without the API field names", () => {
    const raw = service("checkup-1", { userId: 48, type: "package", testAtHome: true });
    const { services } = mapCatalogue([checkup], [provider(48)], [raw]);
    // toMatchObject: the price has its own tests below.
    expect(services).toMatchObject([
      {
        id: "checkup-1",
        title: "Executive Health Check (Male)",
        type: "package",
        providerId: 48,
        categoryKey: "package.health-check-up",
        testAtHome: true,
      },
    ]);
  });

  it("puts a service with no category under Other", () => {
    const raw = service("no-category", { categoryId: null, subCategoryId: null });
    const { services } = mapCatalogue([checkup], [provider(48)], [raw]);
    expect(services[0]?.categoryKey).toBe(OTHER_CATEGORY_KEY);
    expect(services[0]?.subcategoryKey).toBeUndefined();
  });

  it("hides service 0004, which has status false", () => {
    const raw = service("0004", { status: false });
    expect(mapCatalogue([checkup], [provider(48)], [raw]).services).toEqual([]);
  });

  it("hides services of an inactive provider (161, 162)", () => {
    const raw = service("from-161", { userId: 161 });
    const inactive = provider(161, { status: "inactive" });
    expect(mapCatalogue([checkup], [inactive], [raw]).services).toEqual([]);
  });

  it("hides services in an inactive category (Seasonal Offers)", () => {
    const seasonal = category("seasonal", "seasonal-offers", "package", [], false);
    const raw = service("seasonal-1", { categoryId: "seasonal" });
    expect(mapCatalogue([seasonal], [provider(48)], [raw]).services).toEqual([]);
  });

  it("hides services in an inactive subcategory, like an inactive category", () => {
    const parent = category("checkup", "health-check-up", "package");
    parent.children = [subcategory("lady", "lady-checkup", parent, false)];
    const raw = service("lady-1", { categoryId: "checkup", subCategoryId: "lady" });
    expect(mapCatalogue([parent], [provider(48)], [raw]).services).toEqual([]);
  });

  it("hides a service whose provider, category or subcategory is missing from the data", () => {
    const noProvider = service("orphan-1", { userId: 999 });
    const noCategory = service("orphan-2", { categoryId: "missing" });
    const noSubcategory = service("orphan-3", { subCategoryId: "missing" });
    const raw = [noProvider, noCategory, noSubcategory];
    expect(mapCatalogue([checkup], [provider(48)], raw).services).toEqual([]);
  });
});

describe("mapCatalogue: prices", () => {
  // The rules themselves are tested in pricing.test.ts. These check the mapper picks the right
  // one, in the provider's currency, and hides a service it can't price.
  const nprProvider = provider(48);
  nprProvider.providerInformation = { ...nprProvider.providerInformation, currency: "NPR" };

  it("gives service 0001 its price, with the struck-through price", () => {
    const { services } = mapCatalogue([checkup], [provider(48)], [service("0001")]);
    const price = services[0]?.price;
    expect(price?.kind).toBe("fixed");
    if (price?.kind !== "fixed") return;
    expect(formatMoney(price.final)).toBe("5,970.60 THB");
    expect(price.original).toBeDefined();
    if (price.original === undefined) return;
    expect(formatMoney(price.original)).toBe("6,634.00 THB");
  });

  it("prices a service in its provider's currency", () => {
    const price = mapCatalogue([checkup], [nprProvider], [service("npr-1")]).services[0]?.price;
    expect(price?.kind).toBe("fixed");
    if (price?.kind !== "fixed") return;
    expect(price.final.currency).toBe("NPR");
  });

  it("gives wellness service 0003 a from price", () => {
    const raw = service("0003", { ...wellnessFields, wellnessPricing: [option(60, "1800.00")] });
    const price = mapCatalogue([checkup], [provider(48)], [raw]).services[0]?.price;
    expect(price?.kind).toBe("from");
    if (price?.kind !== "from") return;
    expect(formatMoney(price.lowest)).toBe("1,800.00 THB");
    expect(price.durationInMinutes).toBe(60);
  });

  it("hides a service with a null pricing field instead of showing 0", () => {
    const raw = [
      service("no-price", { price: null }),
      service("no-discount-type", { discountType: null }),
    ];
    expect(mapCatalogue([checkup], [provider(48)], raw).services).toEqual([]);
  });

  it("hides a wellness service with no options instead of showing 0", () => {
    const raw = service("no-options", { type: "wellness", price: null, wellnessPricing: [] });
    expect(mapCatalogue([checkup], [provider(48)], [raw]).services).toEqual([]);
  });
});

describe("mapCatalogue: price filter amounts", () => {
  it("gives a fixed service its final price", () => {
    const { services } = mapCatalogue([checkup], [provider(48)], [service("0001")]);
    expect(services[0]?.payableAmounts.map((a) => formatMoney(a))).toEqual(["5,970.60 THB"]);
  });

  it("gives a Free service 0", () => {
    const { services } = mapCatalogue(
      [checkup],
      [provider(48)],
      [service("0006", { price: "0.00" })],
    );
    expect(services[0]?.payableAmounts.map((a) => formatMoney(a))).toEqual(["0.00 THB"]);
  });

  it("gives wellness service 0003 every option's final price, not only the cheapest", () => {
    const raw = service("0003", {
      ...wellnessFields,
      wellnessPricing: [option(60, "1800.00"), option(90, "2400.00", "360.00")],
    });
    const { services } = mapCatalogue([checkup], [provider(48)], [raw]);
    expect(services[0]?.payableAmounts.map((a) => formatMoney(a))).toEqual([
      "1,800.00 THB",
      "2,040.00 THB",
    ]);
  });
});

describe("mapCatalogue: search text", () => {
  const bloodTests = { ...category("bt", "blood-tests", "lab_test"), title: "Blood Tests" };
  bloodTests.children = [{ ...subcategory("bt-thyroid", "thyroid", bloodTests), title: "Thyroid" }];

  it("keeps the title, category and provider name apart for relevance", () => {
    const raw = service("0007", {
      title: "  hba1c   TEST (Diabetes) ",
      categoryId: "bt",
      subCategoryId: "bt-thyroid",
    });
    const { services } = mapCatalogue([bloodTests], [provider(48)], [raw]);
    expect(services[0]?.search).toEqual({
      title: "hba1c test diabetes",
      category: "blood tests thyroid",
      provider: "riverside international hospital",
    });
  });

  it("leaves the category text empty for Other", () => {
    const raw = service("no-category", { categoryId: null });
    const { services } = mapCatalogue([checkup], [provider(48)], [raw]);
    expect(services[0]?.search.category).toBe("");
  });
});

describe("mapCatalogue: category keys", () => {
  // In the real data two top-level categories share the slug "ultrasound", and the subcategory
  // slug "thyroid" appears under three parents.
  const packageUltrasound = category("pu", "ultrasound", "package", ["thyroid"]);
  const labUltrasound = category("lu", "ultrasound", "lab_test", ["thyroid"]);
  const bloodTests = category("bt", "blood-tests", "lab_test", ["thyroid"]);
  const all = [packageUltrasound, labUltrasound, bloodTests];

  it("keeps the two ultrasound categories apart by including the type", () => {
    const keys = mapCatalogue(all, [], []).categories.map((c) => c.key);
    expect(keys).toEqual(["package.ultrasound", "lab_test.ultrasound", "lab_test.blood-tests"]);
  });

  it("keeps the three thyroid subcategories apart by including the parent", () => {
    const keys = mapCatalogue(all, [], []).categories.flatMap((c) =>
      c.subcategories.map((s) => s.key),
    );
    expect(keys).toEqual([
      "package.ultrasound.thyroid",
      "lab_test.ultrasound.thyroid",
      "lab_test.blood-tests.thyroid",
    ]);
  });

  it("gives a service the keys of its category and subcategory", () => {
    const raw = service("thyroid-scan", {
      type: "lab_test",
      categoryId: "lu",
      subCategoryId: "lu-thyroid",
    });
    const { services } = mapCatalogue(all, [provider(48)], [raw]);
    expect(services[0]?.categoryKey).toBe("lab_test.ultrasound");
    expect(services[0]?.subcategoryKey).toBe("lab_test.ultrasound.thyroid");
  });

  it("leaves inactive categories and subcategories out of the tree", () => {
    const seasonal = category("seasonal", "seasonal-offers", "package", [], false);
    const parent = category("checkup", "health-check-up", "package", ["general-checkup"]);
    parent.children.push(subcategory("lady", "lady-checkup", parent, false));
    const { categories } = mapCatalogue([seasonal, parent], [], []);
    expect(categories).toEqual([
      {
        key: "package.health-check-up",
        title: "health-check-up",
        type: "package",
        subcategories: [
          { key: "package.health-check-up.general-checkup", title: "general-checkup" },
        ],
      },
    ]);
  });

  it("orders categories and subcategories by position", () => {
    const second = { ...category("b", "second", "package"), position: 2 };
    const first = { ...category("a", "first", "package"), position: 1 };
    second.children = [
      { ...subcategory("b2", "later", second), position: 2 },
      { ...subcategory("b1", "earlier", second), position: 1 },
    ];
    const { categories } = mapCatalogue([second, first], [], []);
    expect(categories.map((c) => c.key)).toEqual(["package.first", "package.second"]);
    expect(categories[1]?.subcategories.map((s) => s.key)).toEqual([
      "package.second.earlier",
      "package.second.later",
    ]);
  });
});

describe("mapCatalogue: providers", () => {
  it("maps location, currency and rating", () => {
    expect(mapCatalogue([checkup], [provider(48)], [service("a")]).providers).toEqual([
      {
        id: 48,
        name: "Riverside International Hospital",
        currency: "THB",
        city: { slug: "bangkok", name: "Bangkok" },
        country: { code: "TH", name: "Thailand" },
        rating: { kind: "rated", stars: 4.7, reviewCount: 1203 },
      },
    ]);
  });

  it("marks provider 61, with rating null and 0 reviews, as new", () => {
    const newProvider = provider(61);
    newProvider.providerInformation = {
      ...newProvider.providerInformation,
      rating: null,
      reviewCount: 0,
    };
    const services = [service("a", { userId: 61 })];
    expect(mapCatalogue([checkup], [newProvider], services).providers[0]?.rating).toEqual({
      kind: "new",
    });
  });

  it("leaves inactive providers out", () => {
    const inactive = provider(161, { status: "inactive" });
    const services = [service("a", { userId: 161 }), service("b", { userId: 48 })];
    expect(
      mapCatalogue([checkup], [inactive, provider(48)], services).providers.map((p) => p.id),
    ).toEqual([48]);
  });

  it("leaves out an active provider with no visible services (163)", () => {
    const providers = [provider(163), provider(48)];
    const services = [service("a", { userId: 163, status: false }), service("b", { userId: 48 })];
    expect(mapCatalogue([checkup], providers, services).providers.map((p) => p.id)).toEqual([48]);
  });
});
