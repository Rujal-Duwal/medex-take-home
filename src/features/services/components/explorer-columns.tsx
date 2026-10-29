import type { ReactNode } from "react";

// The /services columns: the filter panel, then the results beside it on large screens and
// below it on small ones (the drawer replaces that in WBS 3.8). Shared by the explorer and
// loading.tsx, so the results start in the same place while the page loads.
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
