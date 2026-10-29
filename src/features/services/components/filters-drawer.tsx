"use client";

import { Dialog } from "radix-ui";
import { useEffect, useMemo, useRef, useState } from "react";
import { Button } from "@/components/ui/button";
import { useAnnounce } from "@/lib/a11y/live-announcer";
import { runQuery, type ServiceQuery } from "../engine";
import { applyFilterChange, clearDrawerFilters, type FilterChange } from "../filter-changes";
import { pendingCountText, showResultsLabel, toFiltersView } from "../filters-view";
import { ANNOUNCE_DELAY_MS } from "../results-view";
import type { Catalogue } from "../types";
import { FilterFields } from "./filter-panel";

// The mobile filters drawer (T1-11, spec "Filter panel and drawer", HANDOFF "Mobile filters
// drawer"). A Radix Dialog, which follows the APG modal dialog pattern
// (https://www.w3.org/WAI/ARIA/apg/patterns/dialog-modal/): Tab stays inside, Esc closes it,
// and on close focus goes back to the Filters button.
//
// The drawer edits a draft: a copy of the query, not the URL. The same engine runs on the copy,
// so the options show their counts and the footer button says how many results Apply would
// show. Only "Show N results" hands the copy to the explorer, which writes the URL once. Esc
// or the close button throws the draft away.

// The drawer's content, mounted while it is open. Radix unmounts it on close, so the draft
// starts from the URL's query each time it opens and is gone when it closes.
function DrawerBody({
  catalogue,
  urlQuery,
  onApply,
}: Readonly<{
  catalogue: Catalogue;
  urlQuery: ServiceQuery;
  onApply: (query: ServiceQuery) => void;
}>) {
  const announce = useAnnounce();
  // The starting value only: later URL changes don't reach the draft.
  const [draft, setDraft] = useState(urlQuery);

  const { filters, serviceCount } = useMemo(() => {
    const result = runQuery(catalogue, draft);
    return {
      filters: toFiltersView(catalogue, result, draft),
      serviceCount: result.serviceCount,
    };
  }, [catalogue, draft]);
  const canApply = serviceCount > 0;

  // The draft's count is read out once it settles, the same way as the results count in
  // ServiceExplorer. The rest of the page is hidden from screen readers while the drawer is
  // open, but Radix leaves the live region out of that, so it still speaks. Not on opening:
  // nothing has changed yet.
  const countText = pendingCountText(serviceCount);
  const lastAnnounced = useRef(countText);
  useEffect(() => {
    if (countText === lastAnnounced.current) return;
    const timer = setTimeout(() => {
      lastAnnounced.current = countText;
      announce(countText);
    }, ANNOUNCE_DELAY_MS);
    return () => {
      clearTimeout(timer);
    };
  }, [countText, announce]);

  function handleChange(change: FilterChange) {
    setDraft((current) => applyFilterChange(current, change, catalogue.categories));
  }

  return (
    <>
      {/* The options scroll; the header and footer stay put. */}
      <div className="flex flex-1 flex-col gap-6 overflow-y-auto overscroll-contain px-4 py-5">
        <FilterFields view={filters} onChange={handleChange} />
      </div>
      <div className="flex items-center gap-3 border-t bg-card px-4 pt-3 pb-4">
        <Button
          type="button"
          variant="link"
          size="lg"
          className="px-3"
          onClick={() => {
            setDraft((current) => clearDrawerFilters(current, catalogue.categories));
          }}
        >
          Clear
        </Button>
        {/* aria-disabled, not disabled, at 0: it stays focusable, so its label ("No results,
            change filters") can still be heard, and focus isn't dropped when it changes. */}
        <Button
          type="button"
          size="lg"
          className="flex-1"
          aria-disabled={!canApply || undefined}
          onClick={() => {
            if (canApply) onApply(draft);
          }}
        >
          {showResultsLabel(serviceCount)}
        </Button>
      </div>
    </>
  );
}

export function FiltersDrawer({
  label,
  loaded,
  isOpen,
  onOpenChange,
  onApply,
}: Readonly<{
  // "Filters" or "Filters (3)", with the number of chips.
  label: string;
  // The catalogue and the URL's query, once the client has loaded the catalogue. Until then
  // the button is disabled, like the panel.
  loaded: { catalogue: Catalogue; urlQuery: ServiceQuery } | undefined;
  isOpen: boolean;
  onOpenChange: (isOpen: boolean) => void;
  onApply: (query: ServiceQuery) => void;
}>) {
  const headingRef = useRef<HTMLHeadingElement>(null);
  return (
    <Dialog.Root open={isOpen} onOpenChange={onOpenChange}>
      <Dialog.Trigger asChild>
        <Button
          type="button"
          variant="outline"
          className="flex-1 lg:hidden"
          disabled={loaded === undefined}
        >
          <svg
            aria-hidden="true"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
            strokeLinecap="round"
          >
            <path d="M4 6h16M7 12h10M10 18h4" />
          </svg>
          {label}
        </Button>
      </Dialog.Trigger>
      <Dialog.Portal>
        {/* Not seen behind the full-screen content, but Radix locks the page's scroll in the
            overlay, so without it the page behind would scroll. */}
        <Dialog.Overlay className="fixed inset-0 z-50" />
        {/* aria-describedby is left out: the content is a form, not a sentence to read out
            (APG). Focus goes to the heading, not the first checkbox, so the drawer is heard
            from the top. */}
        <Dialog.Content
          aria-describedby={undefined}
          className="fixed inset-0 z-50 flex flex-col bg-background"
          onOpenAutoFocus={(event) => {
            event.preventDefault();
            headingRef.current?.focus();
          }}
        >
          <div className="flex h-14 items-center justify-between gap-2 border-b bg-card pr-1 pl-4">
            <Dialog.Title ref={headingRef} tabIndex={-1} className="text-lg font-semibold">
              Filters
            </Dialog.Title>
            <Dialog.Close asChild>
              <Button type="button" variant="ghost" size="icon" aria-label="Close filters">
                <svg
                  aria-hidden="true"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="2"
                  strokeLinecap="round"
                >
                  <path d="M18 6 6 18M6 6l12 12" />
                </svg>
              </Button>
            </Dialog.Close>
          </div>
          {loaded !== undefined && (
            <DrawerBody catalogue={loaded.catalogue} urlQuery={loaded.urlQuery} onApply={onApply} />
          )}
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  );
}
