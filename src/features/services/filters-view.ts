import { CURRENCIES, type Currency } from "@/lib/money/money";
import {
  locationKey,
  SORT_ORDERS,
  type Location,
  type QueryResult,
  type ServiceQuery,
  type SortOrder,
} from "./engine";
import { hasActiveFilters, type FilterChange } from "./filter-changes";
import { normalizeForSearch } from "./mappers";
import { formatCount, TYPE_LABELS } from "./results-view";
import {
  OTHER_CATEGORY_KEY,
  SERVICE_TYPES,
  type Catalogue,
  type Category,
  type Provider,
} from "./types";

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
      // currency choice, or the location's currency if that is a different one. When the
      // location's currency is the chosen one, Change would only clear the range.
      canChangeCurrency:
        query.price !== undefined && result.locationCurrency !== query.price.currency,
      emptyRangeChange:
        result.locationCurrency === result.priceCurrency
          ? { kind: "currency" }
          : { kind: "currency", currency: result.priceCurrency },
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
  };
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
