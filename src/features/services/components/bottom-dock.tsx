"use client";

import { useEffect, useLayoutEffect, useRef, useState } from "react";

// Extra room above the dock when the page scrolls a focused element into view. Scrolling only
// counts the element's own box; the focus ring is drawn 2px outside it, 2px thick, and would
// otherwise end right under the dock's edge.
const FOCUS_RING_ROOM_PX = 16;

// What floats at the bottom of the window: the slow note and the compare tray, stacked so the
// note sits above the tray, never under it. Out of the page flow, so either one appears
// without moving the results (CLS 0).
//
// Anything fixed over the page can hide what has focus (WCAG 2.4.11). The dock's height is kept
// clear in three places:
// - the page keeps that much room under a focused element when scrolling to it
//   (scroll-padding, technique C43: https://www.w3.org/WAI/WCAG22/Techniques/css/C43)
// - a spacer of the same height ends the page, so the last card and the pagination can
//   scroll clear of it
// - the large-screen filter panel scrolls on its own, which scroll-padding doesn't reach, so
//   its height leaves out --bottom-dock-height (FilterPanel) and its end stays above the dock
// The height is measured, not guessed: the slow note comes and goes, the hint takes a line on
// a phone, and the chips wrap on wider screens.
export function BottomDock({ children }: Readonly<{ children: React.ReactNode }>) {
  const dockRef = useRef<HTMLDivElement>(null);
  const [height, setHeight] = useState(0);

  useLayoutEffect(() => {
    const dock = dockRef.current;
    if (dock === null) return;
    const observer = new ResizeObserver(() => {
      setHeight(dock.offsetHeight);
    });
    observer.observe(dock);
    return () => {
      observer.disconnect();
    };
  }, []);

  useEffect(() => {
    if (height === 0) return;
    const root = document.documentElement;
    root.style.scrollPaddingBottom = `${String(height + FOCUS_RING_ROOM_PX)}px`;
    root.style.setProperty("--bottom-dock-height", `${String(height)}px`);
    return () => {
      root.style.scrollPaddingBottom = "";
      root.style.removeProperty("--bottom-dock-height");
    };
  }, [height]);

  return (
    <>
      <div aria-hidden="true" style={{ height }} />
      <div ref={dockRef} className="fixed inset-x-0 bottom-0 z-10 flex flex-col">
        {children}
      </div>
    </>
  );
}
