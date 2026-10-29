"use client";

import { Dialog } from "radix-ui";
import { useLayoutEffect, useRef, useState } from "react";
import { Button } from "@/components/ui/button";
import { removeCompared, type CompareTrayView } from "../compare";
import { CompareDialog, type CompareLoaded, type CompareUpdate } from "./compare-dialog";

// The compare tray at the bottom of the window (HANDOFF "CompareTray"): a chip per chosen
// provider, Clear, and "Compare (N)", which opens the comparison. Shows nothing with no
// provider chosen, but stays mounted, so its focus rules and the dialog survive the last
// provider going.
//
// Focus, so it is never dropped onto the page:
// - after a chip is removed: the chip now in its place, or Clear if it was the last chip
// - after Clear, or the last chip: the tray goes, so onTrayGone moves focus to the results
// - closing the comparison: back to "Compare (N)" (Radix), or to the results when that button
//   is gone (the last provider was removed inside it, or Back emptied the list)
export function CompareTray({
  tray,
  loaded,
  onCompareChange,
  onTrayGone,
}: Readonly<{
  tray: CompareTrayView;
  // Until the client has the catalogue the buttons are disabled, like the filter panel.
  loaded: CompareLoaded | undefined;
  onCompareChange: CompareUpdate;
  onTrayGone: () => void;
}>) {
  const [isOpen, setIsOpen] = useState(false);
  const clearRef = useRef<HTMLButtonElement>(null);
  const compareRef = useRef<HTMLButtonElement>(null);
  const isEnabled = loaded !== undefined;
  const { providers } = tray;

  // The chip just removed and its place. The new list arrives a moment later (the explorer
  // re-renders from the URL), so focus moves once it is in, as in ActiveFilters.
  const removedChip = useRef<{ providerId: number; index: number }>(undefined);
  useLayoutEffect(() => {
    if (removedChip.current === undefined) return;
    const { providerId, index } = removedChip.current;
    if (providers.some((item) => item.providerId === providerId)) return;
    removedChip.current = undefined;
    const next = providers[index];
    if (next !== undefined) document.getElementById(chipId(next.providerId))?.focus();
    else if (providers.length > 0) clearRef.current?.focus();
    else onTrayGone();
  }, [providers, onTrayGone]);

  // An empty list closes the comparison, however it emptied: its last Remove, or Back. Without
  // this, Forward would bring the providers back and reopen it unasked. Set during render, as
  // React advises for state that follows a prop
  // (https://react.dev/learn/you-might-not-need-an-effect#adjusting-some-state-when-a-prop-changes).
  if (isOpen && providers.length === 0) setIsOpen(false);

  return (
    <Dialog.Root open={isOpen && providers.length > 0} onOpenChange={setIsOpen}>
      {providers.length > 0 && (
        <section
          aria-label="Compare tray"
          className="flex flex-col gap-2 border-t bg-card px-4 py-3 shadow-tray sm:flex-row sm:flex-wrap sm:items-center sm:gap-x-4 sm:px-6"
        >
          {/* On a phone the chips stay on one line and scroll sideways, so the tray doesn't
              cover the results; a focused chip scrolls into view. The padding keeps the focus
              ring inside the scrolling area, which would clip it. From the small breakpoint
              up they wrap. */}
          <ul
            aria-label="Providers to compare"
            className="-m-1 flex items-center gap-2 overflow-x-auto p-1 sm:flex-wrap sm:overflow-visible"
          >
            {providers.map((item, index) => (
              <li key={item.providerId} className="shrink-0">
                <Button
                  id={chipId(item.providerId)}
                  type="button"
                  variant="secondary"
                  className="rounded-full pr-3"
                  aria-label={`Remove ${item.name} from compare`}
                  disabled={!isEnabled}
                  onClick={() => {
                    removedChip.current = { providerId: item.providerId, index };
                    onCompareChange((ids) => removeCompared(ids, item.providerId).ids);
                  }}
                >
                  {item.name}
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
          </ul>
          <div className="flex flex-1 items-center gap-2">
            {tray.hint && <p className="text-sm text-text-secondary">{tray.hint}</p>}
            <div className="ml-auto flex items-center gap-2">
              <Button
                ref={clearRef}
                type="button"
                variant="link"
                className="px-2 text-foreground underline"
                disabled={!isEnabled}
                onClick={() => {
                  onCompareChange(() => []);
                  onTrayGone();
                }}
              >
                Clear
              </Button>
              <Dialog.Trigger asChild>
                <Button ref={compareRef} type="button" size="lg" disabled={!isEnabled}>
                  {tray.compareLabel}
                </Button>
              </Dialog.Trigger>
            </div>
          </div>
        </section>
      )}
      {loaded && (
        <CompareDialog
          loaded={loaded}
          onCompareChange={onCompareChange}
          onClose={() => {
            setIsOpen(false);
          }}
          // Radix puts focus back on "Compare (N)". When the tray has gone, that button is
          // gone too (React clears its ref), so focus goes to the results instead.
          onCloseAutoFocus={(event) => {
            if (compareRef.current !== null) return;
            event.preventDefault();
            onTrayGone();
          }}
        />
      )}
    </Dialog.Root>
  );
}

function chipId(providerId: number): string {
  return `compare-chip-${String(providerId)}`;
}
