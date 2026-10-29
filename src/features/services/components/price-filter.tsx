"use client";

import { useLayoutEffect, useRef, useState } from "react";
import { Button } from "@/components/ui/button";
import { useAnnounce } from "@/lib/a11y/live-announcer";
import type { Currency } from "@/lib/money/money";
import { cn } from "@/lib/utils";
import { readPriceRange, type FilterChange } from "../filter-changes";
import type { PriceFilterView } from "../filters-view";
import { fieldClassName } from "./field-class-name";

// The price filter (D7). Two steps, from PriceFilterView:
// - no currency yet: the customer picks one, each with its count
// - a currency: Min and Max boxes in that currency, applied with "Apply"
// Picking a currency or "Change currency" swaps one step for the other, so the button that was
// pressed goes away. Focus then moves into the new step, so it isn't lost: to Min when the
// range shows, to the first currency when the choice shows.
export function PriceFilter({
  price,
  onChange,
}: Readonly<{ price: PriceFilterView; onChange: (change: FilterChange) => void }>) {
  const containerRef = useRef<HTMLFieldSetElement>(null);
  // Set when the customer presses a button that swaps the step.
  const isSwapping = useRef(false);
  // Which step shows. The currency is part of it: "Change currency" can land on the range in
  // the location's currency (Bangkok gives THB after NPR), which is a new step too.
  const step = price.kind === "range" ? `range-${price.currency}` : "choose-currency";

  // A layout effect, like the provider list's focus fix: focus moves before the new step paints.
  useLayoutEffect(() => {
    if (!isSwapping.current) return;
    isSwapping.current = false;
    const container = containerRef.current;
    // Only if focus is still in the price filter, or was lost with the pressed button. If the
    // customer has moved on (a Back press overtook the swap), focus stays where they are.
    const active = document.activeElement;
    if (active !== document.body && !container?.contains(active)) return;
    (container?.querySelector("input") ?? container?.querySelector("button"))?.focus();
  }, [step]);

  function swapStep(change: FilterChange) {
    isSwapping.current = true;
    onChange(change);
  }

  return (
    <fieldset ref={containerRef} className="flex min-w-0 flex-col gap-3">
      <legend className="mb-2 text-base font-semibold">
        {price.kind === "range" ? `Price (${price.currency})` : "Price"}
      </legend>
      {price.kind === "range" ? (
        <>
          {price.canChangeCurrency && (
            <Button
              type="button"
              variant="link"
              className="self-start px-0"
              onClick={() => {
                swapStep({ kind: "currency" });
              }}
            >
              Change currency
            </Button>
          )}
          {/* A new form for each currency, so boxes typed in THB never carry over to NPR. */}
          <PriceRangeForm
            key={price.currency}
            currency={price.currency}
            urlMin={price.min}
            urlMax={price.max}
            emptyRangeChange={price.emptyRangeChange}
            onChange={onChange}
          />
        </>
      ) : (
        <>
          <p className="text-sm text-text-secondary">{price.note}</p>
          <fieldset className="flex min-w-0 flex-wrap gap-2">
            <legend className="sr-only">Currency</legend>
            {price.currencies.map((currency) => (
              <Button
                key={currency.id}
                type="button"
                variant="outline"
                // Same rule as FilterOption: unavailable stays focusable, clicks do nothing.
                aria-disabled={currency.isUnavailable || undefined}
                className="tabular-nums"
                onClick={() => {
                  if (!currency.isUnavailable) swapStep(currency.change);
                }}
              >
                {currency.label} ({currency.count})
              </Button>
            ))}
          </fieldset>
        </>
      )}
    </fieldset>
  );
}

const inputClassName = cn(fieldClassName, "tabular-nums aria-invalid:border-destructive");

function PriceRangeForm({
  currency,
  urlMin,
  urlMax,
  emptyRangeChange,
  onChange,
}: Readonly<{
  currency: Currency;
  urlMin: string;
  urlMax: string;
  emptyRangeChange: FilterChange;
  onChange: (change: FilterChange) => void;
}>) {
  const [min, setMin] = useState(urlMin);
  const [max, setMax] = useState(urlMax);
  const [error, setError] = useState<{ field: "min" | "max"; message: string }>();
  const minRef = useRef<HTMLInputElement>(null);
  const maxRef = useRef<HTMLInputElement>(null);
  const announce = useAnnounce();

  // The boxes follow the URL when it changes from outside (back, forward, Clear all), as React
  // suggests for state that follows a prop:
  // https://react.dev/learn/you-might-not-need-an-effect#adjusting-some-state-when-a-prop-changes
  const [seen, setSeen] = useState({ urlMin, urlMax });
  if (seen.urlMin !== urlMin || seen.urlMax !== urlMax) {
    setSeen({ urlMin, urlMax });
    setMin(urlMin);
    setMax(urlMax);
    setError(undefined);
  }

  function applyRange() {
    const range = readPriceRange(min, max);
    if (range.kind === "invalid") {
      setError({ field: range.field, message: range.message });
      // Focus goes to the box to fix, which the message then describes. The message is also
      // read out: focus moves before the description renders, and pressing Enter in that box
      // doesn't move focus at all.
      (range.field === "min" ? minRef : maxRef).current?.focus();
      announce(range.message);
      return;
    }
    setError(undefined);
    if (range.min === undefined && range.max === undefined) onChange(emptyRangeChange);
    else onChange({ kind: "price-range", currency, min: range.min, max: range.max });
  }

  return (
    <form
      noValidate
      className="flex flex-col gap-3"
      onSubmit={(event) => {
        event.preventDefault();
        applyRange();
      }}
    >
      <div className="grid grid-cols-2 gap-3">
        <label className="flex flex-col gap-1 text-sm text-text-secondary">
          Min ({currency})
          <input
            ref={minRef}
            inputMode="decimal"
            autoComplete="off"
            value={min}
            aria-invalid={error?.field === "min" || undefined}
            aria-describedby={error?.field === "min" ? "price-error" : undefined}
            className={inputClassName}
            onChange={(event) => {
              setMin(event.target.value);
            }}
          />
        </label>
        <label className="flex flex-col gap-1 text-sm text-text-secondary">
          Max ({currency})
          <input
            ref={maxRef}
            inputMode="decimal"
            autoComplete="off"
            value={max}
            aria-invalid={error?.field === "max" || undefined}
            aria-describedby={error?.field === "max" ? "price-error" : undefined}
            className={inputClassName}
            onChange={(event) => {
              setMax(event.target.value);
            }}
          />
        </label>
      </div>
      {error && (
        <p id="price-error" className="text-sm text-destructive">
          {error.message}
        </p>
      )}
      <Button type="submit" variant="outline" className="self-start">
        Apply price
      </Button>
    </form>
  );
}
