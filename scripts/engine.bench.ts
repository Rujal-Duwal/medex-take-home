import { expect, test } from "vitest";
import task1 from "../data/task1-service-explorer.json" with { type: "json" };
import type { ApiCategory, ApiProvider, ApiService } from "../src/features/services/api-types";
import { runQuery } from "../src/features/services/engine";
import { toFiltersView } from "../src/features/services/filters-view";
import { mapCatalogue } from "../src/features/services/mappers";
import { toResultsView } from "../src/features/services/results-view";
import { parseServicesUrl } from "../src/features/services/url-codec";

// The Task 1 engine over all 3,200 services in the data (T1-12, spec "Performance write-up").
// It lives in scripts/ because only scripts/ and src/lib/mock may read data/ (CLAUDE.md rule 1).
// Run with `npm run bench`; the numbers go in the README's Performance table.
//
// Two steps per filter state:
// - "engine": runQuery alone. Spec target: under 20 ms, leaving room for React in the 100 ms.
// - "per change": what ServiceExplorer does on every change (its clientViews memo): parse the
//   URL, run the engine, build the results and filter views. React's render comes on top.
//
// Vitest 5 style: `bench` is a fixture on the test context, and `.run()` runs it.
// https://vitest.dev/guide/benchmarking

// The same cast as audit-data.ts, safe for the same reason: its "values match the API types"
// checks hold.
const raw = task1 as {
  categories: ApiCategory[];
  providers: ApiProvider[];
  services: ApiService[];
};
const catalogue = mapCatalogue(raw.categories, raw.providers, raw.services);

// Each state is a URL a customer could land on, with the count it must show. Checking the count
// once before timing means the numbers are for the right work.
const states = [
  { name: "no filters", url: "", serviceCount: 2853 },
  { name: "search thyroid", url: "q=thyroid", serviceCount: 361 },
  // The brief's story: a package near Bangkok under 5,000 THB. Three filters at once.
  {
    name: "package, Bangkok, up to 5,000 THB",
    url: "type=package&loc=city:bangkok&cur=THB&max=5000",
    serviceCount: 7,
  },
  {
    name: "category and 2 providers",
    url: "cat=package.health-check-up&provider=48&provider=61",
    serviceCount: 10,
  },
  { name: "price low to high in THB", url: "sort=price-asc&cur=THB", serviceCount: 1603 },
  { name: "rating, page 3", url: "sort=rating&page=3", serviceCount: 2853 },
];

// p95 by the nearest-rank method: the sample 95% of the way up the sorted list.
// Vitest reports p50 and p99 but not p95, which the spec asks for.
function p95(sortedSamples: readonly number[]): number {
  const index = Math.ceil(sortedSamples.length * 0.95) - 1;
  return sortedSamples[index] ?? Number.NaN;
}

function summary(name: string, latency: { p50: number; samples?: readonly number[] }): string {
  const samples = latency.samples ?? [];
  return `${name}: median ${latency.p50.toFixed(2)} ms, p95 ${p95(samples).toFixed(2)} ms (${String(samples.length)} runs)`;
}

for (const state of states) {
  test(state.name, async ({ bench }) => {
    // Vitest turns imports into getters; local references keep that cost out of the numbers.
    // https://vitest.dev/guide/benchmarking#module-runner-overhead
    const parse = parseServicesUrl;
    const run = runQuery;
    const resultsView = toResultsView;
    const filtersView = toFiltersView;

    const urlState = parse(new URLSearchParams(state.url), catalogue);
    expect(run(catalogue, urlState.query).serviceCount).toBe(state.serviceCount);

    // retainSamples keeps every timing, so p95 can be worked out.
    const engine = await bench("engine", { retainSamples: true }, () => {
      run(catalogue, urlState.query);
    }).run();
    const perChange = await bench("per change", { retainSamples: true }, () => {
      const changed = parse(new URLSearchParams(state.url), catalogue);
      const result = run(catalogue, changed.query);
      resultsView(result, changed);
      filtersView(catalogue, result, changed.query);
    }).run();

    console.log(`${state.name}\n  ${summary("engine", engine.latency)}`);
    console.log(`  ${summary("per change", perChange.latency)}`);
  });
}
