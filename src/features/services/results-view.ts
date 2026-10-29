import { formatMoney } from "@/lib/money/money";
import {
  GROUP_PREVIEW_SIZE,
  type ProviderGroup,
  type QueryResult,
  type ServiceQuery,
} from "./engine";
import type { Price, Provider, ProviderRating, Service, ServiceType } from "./types";
import { isCompareFull, servicesHref, type ServicesUrlState } from "./url-codec";

// What the results list shows, worked out from the engine's result: every text and link as a
// plain string. It exists for two reasons:
// - The server page and the client render the same ServiceResults from it. It holds only
//   strings, numbers and booleans, so the server can pass it to the client component as a prop
//   (Big amounts and Maps can't cross that boundary), and the client's first render is exactly
//   the server's HTML: no hydration mismatch.
// - The display rules (plurals, "From", "Free", currency sections, links) live and are tested
//   here, so the components stay plain markup.

export type PriceView =
  | { kind: "fixed"; final: string; original?: string }
  | { kind: "from"; lowest: string; duration: string; original?: string }
  | { kind: "free" };

export interface ServiceView {
  id: string;
  title: string;
  typeLabel: string;
  price: PriceView;
}

export type RatingView = { kind: "rated"; stars: string; reviews: string } | { kind: "new" };

// "View all 14 services" on a closed group, "Show fewer" on an open one (D10).
export interface GroupToggleView {
  label: string;
  href: string;
}

// The card's "Compare" box (WBS 3.10). isFull: 3 other providers are chosen, so this one can't
// be added ("You can compare up to 3").
export interface GroupCompareView {
  isChosen: boolean;
  isFull: boolean;
}

export interface ProviderGroupView {
  providerId: number;
  name: string;
  place: string;
  rating: RatingView;
  services: ServiceView[];
  // Undefined when every matching service already shows.
  toggle?: GroupToggleView;
  compare: GroupCompareView;
}

export interface ResultsSectionView {
  // "Prices in THB" when a price sort splits the page by currency (D8), otherwise undefined.
  heading?: string;
  groups: ProviderGroupView[];
}

export interface PaginationView {
  label: string;
  previousHref?: string;
  nextHref?: string;
  pages: { number: number; href: string; isCurrent: boolean }[];
}

export interface ResultsView {
  countText: string;
  // What the live region reads out when it changes: the count, plus the page when there are
  // several ("124 services from 18 providers, page 2 of 3"), so a page change is heard too.
  announcement: string;
  // Explains the currency sections. Only set when there are sections.
  sectionNote?: string;
  sections: ResultsSectionView[];
  // Undefined with a single page.
  pagination?: PaginationView;
}

// Also the service type options' labels in the filter panel (filters-view.ts).
export const TYPE_LABELS: Record<ServiceType, string> = {
  package: "Package",
  lab_test: "Lab test",
  wellness: "Wellness",
  service: "Service",
  insurance: "Insurance",
};

// en-US grouping for counts, the same as for prices: "2,853". The filter panel's counts use
// this too.
const wholeNumber = new Intl.NumberFormat("en-US");

export function formatCount(count: number): string {
  return wholeNumber.format(count);
}

// "1 service", "124 services". The empty state's ways out use it too (filters-view.ts).
export function countOf(count: number, noun: string): string {
  const word = count === 1 ? noun : `${noun}s`;
  return `${formatCount(count)} ${word}`;
}

// How long a count must stay the same before it is read out. Typing "thyroid" changes the count
// on most letters, and a count per letter would talk over the letters a screen reader echoes.
// The results count and the drawer's pending count both wait this long.
export const ANNOUNCE_DELAY_MS = 500;

// Shown as the results heading and read out by the live region: "124 services from 18 providers".
export function resultCountText(serviceCount: number, providerCount: number): string {
  if (serviceCount === 0) return "No services match your filters";
  return `${countOf(serviceCount, "service")} from ${countOf(providerCount, "provider")}`;
}

// Links stay on /services and change only the URL, through the codec, like the filters.
function changedHref(state: ServicesUrlState, changes: Partial<ServiceQuery>): string {
  return servicesHref({ ...state, query: { ...state.query, ...changes } });
}

function priceView(price: Price): PriceView {
  if (price.kind === "free") return { kind: "free" };
  const original = price.original && formatMoney(price.original);
  if (price.kind === "from") {
    return {
      kind: "from",
      lowest: formatMoney(price.lowest),
      duration: `${String(price.durationInMinutes)} min`,
      original,
    };
  }
  return { kind: "fixed", final: formatMoney(price.final), original };
}

// The compare view shows the rating and place the same way (compare.ts).
export function ratingView(rating: ProviderRating): RatingView {
  if (rating.kind === "new") return { kind: "new" };
  return {
    kind: "rated",
    stars: rating.stars.toFixed(1),
    reviews: countOf(rating.reviewCount, "review"),
  };
}

// "Bangkok, Thailand"
export function placeOf(provider: Provider): string {
  return `${provider.city.name}, ${provider.country.name}`;
}

function serviceView(service: Service): ServiceView {
  return {
    id: service.id,
    title: service.title,
    typeLabel: TYPE_LABELS[service.type],
    price: priceView(service.price),
  };
}

// The link opens or closes this group and keeps everything else, including the page shown
// (result.page, which may differ from the URL's page past the end).
function groupToggle(
  group: ProviderGroup,
  state: ServicesUrlState,
  page: number,
): GroupToggleView | undefined {
  // With 3 or fewer matches the group always shows them all, open or not: no link.
  if (group.matchingCount <= GROUP_PREVIEW_SIZE) return undefined;
  const providerId = group.provider.id;
  const openIds = state.query.openProviderIds;
  if (group.isOpen) {
    return {
      label: "Show fewer",
      href: changedHref(state, {
        page,
        openProviderIds: openIds.filter((id) => id !== providerId),
      }),
    };
  }
  return {
    label: `View all ${countOf(group.matchingCount, "service")}`,
    href: changedHref(state, { page, openProviderIds: [...openIds, providerId] }),
  };
}

function groupView(group: ProviderGroup, state: ServicesUrlState, page: number): ProviderGroupView {
  const { provider } = group;
  const isChosen = state.compareProviderIds.includes(provider.id);
  return {
    providerId: provider.id,
    name: provider.name,
    place: placeOf(provider),
    rating: ratingView(provider.rating),
    services: group.services.map((service) => serviceView(service)),
    toggle: groupToggle(group, state, page),
    compare: {
      isChosen,
      isFull: !isChosen && isCompareFull(state.compareProviderIds),
    },
  };
}

// D8: a price sort with no currency chosen sorts each currency on its own. The engine already
// orders groups by currency; this starts a new section where the currency changes. With a
// currency chosen (or implied by the location) there is one currency, so no headings.
function sectionsOf(result: QueryResult, state: ServicesUrlState): ResultsSectionView[] {
  if (result.groups.length === 0) return [];
  const isPriceSort = state.query.sort === "price-asc" || state.query.sort === "price-desc";
  const byCurrency = isPriceSort && result.priceCurrency === undefined;

  const sections: ResultsSectionView[] = [];
  for (const group of result.groups) {
    const view = groupView(group, state, result.page);
    const heading = byCurrency ? `Prices in ${group.provider.currency}` : undefined;
    const current = sections.at(-1);
    if (current !== undefined && current.heading === heading) current.groups.push(view);
    else sections.push({ heading, groups: [view] });
  }
  return sections;
}

function paginationOf(result: QueryResult, state: ServicesUrlState): PaginationView | undefined {
  const { page, pageCount } = result;
  if (pageCount <= 1) return undefined;
  return {
    label: `Page ${String(page)} of ${String(pageCount)}`,
    previousHref: page > 1 ? changedHref(state, { page: page - 1 }) : undefined,
    nextHref: page < pageCount ? changedHref(state, { page: page + 1 }) : undefined,
    pages: Array.from({ length: pageCount }, (_, index) => ({
      number: index + 1,
      href: changedHref(state, { page: index + 1 }),
      isCurrent: index + 1 === page,
    })),
  };
}

// state is the parsed URL the result was run from: links are built from it.
export function toResultsView(result: QueryResult, state: ServicesUrlState): ResultsView {
  const sections = sectionsOf(result, state);
  const hasHeadings = sections.some(({ heading }) => heading !== undefined);
  const countText = resultCountText(result.serviceCount, result.providerCount);
  const pagination = paginationOf(result, state);
  return {
    countText,
    announcement:
      pagination === undefined
        ? countText
        : `${countText}, page ${String(result.page)} of ${String(result.pageCount)}`,
    sectionNote: hasHeadings
      ? "Sorted by price within each currency. We don't convert between currencies."
      : undefined,
    sections,
    pagination,
  };
}
