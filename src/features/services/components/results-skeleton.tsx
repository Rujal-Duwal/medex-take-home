import { Skeleton } from "@/components/ui/skeleton";

// Stands in for the results while they load: the count heading and three provider cards, each
// with three service rows, the same sizes as the real ones. The blocks are hidden from screen
// readers (see Skeleton); the one line of sr-only text says what is happening. The container
// that shows this sets aria-busy.
const CARDS = ["first", "second", "third"];
const ROWS = ["first", "second", "third"];

export function ResultsSkeleton() {
  return (
    <>
      <p className="sr-only">Loading services</p>
      <Skeleton className="h-7 w-64" />
      {CARDS.map((card) => (
        <div key={card} className="flex flex-col gap-3 rounded-xl border bg-card p-4">
          <Skeleton className="h-7 w-72 max-w-full" />
          <Skeleton className="h-5 w-40" />
          {ROWS.map((row) => (
            <div key={row} className="flex items-center justify-between gap-6 py-2">
              <Skeleton className="h-6 w-2/3" />
              <Skeleton className="h-6 w-28" />
            </div>
          ))}
        </div>
      ))}
    </>
  );
}
