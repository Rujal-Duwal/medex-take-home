"use client";

import { Checkbox } from "@/components/ui/checkbox";
import { cn } from "@/lib/utils";
import type { FilterChange } from "../filter-changes";
import type { FilterOptionView } from "../filters-view";

// One filter option: checkbox, label, count (HANDOFF "FilterOption"). The label holds the
// count, so a screen reader hears "Package 124". The count sits in a fixed-width slot with
// tabular figures, so a changing count doesn't move anything.
// An unavailable option (D5, 0 results) is muted and marked aria-disabled, not disabled: it
// stays focusable, so it isn't skipped and focus isn't lost when a tick makes it unavailable.
// Its clicks are ignored here.
export function FilterOption({
  option,
  onChange,
}: Readonly<{ option: FilterOptionView; onChange: (change: FilterChange) => void }>) {
  return (
    <div className="flex min-h-11 items-center gap-3">
      <Checkbox
        id={option.id}
        checked={option.isMixed ? "indeterminate" : option.isChecked}
        aria-disabled={option.isUnavailable || undefined}
        onCheckedChange={() => {
          if (!option.isUnavailable) onChange(option.change);
        }}
      />
      <label
        htmlFor={option.id}
        className={cn(
          "flex flex-1 items-baseline justify-between gap-3 py-1 text-base",
          option.isUnavailable ? "cursor-not-allowed text-muted-foreground" : "cursor-pointer",
        )}
      >
        <span className="flex flex-col">
          <span>{option.label}</span>{" "}
          {option.detail && <span className="text-sm text-text-secondary">{option.detail}</span>}
        </span>
        {/* The spaces keep the accessible name apart ("Package 124", not "Package124"). A flex
            container doesn't draw them. */}{" "}
        <span className="min-w-[5ch] text-right text-sm text-text-secondary tabular-nums">
          {option.count}
        </span>
      </label>
    </div>
  );
}
