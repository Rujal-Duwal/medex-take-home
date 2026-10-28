import type { Currency } from "@/lib/money/money";
import type { ApiCategory, ApiProvider, ApiService } from "./api-types";
import { fixedPrice, fromPrice } from "./pricing";
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
// Prices are worked out once here (pricing.ts); the search text is added in WBS 3.3.

// Titles in the data can carry stray spaces (service 0007: "  hba1c   TEST (Diabetes) ").
// Display text is trimmed with single spaces. Case is left alone; search lowercases on its own.
export function tidyText(text: string): string {
  return text.trim().replaceAll(/\s+/g, " ");
}

// Only active items, in MedEx's order (position). Inactive categories and subcategories never
// appear as filter options, and their services are hidden (see mapService).
function activeInOrder<T extends { status: boolean; position: number }>(items: T[]): T[] {
  // A copy sorted with sort(), not toSorted(): toSorted is missing from some browsers Next
  // still supports (Firefox before 115), and this runs on the client too.
  return items.filter((item) => item.status).sort((a, b) => a.position - b.position);
}

interface CategoryTree {
  categories: Category[];
  categoryKeyById: Map<string, string>;
  subcategoryKeyById: Map<string, string>;
}

// One pass over the active tree builds both the filter options and the keys services look up,
// so a category can't be an option without its services, or the other way round.
// Keys include the type and the parent, because slugs repeat: see Category in types.ts.
function mapCategoryTree(apiCategories: ApiCategory[]): CategoryTree {
  const tree: CategoryTree = {
    categories: [],
    categoryKeyById: new Map(),
    subcategoryKeyById: new Map(),
  };
  for (const apiCategory of activeInOrder(apiCategories)) {
    const key = `${apiCategory.type}.${apiCategory.slug}`;
    const subcategories: Subcategory[] = [];
    for (const child of activeInOrder(apiCategory.children)) {
      const childKey = `${key}.${child.slug}`;
      subcategories.push({ key: childKey, title: tidyText(child.title) });
      tree.subcategoryKeyById.set(child.id, childKey);
    }
    tree.categories.push({
      key,
      title: tidyText(apiCategory.title),
      type: apiCategory.type,
      subcategories,
    });
    tree.categoryKeyById.set(apiCategory.id, key);
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
  // A service is priced in its provider's currency.
  currencyByActiveProviderId: Map<number, Currency>;
  categoryKeyById: Map<string, string>;
  subcategoryKeyById: Map<string, string>;
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

// Returns undefined for a service the customer must not see. The visibility rule lives here and
// nowhere else: the service has status true, its provider is active, and its category and
// subcategory (if it has them) are active. A service with no category goes under Other.
// A service with no price we can work out is hidden too (see mapPrice).
function mapService(service: ApiService, lookups: Lookups): Service | undefined {
  const currency = lookups.currencyByActiveProviderId.get(service.userId);
  if (!service.status || currency === undefined) return undefined;

  const categoryKey =
    service.categoryId === null
      ? OTHER_CATEGORY_KEY
      : lookups.categoryKeyById.get(service.categoryId);
  if (categoryKey === undefined) return undefined;

  let subcategoryKey: string | undefined;
  if (service.subCategoryId !== null) {
    subcategoryKey = lookups.subcategoryKeyById.get(service.subCategoryId);
    if (subcategoryKey === undefined) return undefined;
  }

  const price = mapPrice(service, currency);
  if (price === undefined) return undefined;

  return {
    id: service.id,
    title: tidyText(service.title),
    type: service.type,
    providerId: service.userId,
    categoryKey,
    subcategoryKey,
    testAtHome: service.testAtHome,
    price,
  };
}

// The one entry point: the three endpoint responses in, everything a customer can see out.
export function mapCatalogue(
  apiCategories: ApiCategory[],
  apiProviders: ApiProvider[],
  apiServices: ApiService[],
): Catalogue {
  const { categories, categoryKeyById, subcategoryKeyById } = mapCategoryTree(apiCategories);
  const providers = apiProviders
    .filter((provider) => provider.status === "active")
    .map((provider) => mapProvider(provider));
  const lookups: Lookups = {
    currencyByActiveProviderId: new Map(
      providers.map((provider) => [provider.id, provider.currency]),
    ),
    categoryKeyById,
    subcategoryKeyById,
  };

  const services: Service[] = [];
  for (const apiService of apiServices) {
    const mapped = mapService(apiService, lookups);
    if (mapped !== undefined) services.push(mapped);
  }

  return { categories, providers, services };
}
