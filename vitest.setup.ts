// Adds DOM matchers such as toBeInTheDocument() and toHaveAccessibleName() to expect().
import "@testing-library/jest-dom/vitest";
import { cleanup } from "@testing-library/react";
import { afterEach } from "vitest";

// Unmount anything a component test rendered, so tests never see each other's DOM.
afterEach(() => {
  cleanup();
});
