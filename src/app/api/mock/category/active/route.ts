import { applyMockLatencyAndFailure } from "@/lib/mock/latency-and-failure";
import { task1Data } from "@/lib/mock/task1-data";

// GET /api/mock/category/active, flag name "categories".
// Top-level categories with their subcategories nested. Despite the name, inactive categories
// are included, as in the data MedEx gave us; the mapper hides them (spec Decisions).
export async function GET(request: Request): Promise<Response> {
  const fake = await applyMockLatencyAndFailure(request);
  if (fake) return fake;
  return Response.json(task1Data.categories);
}
