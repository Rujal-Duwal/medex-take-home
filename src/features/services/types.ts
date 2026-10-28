import type { Currency, Money } from "@/lib/money/money";

// UI shapes for Task 1. mappers.ts builds these from the API types; components and the engine
// only ever see these.

export type ServiceType = "package" | "lab_test" | "wellness" | "service" | "insurance";

// Category keys always include the type, because slugs repeat across types:
// "package.ultrasound" and "lab_test.ultrasound" are different categories, and
// "package.ultrasound.thyroid" is not "lab_test.blood-tests.thyroid".
// Services with no category use OTHER_CATEGORY_KEY.
export const OTHER_CATEGORY_KEY = "other";

export interface Subcategory {
  key: string;
  title: string;
}

export interface Category {
  key: string;
  title: string;
  type: ServiceType;
  // In the order MedEx gives (position), so the panel can show them as they are.
  subcategories: Subcategory[];
}

// A provider with no rating yet is "new", not rated 0, so it can't be sorted or shown as 0 stars.
export type ProviderRating =
  { kind: "rated"; stars: number; reviewCount: number } | { kind: "new" };

export interface Provider {
  id: number;
  name: string;
  currency: Currency;
  city: { slug: string; name: string };
  // ISO 3166 alpha-2 code, for example "TH". Used in the URL as loc=country:TH.
  country: { code: string; name: string };
  rating: ProviderRating;
}

// What a customer pays, worked out once when mapping (pricing.ts). The kinds keep "free" and
// "from" apart from a real amount, so a component can't show 0 by mistake.
// original is the price without the discount, struck through on screen. It is only set when a
// discount applies, and it includes the service charge, like final.
export type Price =
  | { kind: "fixed"; final: Money; original?: Money }
  // Wellness: the cheapest duration option. The real price is unknown until one is chosen.
  | { kind: "from"; lowest: Money; durationInMinutes: number; original?: Money }
  | { kind: "free" };

export interface Service {
  id: string;
  title: string;
  type: ServiceType;
  providerId: number;
  categoryKey: string;
  // Undefined when the service sits directly in its category, or in Other.
  subcategoryKey?: string;
  testAtHome: boolean;
  price: Price;
}

// Everything a customer can see. Hidden categories, providers and services are already gone.
export interface Catalogue {
  categories: Category[];
  providers: Provider[];
  services: Service[];
}
