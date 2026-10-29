"use client";

import { useRef, type ComponentProps } from "react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import type { FilterChange } from "../filter-changes";
import type { FiltersView, SelectOptionView } from "../filters-view";
import { fieldClassName } from "./field-class-name";
import { FilterOption } from "./filter-option";
import { PriceFilter } from "./price-filter";
import { ProviderFilter } from "./provider-filter";
import { SearchBox } from "./search-box";

// The filter panel (T1-03, spec "Filter panel and drawer"). Plain markup from a FiltersView:
// every control reports a FilterChange, and the explorer applies it and writes the URL.
// isEnabled is false until the client has the catalogue: before that a change couldn't be
// counted, so the whole panel is a disabled fieldset (one attribute, no layout change).
//
// The panel shows on large screens only. On small screens FilterFields goes into the drawer
// (filters-drawer.tsx), which sends its changes to a pending copy instead of the URL.

// A native select with its own arrow. The browser draws its arrow against the right edge and
// ignores padding there, so appearance-none hides it and a chevron is drawn 12px in, the same
// gap as the text on the left. className sizes the wrapper.
function SelectBox({ className, children, ...props }: ComponentProps<"select">) {
  return (
    <div className={cn("relative", className)}>
      <select className={cn(fieldClassName, "appearance-none pr-10")} {...props}>
        {children}
      </select>
      <svg
        aria-hidden="true"
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
        className="pointer-events-none absolute top-1/2 right-3 size-4 -translate-y-1/2 text-text-secondary"
      >
        <path d="m6 9 6 6 6-6" />
      </svg>
    </div>
  );
}

// A native select: keyboard, screen readers and mobile pickers come with it. The chosen
// option's change is looked up by its value.
function changeFor(options: SelectOptionView[], value: string): FilterChange | undefined {
  return options.find((option) => option.value === value)?.change;
}

export function SortSelect({
  sort,
  isEnabled,
  onChange,
}: Readonly<{
  sort: FiltersView["sort"];
  isEnabled: boolean;
  onChange: (change: FilterChange) => void;
}>) {
  return (
    <div className="flex items-center gap-3">
      {/* nowrap and shrink-0: the select is as wide as its longest option, and "Sort by" stays
          on one line beside it. On a phone there is no room for it next to the Filters
          button, so it is only read out there, as the handoff draws it. */}
      <label
        htmlFor="services-sort"
        className="sr-only shrink-0 text-sm whitespace-nowrap text-text-secondary sm:not-sr-only"
      >
        Sort by
      </label>
      <SelectBox
        id="services-sort"
        value={sort.value}
        disabled={!isEnabled}
        className="shrink-0"
        onChange={(event) => {
          const change = changeFor(sort.options, event.target.value);
          if (change) onChange(change);
        }}
      >
        {sort.options.map((option) => (
          <option key={option.value} value={option.value}>
            {option.label}
          </option>
        ))}
      </SelectBox>
    </div>
  );
}

function LocationSelect({
  location,
  onChange,
}: Readonly<{ location: FiltersView["location"]; onChange: (change: FilterChange) => void }>) {
  const options = [location.any, ...location.countries.flatMap((country) => country.options)];
  return (
    <div className="flex flex-col gap-2">
      <label htmlFor="services-location" className="text-base font-semibold">
        City or country
      </label>
      <SelectBox
        id="services-location"
        value={location.value}
        onChange={(event) => {
          const change = changeFor(options, event.target.value);
          if (change) onChange(change);
        }}
      >
        <option value={location.any.value}>{location.any.label}</option>
        {location.countries.map((country) => (
          <optgroup key={country.label} label={country.label}>
            {country.options.map((option) => (
              // A native option can't stay focusable, so here unavailable is plain disabled.
              <option key={option.value} value={option.value} disabled={option.isUnavailable}>
                {option.label}
              </option>
            ))}
          </optgroup>
        ))}
      </SelectBox>
    </div>
  );
}

function CategoryFilter({
  groups,
  other,
  onChange,
}: Readonly<{
  groups: FiltersView["categoryGroups"];
  other: FiltersView["otherCategory"];
  onChange: (change: FilterChange) => void;
}>) {
  return (
    <fieldset className="flex min-w-0 flex-col gap-3">
      <legend className="mb-2 text-base font-semibold">Category</legend>
      {groups.map((group) => (
        // Each type's categories in their own group, so the two "Ultrasound" options are
        // heard as "Package, Ultrasound" and "Lab test, Ultrasound".
        <fieldset key={group.label} className="min-w-0">
          <legend className="text-sm font-medium text-text-secondary">{group.label}</legend>
          <ul>
            {group.categories.map((category) => (
              <li key={category.id}>
                <FilterOption option={category} onChange={onChange} />
                {category.subcategories.length > 0 && (
                  <ul aria-label={`${category.label} subcategories`} className="pl-7">
                    {category.subcategories.map((subcategory) => (
                      <li key={subcategory.id}>
                        <FilterOption option={subcategory} onChange={onChange} />
                      </li>
                    ))}
                  </ul>
                )}
              </li>
            ))}
          </ul>
        </fieldset>
      ))}
      <FilterOption option={other} onChange={onChange} />
    </fieldset>
  );
}

// Every filter but the search, in the panel's order. Shared by the panel and the drawer: the
// panel has the search above them, and on small screens the search is on the page instead.
export function FilterFields({
  view,
  onChange,
}: Readonly<{ view: FiltersView; onChange: (change: FilterChange) => void }>) {
  return (
    <>
      <fieldset className="min-w-0">
        <legend className="mb-2 text-base font-semibold">Service type</legend>
        {view.types.map((option) => (
          <FilterOption key={option.id} option={option} onChange={onChange} />
        ))}
      </fieldset>
      <CategoryFilter groups={view.categoryGroups} other={view.otherCategory} onChange={onChange} />
      <ProviderFilter providers={view.providers} onChange={onChange} />
      <LocationSelect location={view.location} onChange={onChange} />
      <PriceFilter price={view.price} onChange={onChange} />
      <FilterOption option={view.homeTest} onChange={onChange} />
    </>
  );
}

export function FilterPanel({
  view,
  isEnabled,
  onChange,
}: Readonly<{
  view: FiltersView;
  isEnabled: boolean;
  onChange: (change: FilterChange) => void;
}>) {
  const headingRef = useRef<HTMLHeadingElement>(null);
  return (
    // On large screens the panel sticks beside the results and scrolls on its own when it is
    // taller than the window, so the filters stay in reach while scrolling the results.
    // Its height fits the window once it has stuck. Before that (page at the top) it starts
    // lower, so its end is below the window. The wheel must then carry on to the page when the
    // panel reaches its end, so there is no overscroll-contain here.
    // Below the large breakpoint it is hidden; the Filters button and drawer replace it.
    <aside
      aria-labelledby="filters-heading"
      className="hidden rounded-xl border bg-card px-5 pb-5 lg:sticky lg:block lg:top-6 lg:max-h-[calc(100dvh-3rem)] lg:w-76 lg:flex-none lg:overflow-y-auto"
    >
      {/* A fixed-height row, so "Clear all" appearing doesn't move the panel. */}
      <div className="flex h-14 items-center justify-between gap-2">
        {/* tabIndex -1: focus waits here after Clear all, whose button goes away. */}
        <h2 ref={headingRef} id="filters-heading" tabIndex={-1} className="text-lg font-semibold">
          Filters
        </h2>
        {view.hasActiveFilters && (
          <Button
            type="button"
            variant="link"
            className="px-0"
            disabled={!isEnabled}
            onClick={() => {
              onChange({ kind: "clear" });
              headingRef.current?.focus();
            }}
          >
            Clear all
          </Button>
        )}
      </div>
      <fieldset disabled={!isEnabled} className="flex min-w-0 flex-col gap-6">
        <legend className="sr-only">Filter services</legend>
        <SearchBox id="services-search" urlText={view.search} onChange={onChange} />
        <FilterFields view={view} onChange={onChange} />
      </fieldset>
    </aside>
  );
}
