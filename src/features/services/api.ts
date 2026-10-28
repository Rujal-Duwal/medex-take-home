import { fetchApi, type ApiResult } from "@/lib/api/fetch-api";
import type { ApiCategory, ApiProvider, ApiService } from "./api-types";
import { mapCatalogue } from "./mappers";
import type { Catalogue } from "./types";

// Loads the three Task 1 endpoints at once and maps them into the one Catalogue the engine reads.
// Every endpoint is needed (a service without its provider or category can't be shown), so if
// any of them fails the whole load fails, with the first failure's kind. With ?mockOffline=1
// all three report offline, so that is the kind that comes back.
export async function loadCatalogue(): Promise<ApiResult<Catalogue>> {
  const [categories, providers, services] = await Promise.all([
    fetchApi<ApiCategory[]>("/api/mock/category/active", { endpoint: "categories" }),
    fetchApi<ApiProvider[]>("/api/mock/providers", { endpoint: "providers" }),
    fetchApi<ApiService[]>("/api/mock/service", { endpoint: "services" }),
  ]);
  if (categories.kind !== "ok") return categories;
  if (providers.kind !== "ok") return providers;
  if (services.kind !== "ok") return services;
  return { kind: "ok", data: mapCatalogue(categories.data, providers.data, services.data) };
}
