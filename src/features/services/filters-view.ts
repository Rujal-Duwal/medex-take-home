import { CURRENCIES, formatMoney, type Currency } from "@/lib/money/money";
import {
  countMatches,
  locationKey,
  SORT_ORDERS,
  type Location,
  type PriceFilter,
  type QueryResult,
  type ServiceQuery,
  type SortOrder,
} from "./engine";
import {
  activeFilterGroups,
  applyFilterChange,
  hasActiveFilters,
  type FilterChange,
  type FilterGroup,
} from "./filter-changes";
import { normalizeForSearch } from "./mappers";
import { countOf, formatCount, TYPE_LABELS } from "./results-view";
import {
  OTHER_CATEGORY_KEY,
  SERVICE_TYPES,
  type Catalogue,
  type Category,
  type Provider,
} from "./types";
import { searchTextOf } from "./url-codec";

// What the filter panel shows, worked out from the catalogue and the engine's result, like
// ResultsView for the results: plain strings, numbers, booleans and FilterChange objects, so
// the server can pass it to the client component, and the display rules (D5, the category
// tree, the currency step) are tested here, not in the components.

// One checkbox (or radio) with its count.
export interface FilterOptionView {
  // Unique in the panel: the React key and the checkbox id.
  id: string;
  label: string;
  // A second line under the label: the provider's city.
  detail?: string;
  // "1,204": what choosing this option would show, with every other filter applied (T1-04).
  count: string;
  isChecked: boolean;
  // A category with some of its subcategories ticked: the checkbox shows a dash.
  isMixed: boolean;
  // D5: 0 results and not chosen. Shown muted with "0", still focusable, clicks do nothing.
  // A chosen option with 0 stays available, so it can be cleared.
  isUnavailable: boolean;
  // What clicking it asks for (filter-changes.ts).
  change: FilterChange;
}

export interface CategoryOptionView extends FilterOptionView {
  // Empty until the category or one of its subcategories is chosen ("choosing a category
  // reveals its subcategories").
  subcategories: FilterOptionView[];
}

// Categories under their type's label, so the two "Ultrasound" categories read as "Package >
// Ultrasound" and "Lab test > Ultrasound".
export interface CategoryGroupView {
  label: string;
  categories: CategoryOptionView[];
}

// One <option> of a native select.
export interface SelectOptionView {
  value: string;
  label: string;
  // Only the location's cities and countries can be (D5); sort and "Any location" never are.
  isUnavailable?: boolean;
  change: FilterChange;
}

export interface LocationView {
  // The chosen option's value ("city:bangkok"), or "" for any location.
  value: string;
  any: SelectOptionView;
  // An option group per country: "All of Thailand" first, then its cities.
  countries: { label: string; options: SelectOptionView[] }[];
}

// D7: the range appears once there is a currency, chosen (cur) or implied by the location.
// Until then the customer picks one, with counts.
export type PriceFilterView =
  | { kind: "choose-currency"; note: string; currencies: FilterOptionView[] }
  | {
      kind: "range";
      currency: Currency;
      // What the boxes start with: the URL's bounds, or "" for none.
      min: string;
      max: string;
      // Only a chosen currency can be changed; one implied by the location goes with it.
      canChangeCurrency: boolean;
      // What Apply sends with both boxes empty. In the location's currency that is no price
      // filter at all: keeping cur would leave other countries at 0 with no way to remove it.
      // In a chosen currency the currency stays, with no bounds.
      emptyRangeChange: FilterChange;
    };

// One active filter value above the results, with an X to remove it (HANDOFF "Active
// filters"). Its accessible name is "Remove filter: " plus the label.
export interface ChipView {
  // Unique among the chips: the React key, and how focus finds the next chip.
  id: string;
  label: string;
  change: FilterChange;
}

// A button in the empty state: "Remove the price filter (124 services)".
export interface WayOutView {
  label: string;
  change: FilterChange;
}

export interface FiltersView {
  types: FilterOptionView[];
  categoryGroups: CategoryGroupView[];
  otherCategory: FilterOptionView;
  // By name. Unavailable ones last, below a divider (D5). One list, not two, so an option that
  // moves across the divider keeps its DOM node. The browser still drops focus when React moves
  // it, so ProviderFilter puts focus back.
  providers: FilterOptionView[];
  location: LocationView;
  price: PriceFilterView;
  homeTest: FilterOptionView;
  sort: { value: string; options: SelectOptionView[] };
  // The search text from the URL, for the search box.
  search: string;
  // Shows "Clear all". The sort is not a filter, so it doesn't count.
  hasActiveFilters: boolean;
  // In the panel's order, so the order doesn't change when one goes.
  chips: ChipView[];
  // Only with no results: the filters whose removal brings some back, most first, then
  // "Clear all filters".
  waysOut: WayOutView[];
}

const SORT_LABELS: Record<SortOrder, string> = {
  relevance: "Relevance",
  "price-asc": "Price: low to high",
  "price-desc": "Price: high to low",
  rating: "Rating",
};

function byName(a: { name: string }, b: { name: string }): number {
  return a.name.localeCompare(b.name, "en");
}

interface OptionFacts {
  id: string;
  label: string;
  count: number;
  isChecked: boolean;
  // A category with some of its subcategories ticked (the dash).
  isMixed?: boolean;
  change: FilterChange;
}

// The D5 rule: an option with 0 is unavailable, unless it is chosen, so it can be cleared.
// The checkboxes (through option()) and the location select both use it.
function isUnavailable(count: number, isChosen: boolean): boolean {
  return count === 0 && !isChosen;
}

function option({
  id,
  label,
  count,
  isChecked,
  isMixed = false,
  change,
}: OptionFacts): FilterOptionView {
  return {
    id,
    label,
    count: formatCount(count),
    isChecked,
    isMixed,
    isUnavailable: isUnavailable(count, isChecked || isMixed),
    change,
  };
}

function categoryOption(
  category: Category,
  query: ServiceQuery,
  counts: Map<string, number>,
): CategoryOptionView {
  const keys = query.categoryKeys;
  const isChecked = keys.includes(category.key);
  const isMixed = !isChecked && category.subcategories.some((sub) => keys.includes(sub.key));
  const subcategories =
    isChecked || isMixed
      ? category.subcategories.map((sub) =>
          option({
            id: `cat-${sub.key}`,
            label: sub.title,
            count: counts.get(sub.key) ?? 0,
            isChecked: keys.includes(sub.key),
            change: { kind: "category", key: sub.key },
          }),
        )
      : [];
  return {
    ...option({
      id: `cat-${category.key}`,
      label: category.title,
      count: counts.get(category.key) ?? 0,
      isChecked,
      isMixed,
      change: { kind: "category", key: category.key },
    }),
    subcategories,
  };
}

function categoryGroups(
  catalogue: Catalogue,
  query: ServiceQuery,
  result: QueryResult,
): CategoryGroupView[] {
  const groups: CategoryGroupView[] = [];
  for (const type of SERVICE_TYPES) {
    const ofType = catalogue.categories.filter((category) => category.type === type);
    if (ofType.length === 0) continue;
    groups.push({
      label: TYPE_LABELS[type],
      categories: ofType.map((category) =>
        categoryOption(category, query, result.facetCounts.category),
      ),
    });
  }
  return groups;
}

function providerOptions(
  catalogue: Catalogue,
  query: ServiceQuery,
  result: QueryResult,
): FilterOptionView[] {
  const options = [...catalogue.providers].sort(byName).map((provider) => ({
    ...option({
      id: `provider-${String(provider.id)}`,
      label: provider.name,
      count: result.facetCounts.provider.get(provider.id) ?? 0,
      isChecked: query.providerIds.includes(provider.id),
      change: { kind: "provider", id: provider.id },
    }),
    detail: provider.city.name,
  }));
  return [
    ...options.filter((item) => !item.isUnavailable),
    ...options.filter((item) => item.isUnavailable),
  ];
}

function selectOption(
  location: Location,
  label: string,
  query: ServiceQuery,
  counts: Map<string, number>,
): SelectOptionView {
  const value = locationKey(location);
  const count = counts.get(value) ?? 0;
  const isChosen = query.location !== undefined && locationKey(query.location) === value;
  return {
    value,
    label: `${label} (${formatCount(count)})`,
    isUnavailable: isUnavailable(count, isChosen),
    change: { kind: "location", location },
  };
}

// Countries by name, each with its cities by name, from the providers a customer can see.
function locationView(
  catalogue: Catalogue,
  query: ServiceQuery,
  result: QueryResult,
): LocationView {
  const countries = new Map<string, { country: Provider["country"]; cities: Provider["city"][] }>();
  for (const { country, city } of catalogue.providers) {
    const entry = countries.get(country.code) ?? { country, cities: [] };
    if (!entry.cities.some((known) => known.slug === city.slug)) entry.cities.push(city);
    countries.set(country.code, entry);
  }
  for (const entry of countries.values()) entry.cities.sort(byName);
  const counts = result.facetCounts.location;
  return {
    value: query.location === undefined ? "" : locationKey(query.location),
    any: {
      value: "",
      label: "Any location",
      change: { kind: "location" },
    },
    countries: [...countries.values()]
      .sort((a, b) => byName(a.country, b.country))
      .map(({ country, cities }) => ({
        label: country.name,
        options: [
          selectOption(
            { kind: "country", code: country.code },
            `All of ${country.name}`,
            query,
            counts,
          ),
          ...cities.map((city) =>
            selectOption({ kind: "city", slug: city.slug }, city.name, query, counts),
          ),
        ],
      })),
  };
}

// What emptying the range asks for: an empty Apply, or removing the range's chip. In the
// location's currency that is no price filter at all: keeping cur would leave other countries at
// 0 with no way to remove it. In a chosen currency the currency stays, with no bounds.
// Whether removing the chosen currency would change anything: the panel's Change currency and
// the "Prices in THB" chip both show only then. When the location's currency is the chosen one,
// the location already limits results to it, so removing the currency would only clear the range.
function canRemoveCurrency(price: PriceFilter | undefined, result: QueryResult): boolean {
  return price !== undefined && price.currency !== result.locationCurrency;
}

function withoutRange(currency: Currency, result: QueryResult): FilterChange {
  return result.locationCurrency === currency
    ? { kind: "currency" }
    : { kind: "currency", currency };
}

function priceView(
  catalogue: Catalogue,
  query: ServiceQuery,
  result: QueryResult,
): PriceFilterView {
  if (result.priceCurrency !== undefined) {
    return {
      kind: "range",
      currency: result.priceCurrency,
      min: query.price?.min?.toFixed() ?? "",
      max: query.price?.max?.toFixed() ?? "",
      // Only when it would change something: without the price filter the customer gets the
      // currency choice, or the location's currency if that is a different one.
      canChangeCurrency: canRemoveCurrency(query.price, result),
      emptyRangeChange: withoutRange(result.priceCurrency, result),
    };
  }
  // Only the currencies the catalogue uses, in the CURRENCIES order.
  const used = new Set(catalogue.providers.map((provider) => provider.currency));
  const currencies = CURRENCIES.filter((currency) => used.has(currency)).map((currency) =>
    option({
      id: `currency-${currency}`,
      label: currency,
      count: result.facetCounts.currency.get(currency) ?? 0,
      isChecked: false,
      change: { kind: "currency", currency },
    }),
  );
  const withResults = currencies.filter((currency) => !currency.isUnavailable).length;
  return {
    kind: "choose-currency",
    note:
      withResults > 1
        ? "These results use more than one currency. Pick one to set a price range."
        : "Pick a currency to set a price range.",
    currencies,
  };
}

function locationName(catalogue: Catalogue, location: Location): string {
  for (const { city, country } of catalogue.providers) {
    if (location.kind === "city" && city.slug === location.slug) return city.name;
    if (location.kind === "country" && country.code === location.code) return country.name;
  }
  // Not reached: the URL codec drops a location that isn't in the catalogue.
  return location.kind === "city" ? location.slug : location.code;
}

// "1,000.00 THB to 5,000.00 THB", "From 1,000.00 THB", "Up to 5,000.00 THB".
function rangeLabel({ currency, min, max }: PriceFilter): string | undefined {
  const minText = min === undefined ? undefined : formatMoney({ amount: min, currency });
  const maxText = max === undefined ? undefined : formatMoney({ amount: max, currency });
  if (minText !== undefined && maxText !== undefined) return `${minText} to ${maxText}`;
  if (minText !== undefined) return `From ${minText}`;
  if (maxText !== undefined) return `Up to ${maxText}`;
  return undefined;
}

// Categories and subcategories carry their parent and type, since titles repeat: there are two
// "Ultrasound" categories and three "Thyroid" subcategories.
function categoryChips(catalogue: Catalogue, query: ServiceQuery): ChipView[] {
  const keys = query.categoryKeys;
  const chips: ChipView[] = [];
  // In the panel's order: by type, then as MedEx lists them.
  for (const type of SERVICE_TYPES) {
    for (const category of catalogue.categories.filter((item) => item.type === type)) {
      const typeLabel = TYPE_LABELS[type];
      if (keys.includes(category.key)) {
        chips.push({
          id: `chip-cat-${category.key}`,
          label: `${category.title} (${typeLabel})`,
          change: { kind: "category", key: category.key },
        });
      }
      for (const sub of category.subcategories.filter((item) => keys.includes(item.key))) {
        chips.push({
          id: `chip-cat-${sub.key}`,
          label: `${category.title}: ${sub.title} (${typeLabel})`,
          change: { kind: "category", key: sub.key },
        });
      }
    }
  }
  if (keys.includes(OTHER_CATEGORY_KEY)) {
    chips.push({
      id: `chip-cat-${OTHER_CATEGORY_KEY}`,
      label: "Other category",
      change: { kind: "category", key: OTHER_CATEGORY_KEY },
    });
  }
  return chips;
}

// One chip per chosen value. Each removes only its own value, with the same change the panel's
// option sends, so a chip and its checkbox can't disagree. Removing the last subcategory chip
// therefore goes back to its whole category, as unticking it does (WBS 3.6).
function chipsOf(catalogue: Catalogue, query: ServiceQuery, result: QueryResult): ChipView[] {
  const chips: ChipView[] = [];
  for (const type of SERVICE_TYPES.filter((item) => query.types.includes(item))) {
    chips.push({
      id: `chip-type-${type}`,
      label: TYPE_LABELS[type],
      change: { kind: "type", type },
    });
  }
  chips.push(...categoryChips(catalogue, query));
  // filter() makes a copy, so sort() doesn't touch the catalogue. Not toSorted(): see mappers.ts.
  const chosenProviders = catalogue.providers
    .filter((item) => query.providerIds.includes(item.id))
    .sort(byName);
  for (const provider of chosenProviders) {
    chips.push({
      id: `chip-provider-${String(provider.id)}`,
      label: provider.name,
      change: { kind: "provider", id: provider.id },
    });
  }
  if (query.location !== undefined) {
    chips.push({
      id: "chip-location",
      label: locationName(catalogue, query.location),
      change: { kind: "location" },
    });
  }
  const { price } = query;
  if (price !== undefined) {
    if (canRemoveCurrency(price, result)) {
      chips.push({
        id: "chip-currency",
        label: `Prices in ${price.currency}`,
        change: { kind: "currency" },
      });
    }
    const range = rangeLabel(price);
    if (range !== undefined) {
      chips.push({ id: "chip-range", label: range, change: withoutRange(price.currency, result) });
    }
  }
  if (query.homeTestOnly) {
    chips.push({
      id: "chip-home-test",
      label: "Home test available",
      change: { kind: "home-test" },
    });
  }
  if (searchTextOf(query.search) !== "") {
    chips.push({
      id: "chip-search",
      label: `“${query.search.trim()}”`,
      // Not a "search" change: the explorer treats those as typing and replaces the history
      // entry, so Back couldn't bring the search back.
      change: { kind: "remove-filter", filter: "search" },
    });
  }
  return chips;
}

const WAY_OUT_LABELS: Record<FilterGroup, string> = {
  search: "Clear the search",
  type: "Remove the service type filter",
  category: "Remove the category filter",
  provider: "Remove the provider filter",
  location: "Remove the location filter",
  price: "Remove the price filter",
  homeTest: "Remove the home test filter",
};

// The empty state's buttons (spec "Rendering and states"): one per filter in use, by how many
// services removing it brings back, most first. A tie keeps the panel's order. One that brings
// back nothing is left out. "Clear all filters" comes last, and only with two filters or more:
// with one, it would do the same as that filter's button. Removal is per filter, not per value:
// "Remove the price filter", as the handoff words it.
function waysOutOf(catalogue: Catalogue, query: ServiceQuery, result: QueryResult): WayOutView[] {
  if (result.serviceCount > 0) return [];
  const countAfter = (change: FilterChange) =>
    countMatches(catalogue, applyFilterChange(query, change, catalogue.categories));

  const groups = activeFilterGroups(query);
  // sort() is stable, so a tie keeps the panel's order.
  const removals: { label: string; change: FilterChange; count: number }[] = groups
    .map((filter) => {
      const change: FilterChange = { kind: "remove-filter", filter };
      return { label: WAY_OUT_LABELS[filter], change, count: countAfter(change) };
    })
    .sort((a, b) => b.count - a.count);
  if (groups.length > 1) {
    const clear: FilterChange = { kind: "clear" };
    removals.push({ label: "Clear all filters", change: clear, count: countAfter(clear) });
  }
  return removals
    .filter(({ count }) => count > 0)
    .map(({ label, change, count }) => ({
      label: `${label} (${countOf(count, "service")})`,
      change,
    }));
}

export function toFiltersView(
  catalogue: Catalogue,
  result: QueryResult,
  query: ServiceQuery,
): FiltersView {
  const { facetCounts } = result;
  const typesInCatalogue = new Set(catalogue.services.map((service) => service.type));
  return {
    types: SERVICE_TYPES.filter((type) => typesInCatalogue.has(type)).map((type) =>
      option({
        id: `type-${type}`,
        label: TYPE_LABELS[type],
        count: facetCounts.type.get(type) ?? 0,
        isChecked: query.types.includes(type),
        change: { kind: "type", type },
      }),
    ),
    categoryGroups: categoryGroups(catalogue, query, result),
    otherCategory: option({
      id: `cat-${OTHER_CATEGORY_KEY}`,
      label: "Other",
      count: facetCounts.category.get(OTHER_CATEGORY_KEY) ?? 0,
      isChecked: query.categoryKeys.includes(OTHER_CATEGORY_KEY),
      change: { kind: "category", key: OTHER_CATEGORY_KEY },
    }),
    providers: providerOptions(catalogue, query, result),
    location: locationView(catalogue, query, result),
    price: priceView(catalogue, query, result),
    homeTest: option({
      id: "home-test",
      label: "Available as a home test",
      count: facetCounts.homeTest,
      isChecked: query.homeTestOnly,
      change: { kind: "home-test" },
    }),
    sort: {
      value: query.sort,
      options: SORT_ORDERS.map((sort) => ({
        value: sort,
        label: SORT_LABELS[sort],
        change: { kind: "sort", sort },
      })),
    },
    search: query.search,
    hasActiveFilters: hasActiveFilters(query),
    chips: chipsOf(catalogue, query, result),
    waysOut: waysOutOf(catalogue, query, result),
  };
}

// The mobile drawer's apply button (T1-11): what the pending filters would find, before they are
// applied. It counts services, like the results heading. At 0 it says what to do instead, and
// the drawer makes it do nothing.
export function showResultsLabel(serviceCount: number): string {
  if (serviceCount === 0) return "No results, change filters";
  return `Show ${countOf(serviceCount, "result")}`;
}

// What the drawer reads out when its pending count settles: a count, not the button's
// "Show 42 results", which would sound like an instruction.
export function pendingCountText(serviceCount: number): string {
  if (serviceCount === 0) return "No results with these filters";
  return `${countOf(serviceCount, "result")} with these filters`;
}

// The provider list's own search box: part of the name, in any case and spacing. It only
// narrows the list on screen; it isn't a filter and isn't in the URL.
export function providersMatchingName(
  providers: FilterOptionView[],
  text: string,
): FilterOptionView[] {
  const wanted = normalizeForSearch(text);
  if (wanted === "") return providers;
  return providers.filter((provider) => normalizeForSearch(provider.label).includes(wanted));
}

// The provider list shows this many before "Show all": with 65 providers the panel would
// otherwise be very long.
export const PROVIDER_PREVIEW_SIZE = 8;

// The short provider list: the first few, plus any ticked further down, so a ticked provider is
// never hidden. keptIds are the ones the customer ticked or unticked in the short list. They
// stay until the list is expanded or collapsed, so unticking one further down doesn't take the
// checkbox away while it has focus.
export function providersInShortList(
  providers: FilterOptionView[],
  keptIds: ReadonlySet<string>,
): FilterOptionView[] {
  return providers.filter(
    (provider, index) =>
      index < PROVIDER_PREVIEW_SIZE || provider.isChecked || keptIds.has(provider.id),
  );
}
