import { Skeleton } from "@/components/ui/skeleton";

// Stands in for the filter panel while the first view loads: same box and width as
// FilterPanel, a search box and a few option rows. Hidden on small screens, like the panel.
// Hidden from screen readers (see Skeleton); the results skeleton beside it says "Loading
// services" once.
const ROWS = ["first", "second", "third", "fourth", "fifth"];

export function FiltersSkeleton() {
  return (
    <div className="hidden flex-col gap-4 rounded-xl border bg-card px-5 pt-4 pb-5 lg:flex lg:w-76 lg:flex-none">
      <Skeleton className="h-6 w-24" />
      <Skeleton className="h-11 w-full" />
      {ROWS.map((row) => (
        <Skeleton key={row} className="h-6 w-full" />
      ))}
    </div>
  );
}
