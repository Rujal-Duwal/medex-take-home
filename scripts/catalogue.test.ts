import { describe, expect, it } from "vitest";
import task1 from "../data/task1-service-explorer.json" with { type: "json" };
import { defaultQuery, runQuery } from "../src/features/services/engine";
import { mapCatalogue } from "../src/features/services/mappers";
import { OTHER_CATEGORY_KEY } from "../src/features/services/types";
import type { ApiCategory, ApiProvider, ApiService } from "../src/features/services/api-types";

// The engine over the real data, for the counts the spec asks the engine tests to hold.
// It lives in scripts/ because only scripts/ and src/lib/mock may read data/ (CLAUDE.md rule 1).

// The same cast as audit-data.ts, safe for the same reason: its "values match the API types"
// checks hold.
const raw = task1 as {
  categories: ApiCategory[];
  providers: ApiProvider[];
  services: ApiService[];
};
const catalogue = mapCatalogue(raw.categories, raw.providers, raw.services);

describe("the engine over the real data", () => {
  it("shows all 2,853 visible services with no filters", () => {
    expect(runQuery(catalogue, defaultQuery).serviceCount).toBe(2853);
  });

  it("shows 20 services under Other (22 with no category, 2 of them hidden)", () => {
    const result = runQuery(catalogue, { ...defaultQuery, categoryKeys: [OTHER_CATEGORY_KEY] });
    expect(result.serviceCount).toBe(20);
    expect(runQuery(catalogue, defaultQuery).facetCounts.category.get(OTHER_CATEGORY_KEY)).toBe(20);
  });

  it("keeps the two ultrasound categories apart", () => {
    const counts = runQuery(catalogue, defaultQuery).facetCounts.category;
    const packageUltrasound = counts.get("package.ultrasound") ?? 0;
    const labUltrasound = counts.get("lab_test.ultrasound") ?? 0;
    const both = runQuery(catalogue, {
      ...defaultQuery,
      categoryKeys: ["package.ultrasound", "lab_test.ultrasound"],
    }).serviceCount;
    expect(packageUltrasound).toBeGreaterThan(0);
    expect(labUltrasound).toBeGreaterThan(0);
    expect(both).toBe(packageUltrasound + labUltrasound);
  });

  it("sorts the five new providers (61, 105, 122, 139, 156) last by rating", () => {
    const groups: number[] = [];
    const first = runQuery(catalogue, { ...defaultQuery, sort: "rating" });
    for (let page = 1; page <= first.pageCount; page += 1) {
      const result = runQuery(catalogue, { ...defaultQuery, sort: "rating", page });
      groups.push(...result.groups.map((group) => group.provider.id));
    }
    expect(groups.slice(-5).toSorted((a, b) => a - b)).toEqual([61, 105, 122, 139, 156]);
  });

  it("finds service 0007 by 'hba1c test' in any case", () => {
    // Over 100 services match, so look inside 0007's provider, 46, opened in full.
    const result = runQuery(catalogue, {
      ...defaultQuery,
      search: " HBA1C   Test",
      providerIds: [46],
      openProviderIds: [46],
    });
    const ids = result.groups.flatMap((group) => group.services.map((s) => s.id));
    expect(ids).toContain("5f0c1a52-6b1e-4c1f-9a51-000000000007");
  });
});
