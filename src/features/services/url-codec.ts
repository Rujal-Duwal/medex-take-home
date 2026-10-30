import Big from "big.js";
import { CURRENCIES } from "@/lib/money/money";
import {
  defaultQuery,
  locationKey,
  SORT_ORDERS,
  type Location,
  type PriceFilter,
  type ServiceQuery,
} from "./engine";
import { OTHER_CATEGORY_KEY, SERVICE_TYPES, type Catalogue, type ServiceType } from "./types";

// The Task 1 URL codec (spec "URL codec", ADR 0006). The URL is the source of truth for the
// view: the server page and the client both read it with parseServicesUrl, and the client writes
// it back with toServicesSearchParams.
// Defaults are left out of the URL. Anything bad or unknown is dropped quietly, so a mistyped or
// old link still shows a sensible page instead of an error.
// The page always renders what parseServicesUrl returns, never a state before it is written, so
// anything the parser drops (a 4th compared provider, min above max) is gone from the view at
// once too, and a reload shows the same view.
// Only parse with the catalogue loaded: with an empty one every provider, category and location
// counts as unknown and is dropped. Until it loads, keep the URL as it is.
// Checks against a list use find, not includes: find hands back the value typed as the list's
// union (ServiceType, Currency, SortOrder), so no cast is needed.
// A new param goes in ServicesUrlState (or ServiceQuery), parseServicesUrl and
// toServicesSearchParams, with a row in the round trip test.

export const MAX_COMPARED_PROVIDERS = 3;

// No room for another provider in compare. The one place for the limit rule: the card's box,
// the tray's hint and the compare list rules (compare.ts) all ask this.
export function isCompareFull(ids: number[]): boolean {
  return ids.length >= MAX_COMPARED_PROVIDERS;
}

export interface ServicesUrlState {
  query: ServiceQuery;
  // Providers chosen for side-by-side compare. Kept out of ServiceQuery because it
  // doesn't change the results.
  compareProviderIds: number[];
}

// Next.js gives a page its searchParams (once awaited) as an object, with an array for a
// repeated param.
// This turns it into URLSearchParams, so the server and the client parse the same thing.
export function searchParamsFromRecord(
  record: Record<string, string | string[] | undefined>,
): URLSearchParams {
  const params = new URLSearchParams();
  for (const [name, value] of Object.entries(record)) {
    if (value === undefined) continue;
    for (const item of Array.isArray(value) ? value : [value]) params.append(name, item);
  }
  return params;
}

// The values a link may point at. Built from the mapped catalogue, so anything hidden (an
// inactive provider, the Seasonal Offers category) counts as unknown and is dropped.
interface KnownValues {
  categoryKeys: Set<string>;
  providerIds: Set<number>;
  // Keyed by locationKey ("city:bangkok", "country:TH"), the same text the URL holds, so
  // reading a loc is one lookup and can't drift from how toServicesSearchParams writes it.
  locations: Map<string, Location>;
}

function knownValues(catalogue: Catalogue): KnownValues {
  const known: KnownValues = {
    categoryKeys: new Set([OTHER_CATEGORY_KEY]),
    providerIds: new Set(),
    locations: new Map(),
  };
  for (const category of catalogue.categories) {
    known.categoryKeys.add(category.key);
    for (const subcategory of category.subcategories) known.categoryKeys.add(subcategory.key);
  }
  for (const provider of catalogue.providers) {
    known.providerIds.add(provider.id);
    const city: Location = { kind: "city", slug: provider.city.slug };
    const country: Location = { kind: "country", code: provider.country.code };
    known.locations.set(locationKey(city), city);
    known.locations.set(locationKey(country), country);
  }
  return known;
}

// Keeps the first copy of each value, in the order the URL gives them.
function unique<T>(values: T[]): T[] {
  return [...new Set(values)];
}

// Digits only: no sign, no decimals, no exponent, no leading zero ("048" would come back as "48",
// giving one view two URLs). Too big to be exact as a JS number is bad too.
function parseWholeNumber(value: string): number | undefined {
  if (!/^(0|[1-9]\d*)$/.test(value)) return undefined;
  const number = Number(value);
  return Number.isSafeInteger(number) ? number : undefined;
}

function parseProviderIds(values: string[], known: KnownValues): number[] {
  const ids: number[] = [];
  for (const value of values) {
    const id = parseWholeNumber(value);
    if (id !== undefined && known.providerIds.has(id)) ids.push(id);
  }
  return unique(ids);
}

function parseTypes(values: string[]): ServiceType[] {
  const types: ServiceType[] = [];
  for (const value of values) {
    const type = SERVICE_TYPES.find((serviceType) => serviceType === value);
    if (type !== undefined) types.push(type);
  }
  return unique(types);
}

// A plain amount, like a customer would type: "1000" or "1000.50". Never negative, no exponent,
// so "1e3" is dropped rather than read as 1000. Any number of decimals: a bound is not a price,
// and anything toFixed() writes must read back, or a range would vanish on reload.
// The price filter's boxes read what the customer types through this too (readPriceRange).
export function parseAmount(value: string | null): Big | undefined {
  if (value === null || !/^\d+(\.\d+)?$/.test(value)) return undefined;
  return new Big(value);
}

// min and max only mean something in a currency, so without a valid cur they are dropped
// (spec Decisions). A range with min above max is dropped and the currency kept: there
// is no way to tell which end the customer meant.
function parsePrice(params: URLSearchParams): PriceFilter | undefined {
  const cur = params.get("cur");
  const currency = CURRENCIES.find((code) => code === cur);
  if (currency === undefined) return undefined;
  const min = parseAmount(params.get("min"));
  const max = parseAmount(params.get("max"));
  const price: PriceFilter = { currency };
  if (min !== undefined && max !== undefined && min.gt(max)) return price;
  if (min !== undefined) price.min = min;
  if (max !== undefined) price.max = max;
  return price;
}

// The search text is kept as typed (the engine normalises it), but only spaces is no search.
// The one place for that rule: the codec, the search box and the filters all go through it.
export function searchTextOf(text: string): string {
  return text.trim() === "" ? defaultQuery.search : text;
}

// Also read on its own by the search box when the customer goes Back.
export function parseSearchText(params: URLSearchParams): string {
  return searchTextOf(params.get("q") ?? "");
}

export function parseServicesUrl(params: URLSearchParams, catalogue: Catalogue): ServicesUrlState {
  const known = knownValues(catalogue);
  const page = parseWholeNumber(params.get("page") ?? "");
  const sort = params.get("sort");

  const query: ServiceQuery = {
    search: parseSearchText(params),
    types: parseTypes(params.getAll("type")),
    categoryKeys: unique(params.getAll("cat").filter((key) => known.categoryKeys.has(key))),
    providerIds: parseProviderIds(params.getAll("provider"), known),
    homeTestOnly: params.get("home") === "1",
    sort: SORT_ORDERS.find((order) => order === sort) ?? defaultQuery.sort,
    // A page past the end is the engine's job: it shows the last page.
    page: page !== undefined && page >= 1 ? page : defaultQuery.page,
    openProviderIds: parseProviderIds(params.getAll("open"), known),
  };
  // Optional fields are only set when present, so a parsed state equals one built by hand.
  // "city:bangkok" or "country:TH" (spec table). Only one location: a second loc is ignored.
  // Anything that isn't exactly a key we know (city:atlantis, bangkok, city:bangkok:extra) misses.
  const location = known.locations.get(params.get("loc") ?? "");
  if (location !== undefined) query.location = location;
  const price = parsePrice(params);
  if (price !== undefined) query.price = price;

  return {
    query,
    compareProviderIds: parseProviderIds((params.get("compare") ?? "").split(","), known).slice(
      0,
      MAX_COMPARED_PROVIDERS,
    ),
  };
}

// Params in the order of the spec table, so the same view always gives the same URL.
export function toServicesSearchParams(state: ServicesUrlState): URLSearchParams {
  const { query } = state;
  const params = new URLSearchParams();
  if (searchTextOf(query.search) !== "") params.set("q", query.search);
  for (const type of query.types) params.append("type", type);
  for (const key of query.categoryKeys) params.append("cat", key);
  for (const id of query.providerIds) params.append("provider", String(id));
  if (query.location) params.set("loc", locationKey(query.location));
  if (query.price) {
    params.set("cur", query.price.currency);
    // toFixed() with no argument never uses an exponent, unlike toString() on huge amounts.
    if (query.price.min) params.set("min", query.price.min.toFixed());
    if (query.price.max) params.set("max", query.price.max.toFixed());
  }
  if (query.homeTestOnly) params.set("home", "1");
  if (query.sort !== defaultQuery.sort) params.set("sort", query.sort);
  if (query.page > 1) params.set("page", String(query.page));
  for (const id of query.openProviderIds) params.append("open", String(id));
  if (state.compareProviderIds.length > 0) {
    params.set("compare", state.compareProviderIds.join(","));
  }
  return params;
}

// The /services address for a view. The result links and the filters both build it here, so
// they write the same URL for the same view (defaults left out, params in the spec's order).
export function servicesHref(state: ServicesUrlState): string {
  const search = toServicesSearchParams(state).toString();
  return search === "" ? "/services" : `/services?${search}`;
}
