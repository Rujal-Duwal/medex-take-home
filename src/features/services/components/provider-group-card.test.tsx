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

// A group of services 1 to n, closed ("View all n services") or open ("Show fewer").
function groupOf(serviceIds: string[], label: string): ProviderGroupView {
  const hiddenText =
    label === "Show fewer"
      ? "services from Riverside International Hospital"
      : "from Riverside International Hospital";
  return {
    ...groupWith({ isChosen: false, isFull: false }),
    services: serviceIds.map((id) => ({
      id,
      title: `Service ${id}`,
      typeLabel: "Package",
      price: { kind: "free" },
    })),
    toggle: { label, hiddenText, href: "/services?open=48" },
  };
}

function cardOf(view: ProviderGroupView) {
  return (
    <ProviderGroupCard group={view} headingLevel={3} isCompareEnabled onCompareToggle={vi.fn()} />
  );
}

const closed = groupOf(["1", "2", "3"], "View all 5 services");
const open = groupOf(["1", "2", "3", "4", "5"], "Show fewer");
const viewAllName = "View all 5 services from Riverside International Hospital";

function fourthService(): HTMLElement | null {
  return screen.getByText("Service 4").closest("li");
}

describe("ProviderGroupCard: View all (D10)", () => {
  it("moves focus to the first newly shown service once the group opens", () => {
    const { rerender } = render(cardOf(closed));
    fireEvent.click(screen.getByRole("link", { name: viewAllName }));
    rerender(cardOf(open));
    expect(fourthService()).toHaveFocus();
  });

  it("leaves focus alone when the group is already open on load", () => {
    render(cardOf(open));
    expect(fourthService()).not.toHaveFocus();
  });

  it("leaves focus alone when the group opens without a click here (Back or Forward)", () => {
    const { rerender } = render(cardOf(closed));
    rerender(cardOf(open));
    expect(fourthService()).not.toHaveFocus();
  });

  it("leaves focus alone after a click that opens a new tab", () => {
    const { rerender } = render(cardOf(closed));
    fireEvent.click(screen.getByRole("link", { name: viewAllName }), { metaKey: true });
    rerender(cardOf(open));
    expect(fourthService()).not.toHaveFocus();
  });

  it("keeps focus on the link after Show fewer", () => {
    const { rerender } = render(cardOf(open));
    const link = screen.getByRole("link", {
      name: "Show fewer services from Riverside International Hospital",
    });
    link.focus();
    fireEvent.click(link);
    rerender(cardOf(closed));
    expect(screen.getByRole("link", { name: viewAllName })).toHaveFocus();
  });
});
