import { compareMoney, formatMoney, type Currency, type Money } from "@/lib/money/money";
import { runQuery } from "./engine";
import type { ChipView } from "./filters-view";
import { shownAmount } from "./pricing";
import { countOf, placeOf, ratingView, type RatingView } from "./results-view";
import type { Catalogue, Price, Provider } from "./types";
import {
  isCompareFull,
  MAX_COMPARED_PROVIDERS,
  servicesHref,
  type ServicesUrlState,
} from "./url-codec";

// Compare up to 3 providers side by side (T1-16, spec "Compare", WBS 3.10). The selection lives
// in the URL (compare=48,61), so these rules work on a list of provider ids, and the explorer
// writes the list back with the codec. What the tray and the comparison show is worked out here
// as plain strings, like ResultsView, so the components stay markup.

// Ticking a card's Compare box. A 4th provider is never added: the card shows "You can compare
// up to 3" and its box does nothing, but the rule lives here too.
export function toggleCompared(ids: number[], providerId: number): number[] {
  if (ids.includes(providerId)) return ids.filter((id) => id !== providerId);
  if (isCompareFull(ids)) return ids;
  return [...ids, providerId];
}

// What Undo needs to put a removed provider back where it was.
export interface RemovedProvider {
  providerId: number;
  index: number;
}

// Removing a provider inside the comparison, which offers Undo.
export function removeCompared(
  ids: number[],
  providerId: number,
): { ids: number[]; undo: RemovedProvider } {
  return {
    ids: ids.filter((id) => id !== providerId),
    undo: { providerId, index: ids.indexOf(providerId) },
  };
}

// Whether Undo can still put the provider back. The list may have changed since (Back or
// Forward while the comparison is open): not if the provider is back already or there is no
// room. The comparison only offers Undo while this holds.
export function canRestore(ids: number[], removed: RemovedProvider): boolean {
  return !ids.includes(removed.providerId) && !isCompareFull(ids);
}

// Undo: back in its old column, or at the end if the list is now shorter than its old place.
// Does nothing when canRestore says no.
export function restoreCompared(ids: number[], removed: RemovedProvider): number[] {
  if (!canRestore(ids, removed)) return ids;
  const restored = [...ids];
  restored.splice(removed.index, 0, removed.providerId);
  return restored;
}

export interface CompareTrayView {
  providers: { providerId: number; name: string }[];
  // "Compare (2)"
  compareLabel: string;
  // 1 picked: "Pick at least one more to compare". 3 picked: "You can compare up to 3".
  hint?: string;
}

export const COMPARE_LIMIT_HINT = `You can compare up to ${String(MAX_COMPARED_PROVIDERS)}`;
export const PICK_ANOTHER_HINT = "Pick at least one more to compare";

// The providers in the order they were picked, which is the URL's order and the columns' order.
function comparedProviders(catalogue: Catalogue, ids: number[]): Provider[] {
  const providers: Provider[] = [];
  for (const id of ids) {
    const provider = catalogue.providers.find((item) => item.id === id);
    if (provider !== undefined) providers.push(provider);
  }
  return providers;
}

// The tray at the bottom of the results. The server page builds it too, so a link with
// compare= shows the tray in the first HTML.
export function toCompareTrayView(catalogue: Catalogue, ids: number[]): CompareTrayView {
  const providers = comparedProviders(catalogue, ids);
  let hint: string | undefined;
  if (providers.length === 1) hint = PICK_ANOTHER_HINT;
  if (isCompareFull(ids)) hint = COMPARE_LIMIT_HINT;
  return {
    providers: providers.map((provider) => ({ providerId: provider.id, name: provider.name })),
    compareLabel: `Compare (${String(providers.length)})`,
    hint,
  };
}

// One column of the comparison.
export interface ComparedProviderView {
  providerId: number;
  name: string;
  rating: RatingView;
  place: string;
  // "12 services", or "None with your filters".
  matchingText: string;
  // "1,800.00 THB to 5,970.60 THB". Undefined when nothing matches.
  priceRange?: string;
  // "Lowest price", or "Lowest price in THB" when the comparison mixes currencies.
  lowestLabel?: string;
  // "Yes, 2 services" or "No".
  homeTestText: string;
  viewServicesHref: string;
}

export interface CompareView {
  // "Compare 3 providers"
  title: string;
  // "With your filters: Package, Bangkok", or "With no filters applied".
  filtersText: string;
  // Shows the note that prices stay in each provider's currency.
  hasMixedCurrencies: boolean;
  providers: ComparedProviderView[];
}

// The cheapest and dearest of one provider's matching services, by the price each card shows
// (a wellness service at its "From" price), so the range agrees with the results list.
interface PriceRange {
  low: { price: Price; amount: Money };
  high: { price: Price; amount: Money };
}

function priceRangeOf(prices: Price[], currency: Currency): PriceRange | undefined {
  let range: PriceRange | undefined;
  for (const price of prices) {
    const end = { price, amount: shownAmount(price, currency) };
    if (range === undefined) range = { low: end, high: end };
    else if (compareMoney(end.amount, range.low.amount) < 0) range.low = end;
    else if (compareMoney(end.amount, range.high.amount) > 0) range.high = end;
  }
  return range;
}

// A free service shows "Free", never "0.00 THB" (design system, display rules).
function rangeEndText(end: PriceRange["low"]): string {
  return end.price.kind === "free" ? "Free" : formatMoney(end.amount);
}

function priceRangeText(range: PriceRange): string {
  if (compareMoney(range.low.amount, range.high.amount) === 0) return rangeEndText(range.low);
  return `${rangeEndText(range.low)} to ${rangeEndText(range.high)}`;
}

// The providers with the lowest starting price among priced providers in one currency. A tie
// gives each of them. With fewer than two there is nothing to be lowest against.
function lowestInOneCurrency(priced: { providerId: number; low: Money }[]): number[] {
  const [first, ...rest] = priced;
  if (first === undefined || rest.length === 0) return [];
  let cheapest = first.low;
  for (const { low } of rest) if (compareMoney(low, cheapest) < 0) cheapest = low;
  return priced
    .filter(({ low }) => compareMoney(low, cheapest) === 0)
    .map(({ providerId }) => providerId);
}

// "Lowest price" is only marked between providers that share a currency (spec "Compare"): a
// THB price can't be lower than an NPR one without an exchange rate. A provider with nothing
// matching has no price, so it takes no part.
function lowestProviderIds(ranges: { provider: Provider; range?: PriceRange }[]): Set<number> {
  const lowest = new Set<number>();
  const currencies = new Set(ranges.map(({ provider }) => provider.currency));
  for (const currency of currencies) {
    const priced: { providerId: number; low: Money }[] = [];
    for (const { provider, range } of ranges) {
      if (provider.currency === currency && range !== undefined) {
        priced.push({ providerId: provider.id, low: range.low.amount });
      }
    }
    for (const providerId of lowestInOneCurrency(priced)) lowest.add(providerId);
  }
  return lowest;
}

// With one currency "Lowest price" is clear; with several it says which currency it is lowest in.
function lowestLabel(currency: Currency, hasMixedCurrencies: boolean): string {
  return hasMixedCurrencies ? `Lowest price in ${currency}` : "Lowest price";
}

// The comparison, under the filters in the URL.
// The provider filter is left out: the compared providers are the provider choice here. With
// provider=48 in the URL, a second compared provider would otherwise always show nothing.
// chips are the filters panel's chips (FiltersView), so the "With your filters" line names the
// filters the same way as the row above the results.
export function toCompareView(
  catalogue: Catalogue,
  state: ServicesUrlState,
  chips: ChipView[],
): CompareView {
  const providers = comparedProviders(catalogue, state.compareProviderIds);
  const ids = providers.map((provider) => provider.id);
  // The engine with only the compared providers, every group open so none is cut at 3. At most
  // 3 groups, so they all fit on page 1.
  const result = runQuery(catalogue, {
    ...state.query,
    providerIds: ids,
    openProviderIds: ids,
    page: 1,
  });

  const ranges = providers.map((provider) => {
    const group = result.groups.find((item) => item.provider.id === provider.id);
    const services = group?.services ?? [];
    return {
      provider,
      services,
      range: priceRangeOf(
        services.map((service) => service.price),
        provider.currency,
      ),
    };
  });
  const lowest = lowestProviderIds(ranges);
  const hasMixedCurrencies = new Set(providers.map((provider) => provider.currency)).size > 1;

  const filterLabels = chips
    .filter((chip) => chip.change.kind !== "provider")
    .map((chip) => chip.label);

  return {
    title: `Compare ${countOf(providers.length, "provider")}`,
    filtersText:
      filterLabels.length > 0
        ? `With your filters: ${filterLabels.join(", ")}`
        : "With no filters applied",
    hasMixedCurrencies,
    providers: ranges.map(({ provider, services, range }) => {
      const homeTests = services.filter((service) => service.testAtHome).length;
      return {
        providerId: provider.id,
        name: provider.name,
        rating: ratingView(provider.rating),
        place: placeOf(provider),
        matchingText:
          services.length > 0 ? countOf(services.length, "service") : "None with your filters",
        priceRange: range && priceRangeText(range),
        lowestLabel: lowest.has(provider.id)
          ? lowestLabel(provider.currency, hasMixedCurrencies)
          : undefined,
        homeTestText: homeTests > 0 ? `Yes, ${countOf(homeTests, "service")}` : "No",
        // That provider's services under the same filters, opened in place (D10), so the list
        // shows every service this column counted. The compare selection stays.
        viewServicesHref: servicesHref({
          ...state,
          query: {
            ...state.query,
            providerIds: [provider.id],
            openProviderIds: [provider.id],
            page: 1,
          },
        }),
      };
    }),
  };
}
