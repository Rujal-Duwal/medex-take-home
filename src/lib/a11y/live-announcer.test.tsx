import { act, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { LiveAnnouncerProvider, useAnnounce } from "./live-announcer";

function AnnounceButton({ message }: Readonly<{ message: string }>) {
  const announce = useAnnounce();
  return (
    <button
      type="button"
      onClick={() => {
        announce(message);
      }}
    >
      Announce
    </button>
  );
}

describe("LiveAnnouncerProvider", () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it("renders one empty polite status region before anything is announced", () => {
    render(<LiveAnnouncerProvider>{null}</LiveAnnouncerProvider>);
    const region = screen.getByRole("status");
    expect(region).toHaveAttribute("aria-live", "polite");
    expect(region).toBeEmptyDOMElement();
  });

  it("sets the message on the next tick, not in the same update", () => {
    render(
      <LiveAnnouncerProvider>
        <AnnounceButton message="42 services from 4 providers" />
      </LiveAnnouncerProvider>,
    );

    fireEvent.click(screen.getByRole("button", { name: "Announce" }));
    expect(screen.getByRole("status")).toBeEmptyDOMElement();

    act(() => {
      vi.runAllTimers();
    });
    expect(screen.getByRole("status")).toHaveTextContent("42 services from 4 providers");
  });

  it("announces the same message again by clearing it first", () => {
    render(
      <LiveAnnouncerProvider>
        <AnnounceButton message="3 services" />
      </LiveAnnouncerProvider>,
    );
    const button = screen.getByRole("button", { name: "Announce" });

    fireEvent.click(button);
    act(() => {
      vi.runAllTimers();
    });
    expect(screen.getByRole("status")).toHaveTextContent("3 services");

    // The second click empties the region, so the repeat counts as a change for screen readers.
    fireEvent.click(button);
    expect(screen.getByRole("status")).toBeEmptyDOMElement();
    act(() => {
      vi.runAllTimers();
    });
    expect(screen.getByRole("status")).toHaveTextContent("3 services");
  });
});
