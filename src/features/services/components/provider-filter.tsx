"use client";

import { useLayoutEffect, useRef, useState } from "react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import type { FilterChange } from "../filter-changes";
import {
  PROVIDER_PREVIEW_SIZE,
  providersInShortList,
  providersMatchingName,
  type FilterOptionView,
} from "../filters-view";
import { fieldClassName } from "./field-class-name";
import { FilterOption } from "./filter-option";

// Provider: a name search over a checkbox list (HANDOFF "Command (inline list) + Input"). The
// list is always visible, so it is a plain text box and checkboxes, not a popup combobox: Tab
// goes from the box into the list, and each checkbox works like the other filters.
// The name search only narrows the list on screen; it isn't saved in the URL.
// With no name typed, the list starts short, with "Show all" (the handoff's "View all N"
// pattern: aria-expanded, focus stays on the button). It doesn't scroll inside a fixed height:
// a box that scrolls inside the panel is hard to use and clipped the focus outline.
export function ProviderFilter({
  providers,
  onChange,
}: Readonly<{ providers: FilterOptionView[]; onChange: (change: FilterChange) => void }>) {
  const [name, setName] = useState("");
  const [isExpanded, setIsExpanded] = useState(false);
  // Ticked or unticked in the short list; see providersInShortList.
  const [keptIds, setKeptIds] = useState<ReadonlySet<string>>(new Set());
  // The checkbox just changed. Unticking a provider with 0 moves it below the divider (D5), and
  // a browser drops focus from an element that is moved. Once the new list is in, focus goes
  // back to it if it was lost. It runs before paint, so nothing flickers.
  const changedId = useRef<string>(undefined);
  useLayoutEffect(() => {
    const id = changedId.current;
    changedId.current = undefined;
    if (id !== undefined && document.activeElement === document.body) {
      document.getElementById(id)?.focus();
    }
  }, [providers]);

  const isSearching = name.trim() !== "";
  const matching = providersMatchingName(providers, name);
  const shown = isSearching || isExpanded ? matching : providersInShortList(matching, keptIds);
  const canExpand = !isSearching && providers.length > PROVIDER_PREVIEW_SIZE;
  // D5: unavailable providers come last; a divider goes above the first of them.
  const firstUnavailable = shown.findIndex((provider) => provider.isUnavailable);

  function changeProvider(option: FilterOptionView) {
    changedId.current = option.id;
    if (!isExpanded) setKeptIds(new Set(keptIds).add(option.id));
    onChange(option.change);
  }

  return (
    <fieldset className="flex min-w-0 flex-col gap-2">
      <legend className="mb-2 text-base font-semibold">Provider</legend>
      <input
        type="search"
        aria-label="Search providers"
        placeholder="Search providers"
        autoComplete="off"
        value={name}
        className={fieldClassName}
        onChange={(event) => {
          setName(event.target.value);
        }}
      />
      {shown.length === 0 ? (
        <p className="py-2 text-sm text-text-secondary">No providers match that name.</p>
      ) : (
        <ul id="provider-options">
          {shown.map((provider, index) => (
            <li
              key={provider.id}
              className={cn(index === firstUnavailable && index > 0 && "mt-2 border-t pt-2")}
            >
              <FilterOption
                option={provider}
                onChange={() => {
                  changeProvider(provider);
                }}
              />
            </li>
          ))}
        </ul>
      )}
      {canExpand && (
        <Button
          type="button"
          variant="link"
          className="self-start px-0"
          aria-expanded={isExpanded}
          aria-controls="provider-options"
          onClick={() => {
            setIsExpanded(!isExpanded);
            setKeptIds(new Set());
          }}
        >
          {isExpanded ? "Show fewer providers" : `Show all ${String(providers.length)} providers`}
        </Button>
      )}
    </fieldset>
  );
}
