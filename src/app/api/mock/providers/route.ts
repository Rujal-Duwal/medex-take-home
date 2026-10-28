import { applyMockLatencyAndFailure } from "@/lib/mock/latency-and-failure";
import { task1Data } from "@/lib/mock/task1-data";

// GET /api/mock/providers, flag name "providers". Inactive providers included; the mapper hides them.
export async function GET(request: Request): Promise<Response> {
  const fake = await applyMockLatencyAndFailure(request);
  if (fake) return fake;
  return Response.json(task1Data.providers);
}
