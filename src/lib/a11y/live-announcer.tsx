"use client";

import { createContext, useCallback, useContext, useEffect, useRef, useState } from "react";

// The one shared polite live region (CLAUDE.md hard rule 8).
// https://developer.mozilla.org/en-US/docs/Web/Accessibility/ARIA/ARIA_live_regions
//
// The region is rendered empty when the app loads, because screen readers only announce changes
// to a live region that already exists. Components call useAnnounce() to put text in it.

type Announce = (message: string) => void;

const AnnounceContext = createContext<Announce | null>(null);

export function LiveAnnouncerProvider({ children }: Readonly<{ children: React.ReactNode }>) {
  const [message, setMessage] = useState("");
  const pendingTimer = useRef<ReturnType<typeof setTimeout>>(undefined);

  // Clear first, then set the text on the next tick. If both happened in one update, React would
  // render no change when the same message repeats ("3 services" twice), and nothing is announced.
  const announce = useCallback((next: string) => {
    clearTimeout(pendingTimer.current);
    setMessage("");
    pendingTimer.current = setTimeout(() => {
      setMessage(next);
    }, 0);
  }, []);

  useEffect(() => {
    return () => {
      clearTimeout(pendingTimer.current);
    };
  }, []);

  return (
    <AnnounceContext value={announce}>
      {children}
      {/* <output> has the implicit role "status". aria-live is repeated for screen readers
          that don't treat <output> as a live region on their own. */}
      <output aria-live="polite" aria-atomic="true" className="sr-only">
        {message}
      </output>
    </AnnounceContext>
  );
}

export function useAnnounce(): Announce {
  const announce = useContext(AnnounceContext);
  if (!announce) {
    throw new Error("useAnnounce must be used inside LiveAnnouncerProvider (in the root layout)");
  }
  return announce;
}
