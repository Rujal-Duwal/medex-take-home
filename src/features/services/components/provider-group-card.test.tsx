import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import type { ProviderGroupView } from "../results-view";
import { ProviderGroupCard } from "./provider-group-card";

// The card's Compare box. Which state it is in comes from results-view (tested there); this
// checks what the customer and a screen reader get from each state.

function groupWith(compare: ProviderGroupView["compare"]): ProviderGroupView {
  return {
    providerId: 48,
    name: "Riverside International Hospital",
    place: "Bangkok, Thailand",
    rating: { kind: "new" },
    services: [],
    compare,
  };
}

function renderCard(compare: ProviderGroupView["compare"], isCompareEnabled = true) {
  const onCompareToggle = vi.fn();
  render(
    <ProviderGroupCard
      group={groupWith(compare)}
      headingLevel={3}
      isCompareEnabled={isCompareEnabled}
      onCompareToggle={onCompareToggle}
    />,
  );
  const box = screen.getByRole("checkbox", { name: "Compare Riverside International Hospital" });
  return { box, onCompareToggle };
}

describe("ProviderGroupCard: Compare box", () => {
  it("ticking it asks to compare this provider", () => {
    const { box, onCompareToggle } = renderCard({ isChosen: false, isFull: false });
    expect(box).not.toBeChecked();
    fireEvent.click(box);
    expect(onCompareToggle).toHaveBeenCalledWith(48);
  });

  it("with 3 others chosen it stays focusable, says why, and a click does nothing", () => {
    const { box, onCompareToggle } = renderCard({ isChosen: false, isFull: true });
    expect(box).toBeEnabled();
    expect(box).toHaveAttribute("aria-disabled", "true");
    expect(box).toHaveAccessibleDescription("You can compare up to 3");
    fireEvent.click(box);
    expect(onCompareToggle).not.toHaveBeenCalled();
  });

  it("is disabled until the catalogue has loaded", () => {
    const { box } = renderCard({ isChosen: true, isFull: false }, false);
    expect(box).toBeChecked();
    expect(box).toBeDisabled();
  });
});
