import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import type { ResultsView } from "../results-view";
import { ServiceResults } from "./service-results";

// The page links. Which pages they offer comes from results-view (tested there); this checks
// that every one of them tells the explorer, which moves focus to the results.

const middlePage: ResultsView = {
  countText: "124 services from 28 providers",
  announcement: "124 services from 28 providers, page 2 of 3",
  sections: [],
  pagination: {
    label: "Page 2 of 3",
    previousHref: "/services",
    nextHref: "/services?page=3",
    pages: [
      { number: 1, href: "/services", isCurrent: false },
      { number: 2, href: "/services?page=2", isCurrent: true },
      { number: 3, href: "/services?page=3", isCurrent: false },
    ],
  },
};

describe("ServiceResults: pagination", () => {
  it("every page link calls onPageChange, since Previous and Next go away at the ends", () => {
    const onPageChange = vi.fn();
    render(
      <ServiceResults
        view={middlePage}
        isCompareEnabled
        onCompareToggle={vi.fn()}
        onPageChange={onPageChange}
      />,
    );
    fireEvent.click(screen.getByRole("link", { name: "Previous" }));
    fireEvent.click(screen.getByRole("link", { name: "Next" }));
    fireEvent.click(screen.getByRole("link", { name: "Page 3" }));
    expect(onPageChange).toHaveBeenCalledTimes(3);
  });
});
