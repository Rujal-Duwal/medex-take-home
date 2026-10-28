import type Big from "big.js";
import { compareMoney, CURRENCIES, type Currency } from "@/lib/money/money";
import { normalizeForSearch } from "./mappers";
import { shownAmount } from "./pricing";
import type { Catalogue, Provider, Service, ServiceType } from "./types";

// The Task 1 query engine (spec "Query engine", ADR 0006). Pure: the server render and the
// client run this same function, so they can't disagree about what matches.
// A new filter goes in ServiceQuery and defaultQuery, matchesFilters, and, if it has counts,
// Facet, withoutFacet, FacetCounts and countAllFacets.

export const PAGE_SIZE = 10; // provider groups per page (D9)
export const GROUP_PREVIEW_SIZE = 3; // services shown per group before "View all N"

// A list as well as a type, so the URL codec can check a value from the address bar.
export const SORT_ORDERS = ["relevance", "price-asc", "price-desc", "rating"] as const;
export type SortOrder = (typeof SORT_ORDERS)[number];

// One city or one country, never both, so a location implies at most one currency.
export type Location = { kind: "city"; slug: string } | { kind: "country"; code: string };

// The price filter (D7): one currency, and an optional range in that currency. The range sits
// with its currency, so it can never be read as an amount in another one. A currency with no
// range still filters: only services priced in it show.
export interface PriceFilter {
  currency: Currency;
  min?: Big;
  max?: Big;
}

// Everything the URL can hold that changes the results (the URL codec builds this, WBS 3.4).
// An empty list means "no filter", not "match nothing".
export interface ServiceQuery {
  search: string;
  types: ServiceType[];
  // Category or subcategory keys, or OTHER_CATEGORY_KEY. A category key also matches its
  // subcategories.
  categoryKeys: string[];
  providerIds: number[];
  location?: Location;
  price?: PriceFilter;
  homeTestOnly: boolean;
  sort: SortOrder;
  page: number;
  // Groups expanded in place by "View all N" (D10).
  openProviderIds: number[];
}

export const defaultQuery: ServiceQuery = {
  search: "",
  types: [],
  categoryKeys: [],
  providerIds: [],
  homeTestOnly: false,
  sort: "relevance",
  page: 1,
  openProviderIds: [],
};

export interface ProviderGroup {
  provider: Provider;
  // The first GROUP_PREVIEW_SIZE matching services under the sort, or all of them when open.
  services: Service[];
  // The N in "View all N services": this provider's services under the active filters.
  matchingCount: number;
  isOpen: boolean;
}

// How many services each option would give with every other filter applied (T1-04).
// Options with no matching service are left out of the maps: read them with `?? 0`.
export interface FacetCounts {
  type: Map<ServiceType, number>;
  // Category keys, subcategory keys and OTHER_CATEGORY_KEY.
  category: Map<string, number>;
  provider: Map<number, number>;
  // Keyed by locationKey: "city:bangkok", "country:TH".
  location: Map<string, number>;
  currency: Map<Currency, number>;
  homeTest: number;
}

export interface QueryResult {
  groups: ProviderGroup[];
  serviceCount: number;
  providerCount: number;
  // The page actually shown: a page past the end shows the last one.
  page: number;
  pageCount: number;
  // The currency the price filter offers its range in: the one chosen, or the one the location
  // implies (D7). Undefined when results can span currencies and none is chosen.
  priceCurrency?: Currency;
  facetCounts: FacetCounts;
}

export function locationKey(location: Location): string {
  return location.kind === "city" ? `city:${location.slug}` : `country:${location.code}`;
}

function isAt(provider: Provider, location: Location): boolean {
  return location.kind === "city"
    ? provider.city.slug === location.slug
    : provider.country.code === location.code;
}

// D7: a location implies a currency when every provider there uses the same one. In the data
// each country has one currency (the audit asserts that). It only picks the currency the price
// filter offers; it doesn't filter anything, since the location already does.
function impliedCurrency(location: Location, providers: Provider[]): Currency | undefined {
  const currencies = new Set<Currency>();
  for (const provider of providers) {
    if (isAt(provider, location)) currencies.add(provider.currency);
  }
  return currencies.size === 1 ? [...currencies][0] : undefined;
}

// A service with its provider, so filters and sorts can read the location and rating, and its
// search rank, worked out once.
interface Row {
  service: Service;
  provider: Provider;
  rank: number;
}

function isInCategories(service: Service, categoryKeys: string[]): boolean {
  return (
    categoryKeys.includes(service.categoryKey) ||
    (service.subcategoryKey !== undefined && categoryKeys.includes(service.subcategoryKey))
  );
}

// A wellness service matches if any of its options is in range. Each amount's currency is
// checked before its value, so two currencies are never compared.
function matchesPrice(service: Service, price: PriceFilter): boolean {
  return service.payableAmounts.some(
    ({ amount, currency }) =>
      currency === price.currency &&
      (price.min === undefined || amount.gte(price.min)) &&
      (price.max === undefined || amount.lte(price.max)),
  );
}

// Within one filter the chosen options are OR; a service must pass every filter (AND).
// Search is not here: runQuery applies it once, before everything else.
function matchesFilters({ service, provider }: Row, query: ServiceQuery): boolean {
  if (query.types.length > 0 && !query.types.includes(service.type)) return false;
  if (query.categoryKeys.length > 0 && !isInCategories(service, query.categoryKeys)) return false;
  if (query.providerIds.length > 0 && !query.providerIds.includes(service.providerId)) return false;
  if (query.location !== undefined && !isAt(provider, query.location)) return false;
  if (query.price !== undefined && !matchesPrice(service, query.price)) return false;
  if (query.homeTestOnly && !service.testAtHome) return false;
  return true;
}

// D6: how well a service matches the search, lower is better, undefined for no match. This is
// the one place the search rule lives. On the title, a whole word beats the start of a word,
// which beats anywhere in it; then the category, then the provider name. The whole phrase has
// to be in one field. Both sides went through normalizeForSearch, so words are split by single
// spaces.
function searchRank(service: Service, search: string): number | undefined {
  const title = ` ${service.search.title} `;
  if (title.includes(` ${search} `)) return 0;
  if (title.includes(` ${search}`)) return 1;
  if (service.search.title.includes(search)) return 2;
  if (service.search.category.includes(search)) return 3;
  if (service.search.provider.includes(search)) return 4;
  return undefined;
}

type Facet = "type" | "category" | "provider" | "location" | "price" | "homeTest";

// The query with one facet's filter cleared, for that facet's counts (T1-04).
function withoutFacet(query: ServiceQuery, facet: Facet): ServiceQuery {
  switch (facet) {
    case "type": {
      return { ...query, types: [] };
    }
    case "category": {
      return { ...query, categoryKeys: [] };
    }
    case "provider": {
      return { ...query, providerIds: [] };
    }
    case "location": {
      return { ...query, location: undefined };
    }
    case "price": {
      return { ...query, price: undefined };
    }
    case "homeTest": {
      return { ...query, homeTestOnly: false };
    }
  }
}

// Counts each row under the option keys it belongs to.
function countBy<K>(rows: Row[], keysOf: (row: Row) => K[]): Map<K, number> {
  const counts = new Map<K, number>();
  for (const row of rows) {
    for (const key of keysOf(row)) counts.set(key, (counts.get(key) ?? 0) + 1);
  }
  return counts;
}

// One pass per facet over the rows that pass every filter except that facet's.
// Counts are services, not providers.
function countAllFacets(rows: Row[], query: ServiceQuery): FacetCounts {
  const without = (facet: Facet) => {
    const cleared = withoutFacet(query, facet);
    return rows.filter((row) => matchesFilters(row, cleared));
  };
  return {
    type: countBy(without("type"), ({ service }) => [service.type]),
    category: countBy(without("category"), ({ service }) =>
      service.subcategoryKey === undefined
        ? [service.categoryKey]
        : [service.categoryKey, service.subcategoryKey],
    ),
    provider: countBy(without("provider"), ({ service }) => [service.providerId]),
    location: countBy(without("location"), ({ provider }) => [
      locationKey({ kind: "city", slug: provider.city.slug }),
      locationKey({ kind: "country", code: provider.country.code }),
    ]),
    // The currency choice inside the price filter: how many services each currency has.
    currency: countBy(without("price"), ({ provider }) => [provider.currency]),
    homeTest: without("homeTest").filter(({ service }) => service.testAtHome).length,
  };
}

// Rating high to low, then review count, new providers (no rating) last.
function compareRating(a: Provider, b: Provider): number {
  if (a.rating.kind === "new" && b.rating.kind === "new") return 0;
  if (a.rating.kind === "new") return 1;
  if (b.rating.kind === "new") return -1;
  return b.rating.stars - a.rating.stars || b.rating.reviewCount - a.rating.reviewCount;
}

// D8: a price sort never compares two currencies. Services sort by currency first, in the
// CURRENCIES order, so each currency forms its own section; with a price filter or a location
// there is only one. A provider has one currency, so a provider's group never spans two
// sections.
function compareRows(a: Row, b: Row, sort: SortOrder): number {
  switch (sort) {
    case "relevance": {
      return a.rank - b.rank || compareRating(a.provider, b.provider);
    }
    case "rating": {
      return compareRating(a.provider, b.provider);
    }
    case "price-asc":
    case "price-desc": {
      const bySection =
        CURRENCIES.indexOf(a.provider.currency) - CURRENCIES.indexOf(b.provider.currency);
      if (bySection !== 0) return bySection;
      const byPrice = compareMoney(
        shownAmount(a.service.price, a.provider.currency),
        shownAmount(b.service.price, b.provider.currency),
      );
      return sort === "price-asc" ? byPrice : -byPrice;
    }
  }
}

// One provider's matching services, in sort order.
interface ProviderMatches {
  provider: Provider;
  services: Service[];
}

// The rows arrive sorted, and a Map keeps insertion order, so groups come out ordered by their
// best service and each group's services stay sorted.
function groupByProvider(rows: Row[]): ProviderMatches[] {
  const groups = new Map<number, ProviderMatches>();
  for (const { service, provider } of rows) {
    const group = groups.get(provider.id);
    if (group === undefined) groups.set(provider.id, { provider, services: [service] });
    else group.services.push(service);
  }
  return [...groups.values()];
}

export function runQuery(catalogue: Catalogue, query: ServiceQuery): QueryResult {
  const providerById = new Map(catalogue.providers.map((provider) => [provider.id, provider]));
  const search = normalizeForSearch(query.search);

  // Search applies to the results and to every facet's counts, so it is applied once, here.
  const rows: Row[] = [];
  for (const service of catalogue.services) {
    const provider = providerById.get(service.providerId);
    if (provider === undefined) continue;
    const rank = search === "" ? 0 : searchRank(service, search);
    if (rank !== undefined) rows.push({ service, provider, rank });
  }

  // One pass with every filter for the results. sort() is stable, so ties keep the data order.
  const found = rows.filter((row) => matchesFilters(row, query));
  found.sort((a, b) => compareRows(a, b, query.sort));

  const allGroups = groupByProvider(found);
  const pageCount = Math.max(1, Math.ceil(allGroups.length / PAGE_SIZE));
  // The URL codec only sends whole numbers; anything else shows page 1.
  const requested = Number.isInteger(query.page) ? query.page : 1;
  const page = Math.min(Math.max(1, requested), pageCount);
  const groups = allGroups
    .slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE)
    .map(({ provider, services }) => {
      const isOpen = query.openProviderIds.includes(provider.id);
      return {
        provider,
        services: isOpen ? services : services.slice(0, GROUP_PREVIEW_SIZE),
        matchingCount: services.length,
        isOpen,
      };
    });

  return {
    groups,
    serviceCount: found.length,
    providerCount: allGroups.length,
    page,
    pageCount,
    priceCurrency:
      query.price?.currency ??
      (query.location === undefined
        ? undefined
        : impliedCurrency(query.location, catalogue.providers)),
    facetCounts: countAllFacets(rows, query),
  };
}
