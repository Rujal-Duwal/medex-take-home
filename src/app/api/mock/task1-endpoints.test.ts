import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { GET as getCategories } from "./category/active/route";
import { GET as getProviders } from "./providers/route";
import { GET as getServices } from "./service/route";

// The three Task 1 endpoints. Fake timers skip the 300 to 800 ms mock latency.

beforeEach(() => {
  vi.useFakeTimers();
});

afterEach(() => {
  vi.useRealTimers();
});

async function call(
  handler: (request: Request) => Promise<Response>,
  path: string,
): Promise<Response> {
  const pending = handler(new Request(`http://localhost${path}`));
  await vi.runAllTimersAsync();
  return pending;
}

describe("Task 1 mock endpoints", () => {
  it("GET /category/active returns all 13 top-level categories, inactive ones too", async () => {
    const response = await call(getCategories, "/api/mock/category/active");
    const body = (await response.json()) as { slug: string; status: boolean }[];

    expect(response.status).toBe(200);
    expect(body).toHaveLength(13);
    // Seasonal Offers is inactive; the mapper hides it, like every other visibility rule.
    expect(body.some(({ status }) => !status)).toBe(true);
  });

  it("GET /providers returns all 67 providers, inactive ones too", async () => {
    const response = await call(getProviders, "/api/mock/providers");
    expect(await response.json()).toHaveLength(67);
  });

  it("GET /service returns all 3,200 services with MedEx's field names", async () => {
    const response = await call(getServices, "/api/mock/service");
    const body = (await response.json()) as Record<string, unknown>[];

    expect(body).toHaveLength(3200);
    expect(body[0]).toHaveProperty("userId");
    expect(body[0]).toHaveProperty("wellnessPricing");
  });

  it("answers 500 with no body when the client forwards mockStatus=500", async () => {
    const response = await call(getServices, "/api/mock/service?mockStatus=500");

    expect(response.status).toBe(500);
    expect(await response.text()).toBe("");
  });
});
