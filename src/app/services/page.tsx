import type { Metadata } from "next";
import { runQuery } from "@/features/services/engine";
import { mapCatalogue } from "@/features/services/mappers";
import { toResultsView } from "@/features/services/results-view";
import type { Catalogue } from "@/features/services/types";
import { parseServicesUrl, searchParamsFromRecord } from "@/features/services/url-codec";
import { ServiceExplorer } from "@/features/services/components/service-explorer";
import { applyMockDelayToPage } from "@/lib/mock/latency-and-failure";
import { task1Data } from "@/lib/mock/task1-data";

export const metadata: Metadata = { title: "Services" };

// Mapped once per server instance, not once per request: the data doesn't change while the
// server runs.
let catalogue: Catalogue | undefined;
function serverCatalogue(): Catalogue {
  catalogue ??= mapCatalogue(task1Data.categories, task1Data.providers, task1Data.services);
  return catalogue;
}

// Server-first render (T1-10): the first page of results for this URL, from the same codec and
// engine the client uses, so a filtered link never flashes an unfiltered list. The data is read
// directly here, not through the mock API, like a real server calling MedEx's API internally.
// ServiceExplorer takes over on the client; it explains the hand-over.
// While this waits (only with ?mockDelay), loading.tsx shows the skeleton.
export default async function ServicesPage({ searchParams }: Readonly<PageProps<"/services">>) {
  const params = searchParamsFromRecord(await searchParams);
  await applyMockDelayToPage(params);

  const urlState = parseServicesUrl(params, serverCatalogue());
  const serverView = toResultsView(runQuery(serverCatalogue(), urlState.query), urlState);

  // layout.tsx draws the page heading around this.
  return <ServiceExplorer serverView={serverView} />;
}
