"use client";

import { useEffect, useRef, useState } from "react";
import type { FilterChange } from "../filter-changes";
import { parseSearchText, searchTextOf } from "../url-codec";
import { fieldClassName } from "./field-class-name";

// The free-text search (T1-03). Every keystroke is sent as a change, and the explorer writes it
// to the URL; the results follow in Next's transition, so typing never waits for them.
//
// The box keeps its own text and follows the URL's search only while it isn't focused. Next updates
// useSearchParams in a transition, so while typing, the q it reports can be a keystroke behind
// what is in the box; copying it back would eat letters. "Clear all" and clicking Back happen
// with focus elsewhere, so the box catches up with them. Back from the keyboard (Alt+Left)
// can happen while typing, so popstate sets the box from the address bar too.
export function SearchBox({
  urlText,
  onChange,
}: Readonly<{ urlText: string; onChange: (change: FilterChange) => void }>) {
  const [text, setText] = useState(urlText);
  const [isFocused, setIsFocused] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);
  // Adjusting state while rendering, as React suggests for state that follows a prop:
  // https://react.dev/learn/you-might-not-need-an-effect#adjusting-some-state-when-a-prop-changes
  // A box of only spaces isn't put back to "": the codec leaves such text out of the URL.
  if (!isFocused && searchTextOf(text) !== urlText) setText(urlText);

  useEffect(() => {
    function followHistory() {
      // Unfocused, the line above already follows the URL; doing it here too would flash.
      if (document.activeElement !== inputRef.current) return;
      setText(parseSearchText(new URLSearchParams(globalThis.location.search)));
    }
    globalThis.addEventListener("popstate", followHistory);
    return () => {
      globalThis.removeEventListener("popstate", followHistory);
    };
  }, []);

  return (
    <div className="flex flex-col gap-2">
      <label htmlFor="services-search" className="text-base font-semibold">
        Search
      </label>
      <input
        ref={inputRef}
        id="services-search"
        type="search"
        value={text}
        placeholder="Service, test or provider"
        autoComplete="off"
        className={fieldClassName}
        onFocus={() => {
          setIsFocused(true);
        }}
        onBlur={() => {
          setIsFocused(false);
        }}
        onChange={(event) => {
          setText(event.target.value);
          onChange({ kind: "search", text: event.target.value });
        }}
      />
    </div>
  );
}
