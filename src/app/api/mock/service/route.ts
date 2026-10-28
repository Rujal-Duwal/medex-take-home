import { applyMockLatencyAndFailure } from "@/lib/mock/latency-and-failure";
import { task1Data } from "@/lib/mock/task1-data";

// GET /api/mock/service, flag name "services". All 3,200 services, hidden ones included; the
// mapper hides them. The whole list goes to the browser so the engine can count facets there
// (ADR 0006).
export async function GET(request: Request): Promise<Response> {
  const fake = await applyMockLatencyAndFailure(request);
  if (fake) return fake;
  return Response.json(task1Data.services);
}
