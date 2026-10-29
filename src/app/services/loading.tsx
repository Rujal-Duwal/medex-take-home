import { ExplorerColumns } from "@/features/services/components/explorer-columns";
import { FiltersSkeleton } from "@/features/services/components/filters-skeleton";
import { Skeleton } from "@/components/ui/skeleton";
import { ResultsSkeleton } from "@/features/services/components/results-skeleton";

// Shown while the server prepares the first view of /services. That is instant unless the URL
// has ?mockDelay, which is how a reviewer sees the loading state. layout.tsx draws the heading.
export default function ServicesLoading() {
  return (
    <ExplorerColumns filters={<FiltersSkeleton />}>
      {/* Where the sort select goes, so the results don't move down when the page arrives. */}
      <Skeleton className="h-11 w-56 self-end" />
      <section aria-label="Results" aria-busy="true" className="flex flex-col gap-4">
        <ResultsSkeleton />
      </section>
    </ExplorerColumns>
  );
}
