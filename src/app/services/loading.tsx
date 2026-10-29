import { ExplorerColumns } from "@/features/services/components/explorer-columns";
import { FiltersSkeleton } from "@/features/services/components/filters-skeleton";
import { Skeleton } from "@/components/ui/skeleton";
import { ResultsSkeleton } from "@/features/services/components/results-skeleton";

// Shown while the server prepares the first view of /services. That is instant unless the URL
// has ?mockDelay, which is how a reviewer sees the loading state. layout.tsx draws the heading.
export default function ServicesLoading() {
  return (
    <ExplorerColumns filters={<FiltersSkeleton />}>
      {/* Where the explorer's controls go, so the results don't move down when the page
          arrives: on small screens the search box, then the Filters button beside the sort. */}
      <div className="flex flex-col gap-2 lg:hidden">
        <Skeleton className="h-6 w-16" />
        <Skeleton className="h-11 w-full" />
      </div>
      <div className="flex gap-3 lg:justify-end">
        <Skeleton className="h-11 flex-1 lg:hidden" />
        <Skeleton className="h-11 w-56" />
      </div>
      <section aria-label="Results" aria-busy="true" className="flex flex-col gap-4">
        <ResultsSkeleton />
      </section>
    </ExplorerColumns>
  );
}
