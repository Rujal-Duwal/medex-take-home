import type Big from "big.js";
import type { Currency } from "@/lib/money/money";
import { defaultQuery, type Location, type ServiceQuery, type SortOrder } from "./engine";
import type { Category, ServiceType } from "./types";
import { parseAmount, searchTextOf } from "./url-codec";

// What each control in the filter panel can ask for, and how it changes the query. The panel
// only reports a FilterChange; the explorer applies it here and writes the result to the URL.
// So every rule about what a click means lives in this file, and the panel stays markup.
// A new filter adds a kind here, a case in applyFilterChange and a line in hasActiveFilters.
export type FilterChange =
  // Ticks or unticks one option.
  | { kind: "type"; type: ServiceType }
  | { kind: "category"; key: string }
  | { kind: "provider"; id: number }
  | { kind: "home-test" }
  // Sets one value. No location means any location.
  | { kind: "location"; location?: Location }
  // Picks the price filter's currency, with no range yet. No currency is "Change currency":
  // the price filter goes, so the currency choice shows again.
  | { kind: "currency"; currency?: Currency }
  | { kind: "price-range"; currency: Currency; min?: Big; max?: Big }
  | { kind: "search"; text: string }
  | { kind: "sort"; sort: SortOrder }
  // "Clear all": every filter and the search go; the sort and expanded groups stay.
  | { kind: "clear" };

// Adds the value if it's missing, removes it if it's there.
function toggle<T>(values: T[], value: T): T[] {
  return values.includes(value) ? values.filter((item) => item !== value) : [...values, value];
}

// The category tree (spec "Filter panel"). Without this rule a category key and one of its
// subcategory keys would both be in the URL, and the category would match everything, so
// ticking the subcategory would change nothing.
// - Ticking a category chooses all of it. Unticking it clears it and its subcategories.
// - Ticking a subcategory narrows its category to the subcategories ticked.
// - Unticking the last subcategory goes back to the whole category, so the list the customer
//   is working in stays open.
// Other and categories with no subcategories just toggle.
function toggleCategory(keys: string[], key: string, categories: Category[]): string[] {
  const category = categories.find((item) => item.key === key);
  if (category !== undefined) {
    const ownKeys = new Set([category.key, ...category.subcategories.map((sub) => sub.key)]);
    const isChosen = keys.some((item) => ownKeys.has(item));
    return isChosen ? keys.filter((item) => !ownKeys.has(item)) : [...keys, key];
  }

  const parent = categories.find((item) => item.subcategories.some((sub) => sub.key === key));
  if (parent === undefined) return toggle(keys, key);

  if (!keys.includes(key)) return [...keys.filter((item) => item !== parent.key), key];
  const rest = keys.filter((item) => item !== key);
  const otherSubsChosen = parent.subcategories.some((sub) => rest.includes(sub.key));
  return otherSubsChosen || rest.includes(parent.key) ? rest : [...rest, parent.key];
}

// Each case changes only its own part of the query. Every change goes back to page 1, since
// the old page may not exist under the new filters.
function changedQuery(
  query: ServiceQuery,
  change: FilterChange,
  categories: Category[],
): ServiceQuery {
  switch (change.kind) {
    case "type": {
      return { ...query, types: toggle(query.types, change.type) };
    }
    case "category": {
      return { ...query, categoryKeys: toggleCategory(query.categoryKeys, change.key, categories) };
    }
    case "provider": {
      return { ...query, providerIds: toggle(query.providerIds, change.id) };
    }
    case "home-test": {
      return { ...query, homeTestOnly: !query.homeTestOnly };
    }
    case "location": {
      return { ...query, location: change.location };
    }
    case "currency": {
      return {
        ...query,
        price: change.currency === undefined ? undefined : { currency: change.currency },
      };
    }
    case "price-range": {
      const { currency, min, max } = change;
      return { ...query, price: { currency, min, max } };
    }
    case "search": {
      // Kept as typed, like the URL codec; the engine normalises it.
      return { ...query, search: change.text };
    }
    case "sort": {
      return { ...query, sort: change.sort };
    }
    case "clear": {
      return { ...defaultQuery, sort: query.sort, openProviderIds: query.openProviderIds };
    }
  }
}

// Whether "Clear all" would change anything: every part of the query that "clear" resets. Kept
// next to it, so a new filter is added to both.
export function hasActiveFilters(query: ServiceQuery): boolean {
  return (
    searchTextOf(query.search) !== "" ||
    query.types.length > 0 ||
    query.categoryKeys.length > 0 ||
    query.providerIds.length > 0 ||
    query.location !== undefined ||
    query.price !== undefined ||
    query.homeTestOnly
  );
}

export function applyFilterChange(
  query: ServiceQuery,
  change: FilterChange,
  categories: Category[],
): ServiceQuery {
  return { ...changedQuery(query, change, categories), page: 1 };
}

// What the price boxes hold once read. field says which box to point at.
export type PriceRangeInput =
  { kind: "ok"; min?: Big; max?: Big } | { kind: "invalid"; field: "min" | "max"; message: string };

const NOT_A_NUMBER = "Enter an amount in numbers, like 5000.";

// Reads one box. An empty box is no bound. Grouping commas are fine ("5,000"), since that is
// how prices are shown. The rest is the URL codec's rule, so anything accepted here reads back
// from the URL.
function readAmount(text: string): Big | undefined | "invalid" {
  const plain = text.trim().replaceAll(",", "");
  if (plain === "") return undefined;
  return parseAmount(plain) ?? "invalid";
}

export function readPriceRange(minText: string, maxText: string): PriceRangeInput {
  const min = readAmount(minText);
  if (min === "invalid") return { kind: "invalid", field: "min", message: NOT_A_NUMBER };
  const max = readAmount(maxText);
  if (max === "invalid") return { kind: "invalid", field: "max", message: NOT_A_NUMBER };
  if (min !== undefined && max !== undefined && min.gt(max)) {
    return {
      kind: "invalid",
      field: "min",
      message: "The lowest price is above the highest. Check the two amounts.",
    };
  }
  return { kind: "ok", min, max };
}
