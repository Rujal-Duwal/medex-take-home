"use client";

import Link from "next/link";
import { Dialog } from "radix-ui";
import { useMemo, useRef, useState } from "react";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { useAnnounce } from "@/lib/a11y/live-announcer";
import {
  canRestore,
  PICK_ANOTHER_HINT,
  removeCompared,
  restoreCompared,
  toCompareView,
  type ComparedProviderView,
  type RemovedProvider,
} from "../compare";
import type { ChipView } from "../filters-view";
import type { Catalogue } from "../types";
import type { ServicesUrlState } from "../url-codec";
import { ProviderRating } from "./provider-group-card";

// The comparison (T1-16, HANDOFF "Compare tray and comparison"). A Radix Dialog, which follows
// the APG modal dialog pattern (https://www.w3.org/WAI/ARIA/apg/patterns/dialog-modal/): Tab
// stays inside, Esc closes it. CompareTray holds the Dialog.Root and the "Compare (N)" button
// that opens it, so on close Radix puts focus back on that button.
//
// The grid is a real <table>: provider names are column headers, row labels are row headers,
// so a screen reader reads "Price range, Chao Phraya Hospital, 1,800.00 THB to 2,500.00 THB".
// The handoff draws a swipeable carousel on phones; here the table scrolls sideways with the
// row labels pinned, which needs no carousel library (spec Decisions).

export interface CompareLoaded {
  catalogue: Catalogue;
  urlState: ServicesUrlState;
  // The filter chips above the results, for the "With your filters" line.
  chips: ChipView[];
}

// Changes the compare list in the URL. The explorer applies it to the address bar's list.
export type CompareUpdate = (update: (ids: number[]) => number[]) => void;

function LowestBadge({ label }: Readonly<{ label: string }>) {
  return (
    <span className="inline-flex items-center gap-1 self-start rounded-md bg-success-soft px-2 py-0.5 text-xs font-semibold text-success">
      <svg
        aria-hidden="true"
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        strokeWidth="3"
        strokeLinecap="round"
        strokeLinejoin="round"
        className="size-3"
      >
        <path d="M20 6 9 17l-5-5" />
      </svg>
      {label}
    </span>
  );
}

const cellClass = "px-4 py-3 align-top";

// One detail: its label as the row header, then one cell per provider (children).
function CompareRow({
  label,
  children,
}: Readonly<{ label: React.ReactNode; children: React.ReactNode }>) {
  return (
    <tr className="border-b last:border-b-0">
      {/* Pinned on the left, so a phone that scrolls the table sideways keeps the labels. */}
      <th
        scope="row"
        className="sticky left-0 w-28 bg-card px-4 py-3 sm:w-44 text-left align-top text-sm font-semibold text-text-secondary"
      >
        {label}
      </th>
      {children}
    </tr>
  );
}

function PriceRangeCell({ item }: Readonly<{ item: ComparedProviderView }>) {
  return (
    <td className={cellClass}>
      <span className="flex flex-col gap-1">
        {item.priceRange === undefined ? (
          <span className="text-text-secondary">None with your filters</span>
        ) : (
          <strong className="font-semibold tabular-nums">{item.priceRange}</strong>
        )}{" "}
        {item.lowestLabel && <LowestBadge label={item.lowestLabel} />}
      </span>
    </td>
  );
}

function CompareTable({
  title,
  providers,
  onRemove,
  onClose,
}: Readonly<{
  title: string;
  providers: ComparedProviderView[];
  onRemove: (provider: ComparedProviderView) => void;
  onClose: () => void;
}>) {
  return (
    // Scrolls sideways on a phone. A scrolling area must be reachable by keyboard so it can be
    // scrolled with the arrow keys (axe "scrollable-region-focusable"), hence tabIndex 0 and a
    // name.
    <section
      aria-label="Comparison table"
      // eslint-disable-next-line jsx-a11y/no-noninteractive-tabindex -- a scrolling area must take focus to scroll by keyboard
      tabIndex={0}
      // shrink-0: as a flex item with overflow it would shrink to the dialog's height and
      // scroll up and down on its own, hiding the last rows; the dialog's body scrolls instead.
      className="shrink-0 overflow-x-auto rounded-xl border bg-card"
    >
      {/* Each provider column is at least 12rem wide, so on a phone the next column peeks in
          beside the first and shows there is more to scroll to. */}
      <table className="w-full border-collapse text-left text-base">
        <caption className="sr-only">{title}</caption>
        <thead>
          <tr className="border-b">
            <td className="sticky left-0 bg-card" />
            {providers.map((item) => (
              <th
                key={item.providerId}
                scope="col"
                className="min-w-48 px-4 pt-4 pb-1 text-lg font-semibold"
              >
                {item.name}
              </th>
            ))}
          </tr>
          {/* The Remove buttons sit in a row of their own, outside the column headers, so a
              column's name stays the provider's name, not "... Remove ...". */}
          <tr className="border-b">
            <td className="sticky left-0 bg-card" />
            {providers.map((item) => (
              <td key={item.providerId} className="px-2 pb-2">
                <Button
                  type="button"
                  variant="ghost"
                  aria-label={`Remove ${item.name} from the comparison`}
                  onClick={() => {
                    onRemove(item);
                  }}
                >
                  Remove
                </Button>
              </td>
            ))}
          </tr>
        </thead>
        <tbody>
          <CompareRow label="Rating">
            {providers.map((item) => (
              <td key={item.providerId} className={cellClass}>
                <ProviderRating rating={item.rating} />
              </td>
            ))}
          </CompareRow>
          <CompareRow label="Location">
            {providers.map((item) => (
              <td key={item.providerId} className={cellClass}>
                {item.place}
              </td>
            ))}
          </CompareRow>
          <CompareRow label="Matching services">
            {providers.map((item) => (
              <td key={item.providerId} className={`${cellClass} tabular-nums`}>
                {item.matchingText}
              </td>
            ))}
          </CompareRow>
          <CompareRow
            label={
              <span className="flex flex-col">
                Price range <span className="font-normal">of matching services</span>
              </span>
            }
          >
            {providers.map((item) => (
              <PriceRangeCell key={item.providerId} item={item} />
            ))}
          </CompareRow>
          <CompareRow label="Home test available">
            {providers.map((item) => (
              <td key={item.providerId} className={cellClass}>
                {item.homeTestText}
              </td>
            ))}
          </CompareRow>
          <CompareRow label="View services">
            {providers.map((item) => (
              <td key={item.providerId} className={cellClass}>
                {/* Closes the comparison and shows that provider's matching services. Not
                    wrapped in Dialog.Close, which would give the link type="button". */}
                <Link
                  href={item.viewServicesHref}
                  aria-label={`View services at ${item.name}`}
                  className="inline-flex min-h-11 items-center font-medium text-primary underline-offset-4 hover:underline"
                  onClick={onClose}
                >
                  View services
                </Link>
              </td>
            ))}
          </CompareRow>
        </tbody>
      </table>
    </section>
  );
}

// The dialog's content, mounted only while it is open, so the comparison is worked out only
// then, and a removal's Undo is gone once it closes.
function CompareBody({
  loaded,
  headingRef,
  onCompareChange,
  onClose,
}: Readonly<{
  loaded: CompareLoaded;
  headingRef: React.RefObject<HTMLHeadingElement | null>;
  onCompareChange: CompareUpdate;
  onClose: () => void;
}>) {
  const announce = useAnnounce();
  const { catalogue, urlState, chips } = loaded;
  const view = useMemo(
    () => toCompareView(catalogue, urlState, chips),
    [catalogue, urlState, chips],
  );
  // The provider just removed, for the status line and Undo.
  const [removed, setRemoved] = useState<{ undo: RemovedProvider; name: string }>();
  const shownIds = view.providers.map((provider) => provider.providerId);

  // HANDOFF: focus moves to the heading, the status line says who was removed, with Undo.
  // With 1 left, "Pick at least one more to compare" is read out too. Removing the last one
  // empties the list, which closes the comparison (CompareTray).
  function handleRemove(item: ComparedProviderView) {
    const { ids, undo } = removeCompared(shownIds, item.providerId);
    onCompareChange((current) => removeCompared(current, item.providerId).ids);
    if (ids.length === 0) return;
    setRemoved({ undo, name: item.name });
    const message = `${item.name} was removed from the comparison.`;
    announce(ids.length === 1 ? `${message} ${PICK_ANOTHER_HINT}.` : message);
    headingRef.current?.focus();
  }

  function handleUndo() {
    if (removed === undefined) return;
    const { undo } = removed;
    onCompareChange((current) => restoreCompared(current, undo));
    setRemoved(undefined);
    // The Undo button goes; the heading now names one more provider.
    headingRef.current?.focus();
  }

  return (
    <>
      <div className="flex items-start justify-between gap-3 border-b bg-card px-4 py-3 sm:px-6">
        <div className="flex flex-col gap-1">
          {/* tabIndex -1: focus is moved here on open and after a removal (HANDOFF). */}
          <Dialog.Title ref={headingRef} tabIndex={-1} className="text-2xl font-semibold">
            {view.title}
          </Dialog.Title>
          <Dialog.Description className="text-sm text-text-secondary">
            {view.filtersText}
          </Dialog.Description>
        </div>
        <Dialog.Close asChild>
          <Button type="button" variant="outline">
            Back to results
          </Button>
        </Dialog.Close>
      </div>
      <div className="flex flex-1 flex-col gap-4 overflow-y-auto overscroll-contain px-4 py-5 sm:px-6">
        {removed && (
          <div className="flex flex-wrap items-center justify-between gap-2 rounded-xl bg-secondary px-4 py-2 text-secondary-foreground">
            <p>{removed.name} was removed from the comparison.</p>
            {/* Only while Undo would work: Back or Forward can bring the provider back, or
                fill the list, while the comparison is open. */}
            {canRestore(shownIds, removed.undo) && (
              <Button type="button" variant="link" className="px-2 underline" onClick={handleUndo}>
                Undo
              </Button>
            )}
          </div>
        )}
        {view.providers.length === 1 && (
          <Alert variant="info">
            <AlertTitle>{PICK_ANOTHER_HINT}</AlertTitle>
            <AlertDescription>
              Go back to results and tick “Compare” on another provider card.
            </AlertDescription>
          </Alert>
        )}
        {view.hasMixedCurrencies && (
          <Alert variant="warning">
            <AlertDescription>
              <strong className="font-semibold">
                Prices are in each provider&apos;s own currency. We don&apos;t convert between them.
              </strong>{" "}
              “Lowest price” is only marked between providers that use the same currency.
            </AlertDescription>
          </Alert>
        )}
        <CompareTable
          title={view.title}
          providers={view.providers}
          onRemove={handleRemove}
          onClose={onClose}
        />
      </div>
    </>
  );
}

// Rendered inside CompareTray's Dialog.Root. onCloseAutoFocus lets the tray send focus to the
// results when it is gone, instead of to its button.
export function CompareDialog({
  loaded,
  onCompareChange,
  onClose,
  onCloseAutoFocus,
}: Readonly<{
  loaded: CompareLoaded;
  onCompareChange: CompareUpdate;
  onClose: () => void;
  onCloseAutoFocus: (event: Event) => void;
}>) {
  const headingRef = useRef<HTMLHeadingElement>(null);
  return (
    <Dialog.Portal>
      <Dialog.Overlay className="fixed inset-0 z-50 bg-foreground/40" />
      {/* Full screen on a phone, a large dialog from the small breakpoint up. Focus goes to the
          heading, not the first button, so the comparison is heard from the top. */}
      <Dialog.Content
        className="fixed inset-0 z-50 flex flex-col bg-background sm:inset-x-6 sm:inset-y-8 sm:mx-auto sm:max-w-5xl sm:overflow-hidden sm:rounded-xl sm:border"
        onOpenAutoFocus={(event) => {
          event.preventDefault();
          headingRef.current?.focus();
        }}
        onCloseAutoFocus={onCloseAutoFocus}
      >
        <CompareBody
          loaded={loaded}
          headingRef={headingRef}
          onCompareChange={onCompareChange}
          onClose={onClose}
        />
      </Dialog.Content>
    </Dialog.Portal>
  );
}
