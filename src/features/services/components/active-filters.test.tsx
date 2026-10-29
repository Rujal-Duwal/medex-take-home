import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import type { ChipView } from "../filters-view";
import { ActiveFilters } from "./active-filters";

// The focus rules on their own, with the chips handed in by the test, so a test can choose
// when the new chips arrive. The explorer tests cover the same path through the real URL.

function chip(id: string, label: string): ChipView {
  return { id, label, change: { kind: "category", key: id } };
}

const thyroid = chip("chip-cat-package.ultrasound.thyroid", "Ultrasound: Thyroid (Package)");
const ultrasound = chip("chip-cat-package.ultrasound", "Ultrasound (Package)");
const homeTest = chip("chip-home-test", "Home test available");

function renderChips(chips: ChipView[], onFiltersGone = vi.fn()) {
  const props = { isEnabled: true, onChange: vi.fn(), onFiltersGone };
  const { rerender } = render(<ActiveFilters chips={chips} {...props} />);
  return (next: ChipView[]) => {
    rerender(<ActiveFilters chips={next} {...props} />);
  };
}

describe("ActiveFilters", () => {
  it("removing the last subcategory moves focus to its category chip, now in its place", () => {
    const showChips = renderChips([thyroid, homeTest]);

    fireEvent.click(screen.getByRole("button", { name: `Remove filter: ${thyroid.label}` }));
    showChips([ultrasound, homeTest]);

    expect(
      screen.getByRole("button", { name: `Remove filter: ${ultrasound.label}` }),
    ).toHaveFocus();
  });

  it("waits while the removed chip is still listed, then moves focus", () => {
    const showChips = renderChips([thyroid, homeTest]);
    const removedChip = screen.getByRole("button", { name: `Remove filter: ${thyroid.label}` });
    removedChip.focus();

    fireEvent.click(removedChip);
    // A render before the URL has changed: same chips in a new list.
    showChips([thyroid, homeTest]);
    expect(removedChip).toHaveFocus();

    showChips([homeTest]);
    expect(screen.getByRole("button", { name: `Remove filter: ${homeTest.label}` })).toHaveFocus();
  });

  it("with no chips left, hands focus back to the explorer", () => {
    const onFiltersGone = vi.fn();
    const showChips = renderChips([homeTest], onFiltersGone);

    fireEvent.click(screen.getByRole("button", { name: `Remove filter: ${homeTest.label}` }));
    showChips([]);

    expect(onFiltersGone).toHaveBeenCalledTimes(1);
    expect(screen.queryByRole("list", { name: "Active filters" })).not.toBeInTheDocument();
  });
});
