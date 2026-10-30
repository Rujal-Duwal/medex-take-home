import Link from "next/link";
import { useEffect, useRef } from "react";
import { Checkbox } from "@/components/ui/checkbox";
import { cn } from "@/lib/utils";
import { COMPARE_LIMIT_HINT } from "../compare";
import { GROUP_PREVIEW_SIZE } from "../engine";
import type { ProviderGroupView, RatingView } from "../results-view";
import { PriceTag } from "./price-tag";

// The compare view shows ratings the same way.
export function ProviderRating({ rating }: Readonly<{ rating: RatingView }>) {
  if (rating.kind === "new") {
    return (
      <span className="self-start rounded-full bg-muted px-2.5 py-1 text-sm font-medium">
        New, no reviews yet
      </span>
    );
  }
  // The star is decoration; screen readers hear "Rated 4.7 out of 5 (1,203 reviews)".
  return (
    <p className="flex items-baseline gap-1.5 text-sm">
      <span aria-hidden="true" className="text-warning">
        ★
      </span>
      <span className="sr-only">Rated </span>
      <strong className="text-base font-semibold tabular-nums">{rating.stars}</strong>
      <span className="sr-only"> out of 5</span>
      <span className="text-muted-foreground tabular-nums">({rating.reviews})</span>
    </p>
  );
}

// The card's "Compare" box (HANDOFF "Compare tray and comparison"). Its name is
// "Compare Riverside International Hospital", which starts with the visible "Compare" (WCAG
// 2.5.3). With 3 others chosen it is aria-disabled, not disabled, so it stays focusable and its
// hint "You can compare up to 3" is still heard; a click then does nothing. It is disabled
// until the client has the catalogue, like the filter panel.
function CompareBox({
  group,
  isEnabled,
  onToggle,
}: Readonly<{
  group: ProviderGroupView;
  isEnabled: boolean;
  onToggle: (providerId: number) => void;
}>) {
  const id = `compare-${String(group.providerId)}`;
  const { isChosen, isFull } = group.compare;
  return (
    // Under the provider's name on a phone, so it lines up on the left there; beside it, on
    // the right, from the small breakpoint up.
    <div className="flex flex-col items-start gap-1 sm:items-end">
      {/* The label sits beside the checkbox, not around it, as in FilterOption. The border
          around both is the handoff's bordered label. */}
      <div className="flex min-h-11 items-center gap-2 rounded-lg border border-input pl-3">
        <Checkbox
          id={id}
          checked={isChosen}
          disabled={!isEnabled}
          aria-label={`Compare ${group.name}`}
          aria-disabled={isFull || undefined}
          aria-describedby={isFull ? `${id}-hint` : undefined}
          onCheckedChange={() => {
            if (!isFull) onToggle(group.providerId);
          }}
        />
        <label
          htmlFor={id}
          className={cn(
            "py-2.5 pr-3 text-sm font-medium",
            isFull || !isEnabled ? "cursor-not-allowed text-muted-foreground" : "cursor-pointer",
          )}
        >
          Compare
        </label>
      </div>
      {isFull && (
        <p id={`${id}-hint`} className="text-sm text-muted-foreground">
          {COMPARE_LIMIT_HINT}
        </p>
      )}
    </div>
  );
}

// One provider and its first matching services (T1-01, T1-02).
// headingLevel is 4 when the card sits under a "Prices in THB" heading, so headings nest.
export function ProviderGroupCard({
  group,
  headingLevel,
  isCompareEnabled,
  onCompareToggle,
}: Readonly<{
  group: ProviderGroupView;
  headingLevel: 3 | 4;
  isCompareEnabled: boolean;
  onCompareToggle: (providerId: number) => void;
}>) {
  const Heading = headingLevel === 3 ? "h3" : "h4";
  const firstNewServiceRef = useRef<HTMLLIElement>(null);
  const isOpening = useRef(false);
  const serviceCount = group.services.length;

  // D10: after "View all", focus moves to the first newly shown service once the URL has
  // caught up and it is on screen. Only for a click here, not a reload or Back with the group
  // open. Any change to the list ends the wait, so a later one can't steal focus.
  useEffect(() => {
    if (isOpening.current && serviceCount > GROUP_PREVIEW_SIZE) {
      firstNewServiceRef.current?.focus();
    }
    isOpening.current = false;
  }, [serviceCount]);

  return (
    <article className="flex flex-col rounded-xl border bg-card px-4 pt-4">
      <header className="flex flex-wrap items-start justify-between gap-3 border-b pb-3">
        <div className="flex flex-col gap-1">
          <Heading className="text-lg font-semibold">{group.name}</Heading>
          <p className="text-sm text-muted-foreground">{group.place}</p>
          <ProviderRating rating={group.rating} />
        </div>
        <CompareBox group={group} isEnabled={isCompareEnabled} onToggle={onCompareToggle} />
      </header>
      <ul>
        {group.services.map((service, index) => (
          <li
            key={service.id}
            // tabIndex -1: focus can be moved to the first newly shown service (D10) without
            // adding a tab stop per service.
            ref={index === GROUP_PREVIEW_SIZE ? firstNewServiceRef : undefined}
            tabIndex={index === GROUP_PREVIEW_SIZE ? -1 : undefined}
            className="flex items-start justify-between gap-6 border-b border-muted py-3 last:border-b-0"
          >
            <div className="flex flex-col items-start gap-1">
              <span className="font-medium">{service.title}</span>
              <span className="rounded-md border px-2 py-0.5 text-xs font-medium text-text-secondary">
                {service.typeLabel}
              </span>
            </div>
            <PriceTag price={service.price} />
          </li>
        ))}
      </ul>
      {/* A link, not a button: the open groups live in the URL (D10), so it works before the
          client has taken over, and back and forward restore it. scroll={false} keeps the card
          where it is. After "Show fewer", focus stays on the link, which is in the same place. */}
      {group.toggle && (
        <div className="flex min-h-13 items-center border-t">
          <Link
            href={group.toggle.href}
            scroll={false}
            onClick={(event) => {
              // A click that opens a new tab or window leaves this page as it is.
              const opensElsewhere = event.metaKey || event.ctrlKey || event.shiftKey;
              isOpening.current = !opensElsewhere && serviceCount <= GROUP_PREVIEW_SIZE;
            }}
            className="inline-flex min-h-11 items-center font-medium text-primary underline-offset-4 hover:underline"
          >
            {/* The visible words come first in the name (WCAG 2.5.3). One span, so the
                link's flex layout doesn't drop the space before the hidden text. */}
            <span>
              {group.toggle.label} <span className="sr-only">{group.toggle.hiddenText}</span>
            </span>
          </Link>
        </div>
      )}
    </article>
  );
}
