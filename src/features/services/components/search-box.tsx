"use client";

import { useEffect, useRef, useState, type RefObject } from "react";
import type { FilterChange } from "../filter-changes";
import { parseSearchText, searchTextOf } from "../url-codec";
import { fieldClassName } from "./field-class-name";

// The free-text search (T1-03). Typing is sent as a change (see below for how often), and the
// explorer writes it to the URL; the results follow in Next's transition, so typing never waits
// for them.
//
// The box keeps its own text and follows the URL's search only while it isn't focused. Next updates
// useSearchParams in a transition, so while typing, the q it reports can be a keystroke behind
// what is in the box; copying it back would eat letters. "Clear all" and clicking Back happen
// with focus elsewhere, so the box catches up with them. Back from the keyboard (Alt+Left)
// can happen while typing, so popstate sets the box from the address bar too.
//
// Typing is sent on at most once every SEARCH_SEND_INTERVAL_MS. Safari allows 100
// history changes per 10 seconds and throws past that (WebKit, History.cpp), and each letter
// the explorer writes costs two: its own, and the one Next.js makes after it. So a letter typed
// sooner waits, and the latest text is sent when the time is up: at most 4 sends a second, so
// 8 history writes.
// Waiting text is sent at once when focus leaves the box, so a click elsewhere (a tick, the
// Filters button) builds on everything typed. Back drops it: the address bar wins.
//
// There are two: one in the filter panel on large screens, one above the results on small
// screens. Both are in the page, one hidden by CSS, so each needs its own id.
export const SEARCH_SEND_INTERVAL_MS = 250;

interface WaitingText {
  text: string;
  timer: ReturnType<typeof setTimeout>;
}

export function SearchBox({
  id,
  urlText,
  disabled,
  onChange,
}: Readonly<{
  id: string;
  urlText: string;
  disabled?: boolean;
  onChange: (change: FilterChange) => void;
}>) {
  const [text, setText] = useState(urlText);
  const [isFocused, setIsFocused] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);
  // When text was last sent (performance.now()), and the text waiting to be sent, if any.
  const lastSentAt = useRef(Number.NEGATIVE_INFINITY);
  const waiting = useRef<WaitingText | undefined>(undefined);
  // Adjusting state while rendering, as React suggests for state that follows a prop:
  // https://react.dev/learn/you-might-not-need-an-effect#adjusting-some-state-when-a-prop-changes
  // A box of only spaces isn't put back to "": the codec leaves such text out of the URL.
  if (!isFocused && searchTextOf(text) !== urlText) setText(urlText);

  useEffect(() => {
    function followHistory() {
      dropWaiting(waiting);
      // Unfocused, the line above already follows the URL; doing it here too would flash.
      if (document.activeElement !== inputRef.current) return;
      setText(parseSearchText(new URLSearchParams(globalThis.location.search)));
    }
    globalThis.addEventListener("popstate", followHistory);
    return () => {
      globalThis.removeEventListener("popstate", followHistory);
      dropWaiting(waiting);
    };
  }, []);

  function send(nextText: string) {
    lastSentAt.current = performance.now();
    onChange({ kind: "search", text: nextText });
  }

  function sendWaiting() {
    const pending = waiting.current;
    if (pending === undefined) return;
    dropWaiting(waiting);
    send(pending.text);
  }

  function handleTyping(nextText: string) {
    // A timer is already set: it will send this newer text.
    if (waiting.current !== undefined) {
      waiting.current.text = nextText;
      return;
    }
    const wait = lastSentAt.current + SEARCH_SEND_INTERVAL_MS - performance.now();
    if (wait <= 0) send(nextText);
    // The timer calls the onChange from this render. That is safe: the explorer reads the
    // address bar when the change arrives, and from this render it only uses the catalogue,
    // which doesn't change once loaded.
    else waiting.current = { text: nextText, timer: setTimeout(sendWaiting, wait) };
  }

  return (
    <div className="flex flex-col gap-2">
      <label htmlFor={id} className="text-base font-semibold">
        Search
      </label>
      <input
        ref={inputRef}
        id={id}
        type="search"
        value={text}
        placeholder="Service, test or provider"
        autoComplete="off"
        disabled={disabled}
        className={fieldClassName}
        onFocus={() => {
          setIsFocused(true);
        }}
        onBlur={() => {
          setIsFocused(false);
          sendWaiting();
        }}
        onChange={(event) => {
          setText(event.target.value);
          handleTyping(event.target.value);
        }}
      />
    </div>
  );
}

// Outside the component so the popstate effect can use it without depending on a render.
function dropWaiting(waiting: RefObject<WaitingText | undefined>) {
  clearTimeout(waiting.current?.timer);
  waiting.current = undefined;
}
