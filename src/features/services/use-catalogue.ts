"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { loadCatalogue } from "./api";
import type { Catalogue } from "./types";

// Where the client's copy of the catalogue is. The explorer picks what to show from it:
//   loading   the server's results stay up (first load, back online) or a skeleton shows
//             (after Try again, when they are gone).
//             isSlow turns on after SLOW_AFTER_MS, for the "taking longer" note.
//   ready     the client runs the engine itself from now on.
//   failed    the error with "Try again". reason picks the words: "network" means no reply.
//   offline   the server's results stay up with the offline banner; loads again once online.
export type CatalogueState =
  | { kind: "loading"; isRetry: boolean; isSlow: boolean }
  | { kind: "ready"; catalogue: Catalogue }
  | { kind: "failed"; reason: "network" | "server" }
  | { kind: "offline" };

// Normal latency is 300 to 800 ms, so 3 s is clearly slow. ?mockDelay=3000 shows the note.
const SLOW_AFTER_MS = 3000;

export function useCatalogue(): { state: CatalogueState; retry: () => void } {
  const [state, setState] = useState<CatalogueState>({
    kind: "loading",
    isRetry: false,
    isSlow: false,
  });
  // Each load is one attempt. Try again starts the next one.
  const [attempt, setAttempt] = useState(0);

  // In development React runs every effect twice on mount. Loading twice would use up a
  // ?mockFail=...:once rule on the first, thrown-away call, so the failure would never show.
  // This remembers which attempt has started, so each one loads once.
  // https://react.dev/learn/synchronizing-with-effects#how-to-handle-the-effect-firing-twice-in-development
  const startedAttempt = useRef(-1);

  useEffect(() => {
    if (startedAttempt.current === attempt) return;
    startedAttempt.current = attempt;
    void loadCatalogue().then((result) => {
      if (result.kind === "ok") setState({ kind: "ready", catalogue: result.data });
      else if (result.kind === "offline") setState({ kind: "offline" });
      else setState({ kind: "failed", reason: result.kind === "network" ? "network" : "server" });
    });
  }, [attempt]);

  const isLoading = state.kind === "loading";
  useEffect(() => {
    if (!isLoading) return;
    const timer = setTimeout(() => {
      setState((current) => (current.kind === "loading" ? { ...current, isSlow: true } : current));
    }, SLOW_AFTER_MS);
    return () => {
      clearTimeout(timer);
    };
  }, [isLoading]);

  // Starts the next attempt. isRetry is true after an error (the results are gone, so a
  // skeleton shows) and false back online (the server's results are still up).
  const loadAgain = useCallback((isRetry: boolean) => {
    setState({ kind: "loading", isRetry, isSlow: false });
    setAttempt((current) => current + 1);
  }, []);
  const retry = useCallback(() => {
    loadAgain(true);
  }, [loadAgain]);

  // Offline: load again as soon as the browser is back online. (?mockOffline=1 never comes
  // back online; remove it from the URL to leave the demo.)
  const isOffline = state.kind === "offline";
  useEffect(() => {
    if (!isOffline) return;
    const reload = () => {
      loadAgain(false);
    };
    globalThis.addEventListener("online", reload);
    return () => {
      globalThis.removeEventListener("online", reload);
    };
  }, [isOffline, loadAgain]);

  return { state, retry };
}
