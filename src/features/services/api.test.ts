import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { readForwardedMockParams } from "@/lib/mock/flags";
import { fakeFailureResponse } from "@/lib/mock/latency-and-failure";
import type { ApiCategory, ApiProvider, ApiService } from "./api-types";

// fetch-api.ts remembers fired :once rules for the life of the page, so each test imports a
// fresh copy, like a page load.
async function loadApi() {
  vi.resetModules();
  return import("./api");
}

const categories: ApiCategory[] = [
  {
    id: "checkup",
    title: "Health Check-up",
    slug: "health-check-up",
    type: "package",
    position: 1,
    status: true,
    parentId: null,
    children: [],
  },
];

const providers: ApiProvider[] = [
  {
    id: 48,
    name: "Riverside International Hospital",
    username: "riverside-international-hospital",
    status: "active",
    providerInformation: {
      companyName: "Riverside International Hospital",
      slug: "riverside-international-hospital",
      types: ["package"],
      currency: "THB",
      city: { id: "3d77", name: "Bangkok", slug: "bangkok" },
      country: { id: 219, name: "Thailand", alphaCode: "TH" },
      rating: 4.7,
      reviewCount: 1203,
    },
  },
];

const services: ApiService[] = [
  {
    id: "0001",
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
  },
];

// Stands in for the three mock endpoints, with the real server helper for faked failures.
const bodies: Record<string, unknown> = {
  "/api/mock/category/active": categories,
  "/api/mock/providers": providers,
  "/api/mock/service": services,
};
const fakeServer = vi.fn((url: URL) => {
  const { status } = readForwardedMockParams(url.searchParams);
  return Promise.resolve(
    status === undefined ? Response.json(bodies[url.pathname]) : fakeFailureResponse(status),
  );
});

beforeEach(() => {
  window.history.replaceState({}, "", "/services");
  fakeServer.mockClear();
  vi.stubGlobal("fetch", fakeServer);
});

afterEach(() => {
  vi.unstubAllGlobals();
});

describe("loadCatalogue", () => {
  it("loads the three endpoints and maps them into one catalogue", async () => {
    const { loadCatalogue } = await loadApi();
    const loaded = await loadCatalogue();

    expect(fakeServer).toHaveBeenCalledTimes(3);
    if (loaded.kind !== "ok") throw new Error(`expected ok, got ${loaded.kind}`);
    expect(loaded.data.providers.map(({ name }) => name)).toEqual([
      "Riverside International Hospital",
    ]);
    expect(loaded.data.services.map(({ id }) => id)).toEqual(["0001"]);
  });

  it("fails as a whole when one endpoint fails (?mockFail=providers:500)", async () => {
    window.history.replaceState({}, "", "/services?mockFail=providers:500");
    const { loadCatalogue } = await loadApi();

    expect(await loadCatalogue()).toEqual({ kind: "server", status: 500 });
  });

  it("services:500:once fails the first load and lets the retry through", async () => {
    window.history.replaceState({}, "", "/services?mockFail=services:500:once");
    const { loadCatalogue } = await loadApi();

    expect((await loadCatalogue()).kind).toBe("server");
    expect((await loadCatalogue()).kind).toBe("ok");
  });

  it("reports offline without sending anything (?mockOffline=1)", async () => {
    window.history.replaceState({}, "", "/services?mockOffline=1");
    const { loadCatalogue } = await loadApi();

    expect(await loadCatalogue()).toEqual({ kind: "offline" });
    expect(fakeServer).not.toHaveBeenCalled();
  });
});
