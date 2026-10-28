import type { ApiCategory, ApiProvider, ApiService } from "@/features/services/api-types";
import task1 from "../../../data/task1-service-explorer.json" with { type: "json" };

// The Task 1 data, as MedEx's API would send it. Server only: the three mock endpoints serve it,
// and the /services page reads it for its first render. Never import this from a client
// component, or the whole 2 MB file ships to the browser.
//
// Nothing is filtered here. The data keeps inactive categories, providers and services, like
// the API does; mapCatalogue (features/services/mappers.ts) is the one place that hides them.

// The same cast as scripts/audit-data.ts, safe for the same reason: the audit's "values match
// the API types" checks hold for this file.
export const task1Data = task1 as {
  categories: ApiCategory[];
  providers: ApiProvider[];
  services: ApiService[];
};
