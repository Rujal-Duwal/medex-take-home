// Adds DOM matchers such as toBeInTheDocument() and toHaveAccessibleName() to expect().
import "@testing-library/jest-dom/vitest";
import { cleanup } from "@testing-library/react";
import { afterEach } from "vitest";

// jsdom has no layout, so no ResizeObserver. BottomDock measures itself with one; here it never
// fires, which is what a box with no layout would do anyway.
class NoLayoutResizeObserver {
  observe() {
    // Nothing has a size to report.
  }
  unobserve() {
    // Nothing is observed.
  }
  disconnect() {
    // Nothing is observed.
  }
}
globalThis.ResizeObserver = NoLayoutResizeObserver;

// Unmount anything a component test rendered, so tests never see each other's DOM.
afterEach(() => {
  cleanup();
});
