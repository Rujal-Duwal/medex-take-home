import type { ReactNode } from "react";

// The /services columns: the filter panel beside the results on large screens. On small screens
// the panel is hidden and the results take the width; the Filters button and drawer stand in
// for it (WBS 3.8). Shared by the explorer and loading.tsx, so the results start in the same
// place while the page loads.
export function ExplorerColumns({
  filters,
  children,
}: Readonly<{ filters: ReactNode; children: ReactNode }>) {
  return (
    <div className="flex flex-col gap-8 lg:flex-row lg:items-start">
      {filters}
      <div className="flex min-w-0 flex-1 flex-col gap-4">{children}</div>
    </div>
  );
}
