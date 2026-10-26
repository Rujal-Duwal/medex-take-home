"use client";

import { useSyncExternalStore } from "react";
import { isOffline } from "./fetch-api";

// Re-check whenever the browser reports a connection change.
// ?mockOffline=1 is read from the URL on each check. A reviewer types it into the address bar,
// which reloads the page, so it needs no event of its own.
function subscribe(onChange: () => void): () => void {
  globalThis.addEventListener("online", onChange);
  globalThis.addEventListener("offline", onChange);
  return () => {
    globalThis.removeEventListener("online", onChange);
    globalThis.removeEventListener("offline", onChange);
  };
}

// True when the browser is offline or ?mockOffline=1 is set. Uses the same isOffline() rule as
// fetchApi, so the banner and the requests always agree.
// The third argument is what the server renders: it can't know, so it says "online". React then
// re-renders with the real value after hydration, without a mismatch warning.
// https://react.dev/reference/react/useSyncExternalStore
export function useIsOffline(): boolean {
  return useSyncExternalStore(
    subscribe,
    () => isOffline(),
    () => false,
  );
}
