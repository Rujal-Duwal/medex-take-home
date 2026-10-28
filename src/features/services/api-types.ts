import type { Currency } from "@/lib/money/money";

// Shapes returned by the Task 1 mock endpoints. Field names mirror MedEx's API exactly, so
// these types stop at mappers.ts: components never see them.
// Where the data only ever holds a few values (service type, discount type, currency), the
// type lists them, so a typo in a comparison fails the type check.

export type ApiServiceType = "package" | "lab_test" | "wellness" | "service" | "insurance";

export type ApiAdjustmentType = "percent" | "amount";

// GET /api/mock/category/active returns top-level categories with their children nested.
// Despite the endpoint name, inactive categories are included (status false).
export interface ApiSubcategory {
  id: string;
  title: string;
  slug: string;
  type: ApiServiceType;
  position: number;
  status: boolean;
  parentId: string;
}

export interface ApiCategory {
  id: string;
  title: string;
  slug: string;
  type: ApiServiceType;
  position: number;
  status: boolean;
  parentId: null;
  children: ApiSubcategory[];
}

// GET /api/mock/providers
export interface ApiCity {
  id: string;
  name: string;
  slug: string;
}

export interface ApiCountry {
  id: number;
  name: string;
  alphaCode: string;
}

export interface ApiProviderInformation {
  companyName: string;
  slug: string;
  types: ApiServiceType[];
  currency: Currency;
  city: ApiCity;
  country: ApiCountry;
  rating: number | null;
  reviewCount: number;
}

export interface ApiProvider {
  id: number;
  name: string;
  username: string;
  status: "active" | "inactive";
  providerInformation: ApiProviderInformation;
}

// GET /api/mock/service
// Amounts are decimal strings ("6200.00"). Wellness services have price fields set to null and
// their prices in wellnessPricing, one option per duration.
export interface ApiWellnessOption {
  id: string;
  durationInMinutes: number;
  price: string;
  discount: string;
  discountType: ApiAdjustmentType;
  serviceCharge: string;
  serviceChargeType: ApiAdjustmentType;
}

export interface ApiService {
  id: string;
  title: string;
  slug: string;
  type: ApiServiceType;
  // The provider's id. The API calls it userId.
  userId: number;
  categoryId: string | null;
  subCategoryId: string | null;
  price: string | null;
  discount: string | null;
  discountType: ApiAdjustmentType | null;
  serviceCharge: string | null;
  serviceChargeType: ApiAdjustmentType | null;
  status: boolean;
  testAtHome: boolean;
  homeTestCharge: string | null;
  wellnessPricing: ApiWellnessOption[];
  createdAt: string;
}
