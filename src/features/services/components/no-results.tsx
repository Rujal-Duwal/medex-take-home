import { EmptyState } from "@/components/states/empty-state";
import { Button } from "@/components/ui/button";
import type { FilterChange } from "../filter-changes";
import type { WayOutView } from "../filters-view";

// The empty state (T1-13): no services match, so it offers to remove a filter, the one that
// brings back the most first (filters-view.ts orders them). The first button is the main one.
// The chips above the results name each value; these buttons name each filter.
// A click removes the buttons, so onWayOut moves focus to the results.
export function NoResults({
  waysOut,
  isEnabled,
  onChange,
  onWayOut,
}: Readonly<{
  waysOut: WayOutView[];
  isEnabled: boolean;
  onChange: (change: FilterChange) => void;
  onWayOut: () => void;
}>) {
  // No filters and still nothing: the catalogue is empty. Not in the data, but it shouldn't
  // speak of filters the customer doesn't have.
  if (waysOut.length === 0) {
    return (
      <EmptyState
        title="No services to show"
        description="There are no services to show right now. Please check back later."
      />
    );
  }

  return (
    <EmptyState
      title="No services match"
      description="Try removing a filter. Your other choices will stay as they are."
      action={
        <div className="flex flex-wrap gap-2">
          {waysOut.map((way, index) => (
            <Button
              key={way.label}
              type="button"
              variant={index === 0 ? "default" : "outline"}
              // Long labels wrap on a phone instead of running off the card.
              className="h-auto min-h-11 py-2 text-left whitespace-normal"
              disabled={!isEnabled}
              onClick={() => {
                onChange(way.change);
                onWayOut();
              }}
            >
              {way.label}
            </Button>
          ))}
        </div>
      }
    />
  );
}
