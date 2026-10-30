import type { Currency, Money } from "@/lib/money/money";
import type { ApiCategory, ApiProvider, ApiService } from "./api-types";
import { finalPrice, fixedPrice, fromPrice, shownAmount } from "./pricing";
import {
  OTHER_CATEGORY_KEY,
  type Catalogue,
  type Category,
  type Price,
  type Provider,
  type ProviderRating,
  type Service,
  type Subcategory,
} from "./types";

// API shapes to UI shapes for Task 1 (the anti-corruption layer, ARCHITECTURE.md section 0).
// Raw field names (userId, providerInformation, subCategoryId) stop here.
// Prices and search text are worked out once here, not on every filter change.

// Titles in the data can carry stray spaces (service 0007: "  hba1c   TEST (Diabetes) ").
// Display text is trimmed with single spaces. Case is left alone; search lowercases on its own.
export function tidyText(text: string): string {
  return text.trim().replaceAll(/\s+/g, " ");
}

// Search text for the engine: lowercase, and anything that isn't a letter, a digit or a mark
// becomes a space, so "  hba1c   TEST (Diabetes) " becomes "hba1c test diabetes" and
// "check-up" matches "check up". Marks (\p{M}) are kept because Thai and Devanagari vowel signs
// are part of a word. The engine runs the customer's search through the same function, so both
// sides always agree.
export function normalizeForSearch(text: string): string {
  return tidyText(text.toLowerCase().replaceAll(/[^\p{L}\p{M}\p{N}]+/gu, " "));
}

// Only active items, in MedEx's order (position). Inactive categories and subcategories never
// appear as filter options, and their services are hidden (see mapService).
function activeInOrder<T extends { status: boolean; position: number }>(items: T[]): T[] {
  // A copy sorted with sort(), not toSorted(): toSorted is missing from some browsers Next
  // still supports (Firefox before 115), and this runs on the client too.
  return items.filter((item) => item.status).sort((a, b) => a.position - b.position);
}

// What a service needs from its category or subcategory: the key to filter on and the title to
// search on.
interface CategoryRef {
  key: string;
  title: string;
}

interface CategoryTree {
  categories: Category[];
  categoryById: Map<string, CategoryRef>;
  subcategoryById: Map<string, CategoryRef>;
}

// One pass over the active tree builds both the filter options and the keys services look up,
// so a category can't be an option without its services, or the other way round.
// Keys include the type and the parent, because slugs repeat: see Category in types.ts.
function mapCategoryTree(apiCategories: ApiCategory[]): CategoryTree {
  const tree: CategoryTree = {
    categories: [],
    categoryById: new Map(),
    subcategoryById: new Map(),
  };
  for (const apiCategory of activeInOrder(apiCategories)) {
    const key = `${apiCategory.type}.${apiCategory.slug}`;
    const subcategories: Subcategory[] = [];
    for (const child of activeInOrder(apiCategory.children)) {
      const subcategory = { key: `${key}.${child.slug}`, title: tidyText(child.title) };
      subcategories.push(subcategory);
      tree.subcategoryById.set(child.id, subcategory);
    }
    const title = tidyText(apiCategory.title);
    tree.categories.push({ key, title, type: apiCategory.type, subcategories });
    tree.categoryById.set(apiCategory.id, { key, title });
  }
  return tree;
}

// rating null means no reviews yet (providers 61, 105, 122, 139, 156). That is "new", never 0.
function mapRating(rating: number | null, reviewCount: number): ProviderRating {
  if (rating === null) return { kind: "new" };
  return { kind: "rated", stars: rating, reviewCount };
}

function mapProvider(provider: ApiProvider): Provider {
  const info = provider.providerInformation;
  return {
    id: provider.id,
    name: tidyText(provider.name),
    currency: info.currency,
    city: { slug: info.city.slug, name: info.city.name },
    country: { code: info.country.alphaCode, name: info.country.name },
    rating: mapRating(info.rating, info.reviewCount),
  };
}

// Built from active categories, subcategories and providers only. A service whose provider or
// category is inactive, or missing from the data, finds nothing and is hidden with it.
interface Lookups {
  // A service is priced in its provider's currency and searched by its provider's name.
  activeProviderById: Map<number, Provider>;
  categoryById: Map<string, CategoryRef>;
  subcategoryById: Map<string, CategoryRef>;
}

// Wellness services are priced by their duration options, everything else by its own fields.
// Undefined when a price can't be worked out (a null field, or no options): the price is
// unknown, and unknown is never shown as 0. None in the data today; the audit asserts that.
function mapPrice(service: ApiService, currency: Currency): Price | undefined {
  // An API wellness option already has every field WellnessOption needs, none of them null.
  if (service.type === "wellness") return fromPrice(service.wellnessPricing, currency);

  const { price, discount, discountType, serviceCharge, serviceChargeType } = service;
  if (
    price === null ||
    discount === null ||
    discountType === null ||
    serviceCharge === null ||
    serviceChargeType === null
  ) {
    return undefined;
  }
  return fixedPrice({ price, discount, discountType, serviceCharge, serviceChargeType }, currency);
}

// Every amount the price filter checks (Service.payableAmounts): what the price shows, or for
// wellness, every option's final price, not only the cheapest. fromPrice prices the same options
// to pick the cheapest; if it ever skips an option, skip it here too.
function mapPayableAmounts(service: ApiService, price: Price, currency: Currency): Money[] {
  if (price.kind === "from") {
    return service.wellnessPricing.map((option) => finalPrice(option, currency).final);
  }
  return [shownAmount(price, currency)];
}

// Returns undefined for a service the customer must not see. The visibility rule lives here and
// nowhere else: the service has status true, its provider is active, and its category and
// subcategory (if it has them) are active. A service with no category goes under Other.
// A service with no price we can work out is hidden too (see mapPrice).
function mapService(service: ApiService, lookups: Lookups): Service | undefined {
  const provider = lookups.activeProviderById.get(service.userId);
  if (!service.status || provider === undefined) return undefined;

  // Other has no title to search on.
  const category =
    service.categoryId === null
      ? { key: OTHER_CATEGORY_KEY, title: "" }
      : lookups.categoryById.get(service.categoryId);
  if (category === undefined) return undefined;

  let subcategory: CategoryRef | undefined;
  if (service.subCategoryId !== null) {
    subcategory = lookups.subcategoryById.get(service.subCategoryId);
    if (subcategory === undefined) return undefined;
  }

  const price = mapPrice(service, provider.currency);
  if (price === undefined) return undefined;

  const title = tidyText(service.title);
  return {
    id: service.id,
    title,
    type: service.type,
    providerId: service.userId,
    categoryKey: category.key,
    subcategoryKey: subcategory?.key,
    testAtHome: service.testAtHome,
    price,
    payableAmounts: mapPayableAmounts(service, price, provider.currency),
    search: {
      title: normalizeForSearch(title),
      category: normalizeForSearch(`${category.title} ${subcategory?.title ?? ""}`),
      provider: normalizeForSearch(provider.name),
    },
  };
}

// The one entry point: the three endpoint responses in, everything a customer can see out.
export function mapCatalogue(
  apiCategories: ApiCategory[],
  apiProviders: ApiProvider[],
  apiServices: ApiService[],
): Catalogue {
  const { categories, categoryById, subcategoryById } = mapCategoryTree(apiCategories);
  const providers = apiProviders
    .filter((provider) => provider.status === "active")
    .map((provider) => mapProvider(provider));
  const lookups: Lookups = {
    activeProviderById: new Map(providers.map((provider) => [provider.id, provider])),
    categoryById,
    subcategoryById,
  };

  const services: Service[] = [];
  for (const apiService of apiServices) {
    const mapped = mapService(apiService, lookups);
    if (mapped !== undefined) services.push(mapped);
  }

  // A provider with nothing to show is left out, like a service type no service has. Provider 163
  // is active with no services in the data; kept, it would sit in the filter at 0 for good.
  const providerIdsWithServices = new Set(services.map((service) => service.providerId));
  const providersWithServices = providers.filter((provider) =>
    providerIdsWithServices.has(provider.id),
  );

  return { categories, providers: providersWithServices, services };
}
