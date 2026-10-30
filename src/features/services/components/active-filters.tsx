"use client";

import { useLayoutEffect, useRef } from "react";
import { Button } from "@/components/ui/button";
import type { FilterChange } from "../filter-changes";
import type { ChipView } from "../filters-view";

// The chosen filters above the results, each a button that removes it, then "Clear all filters"
// (HANDOFF "Active filters"). Shows nothing without filters. The handoff's label is "Clear all";
// "filters" tells it apart from the panel's Clear all, which moves focus somewhere else.
//
// Focus (HANDOFF section 5): after a chip is removed it goes to the next chip, which now sits
// where the removed one was, or to "Clear all filters" if it was the last chip. With no chips
// left the row goes, so onFiltersGone moves focus to the results. Clear all calls it at once.
export function ActiveFilters({
  chips,
  isEnabled,
  onChange,
  onFiltersGone,
}: Readonly<{
  chips: ChipView[];
  isEnabled: boolean;
  onChange: (change: FilterChange) => void;
  onFiltersGone: () => void;
}>) {
  const clearAllRef = useRef<HTMLButtonElement>(null);
  // The chip just removed and its place. The new chips arrive a moment later (the explorer
  // re-renders from the URL), so focus is moved once they are in, before paint. While the
  // removed chip is still in the list, the new chips haven't arrived yet, so it waits.
  const removed = useRef<{ id: string; index: number }>(undefined);
  useLayoutEffect(() => {
    if (removed.current === undefined) return;
    const { id, index } = removed.current;
    if (chips.some((chip) => chip.id === id)) return;
    removed.current = undefined;
    const next = chips[index];
    if (next !== undefined) document.getElementById(next.id)?.focus();
    else if (chips.length > 0) clearAllRef.current?.focus();
    else onFiltersGone();
  }, [chips, onFiltersGone]);

  if (chips.length === 0) return null;

  return (
    <ul aria-label="Active filters" className="flex flex-wrap items-center gap-2">
      {chips.map((chip, index) => (
        <li key={chip.id}>
          <Button
            id={chip.id}
            type="button"
            variant="secondary"
            className="rounded-full pr-3"
            aria-label={`Remove filter: ${chip.label}`}
            disabled={!isEnabled}
            onClick={() => {
              removed.current = { id: chip.id, index };
              onChange(chip.change);
            }}
          >
            {chip.label}
            <svg
              aria-hidden="true"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2.25"
              strokeLinecap="round"
            >
              <path d="M18 6 6 18M6 6l12 12" />
            </svg>
          </Button>
        </li>
      ))}
      <li>
        <Button
          ref={clearAllRef}
          type="button"
          variant="link"
          className="px-2 text-foreground underline"
          disabled={!isEnabled}
          onClick={() => {
            onChange({ kind: "clear" });
            onFiltersGone();
          }}
        >
          Clear all filters
        </Button>
      </li>
    </ul>
  );
}
