import Link from "next/link";
import { Button } from "@/components/ui/button";
import type { PaginationView, ResultsView } from "../results-view";
import { ProviderGroupCard } from "./provider-group-card";

// The results list: count heading, provider cards (in currency sections for a price sort),
// pagination. No hooks and no state: the server's first view and the client's views both
// render through this, from a ResultsView.

function Pagination({ pagination }: Readonly<{ pagination: PaginationView }>) {
  return (
    <nav aria-label="Pagination" className="flex flex-col items-center gap-2 pt-4">
      <p className="text-sm text-text-secondary">{pagination.label}</p>
      <ul className="flex flex-wrap items-center justify-center gap-1.5">
        <li>
          {pagination.previousHref ? (
            <Button asChild variant="outline">
              <Link href={pagination.previousHref}>Previous</Link>
            </Button>
          ) : (
            // Not a link on the first page, so there is nothing to tab to that goes nowhere.
            <span className="inline-flex h-11 items-center px-4 text-sm text-muted-foreground">
              Previous
            </span>
          )}
        </li>
        {pagination.pages.map((page) => (
          <li key={page.number}>
            <Button asChild variant={page.isCurrent ? "default" : "outline"} size="icon">
              <Link
                href={page.href}
                aria-current={page.isCurrent ? "page" : undefined}
                aria-label={`Page ${String(page.number)}`}
              >
                {page.number}
              </Link>
            </Button>
          </li>
        ))}
        <li>
          {pagination.nextHref ? (
            <Button asChild variant="outline">
              <Link href={pagination.nextHref}>Next</Link>
            </Button>
          ) : (
            <span className="inline-flex h-11 items-center px-4 text-sm text-muted-foreground">
              Next
            </span>
          )}
        </li>
      </ul>
    </nav>
  );
}

// isCompareEnabled and onCompareToggle go to each card's Compare box (WBS 3.10).
export function ServiceResults({
  view,
  isCompareEnabled,
  onCompareToggle,
}: Readonly<{
  view: ResultsView;
  isCompareEnabled: boolean;
  onCompareToggle: (providerId: number) => void;
}>) {
  return (
    <>
      <h2 className="text-xl font-semibold tabular-nums">{view.countText}</h2>
      {view.sectionNote && <p className="text-sm text-text-secondary">{view.sectionNote}</p>}
      {view.sections.map((section) => (
        // A page has at most one section per currency, so the heading is a unique key.
        // Without a heading there is only one section.
        <div key={section.heading ?? "all"} className="flex flex-col gap-4">
          {section.heading && (
            <h3 className="border-b pb-1.5 text-sm font-semibold text-text-secondary">
              {section.heading}
            </h3>
          )}
          <ul className="flex flex-col gap-4">
            {section.groups.map((group) => (
              <li key={group.providerId}>
                <ProviderGroupCard
                  group={group}
                  headingLevel={section.heading ? 4 : 3}
                  isCompareEnabled={isCompareEnabled}
                  onCompareToggle={onCompareToggle}
                />
              </li>
            ))}
          </ul>
        </div>
      ))}
      {view.pagination && <Pagination pagination={view.pagination} />}
    </>
  );
}
