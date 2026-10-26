import { act, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { EmptyState } from "./empty-state";
import { ErrorState } from "./error-state";
import { OfflineBanner } from "./offline-banner";

const OFFLINE_MESSAGE = "You're offline. Your cart is saved on this device.";

describe("ErrorState", () => {
  it("says what failed and calls onRetry when the customer presses Try again", () => {
    const onRetry = vi.fn();
    render(
      <ErrorState
        title="We couldn't load services"
        description="Something went wrong on our side. Your filters are saved."
        onRetry={onRetry}
      />,
    );

    expect(screen.getByRole("alert")).toHaveTextContent("We couldn't load services");
    fireEvent.click(screen.getByRole("button", { name: "Try again" }));
    expect(onRetry).toHaveBeenCalledTimes(1);
  });
});

describe("EmptyState", () => {
  it("says why it is empty and offers the way out", () => {
    render(
      <EmptyState
        title="No services match"
        description="Try removing a filter. Your other choices will stay as they are."
        action={<button type="button">Clear all filters</button>}
      />,
    );

    expect(screen.getByRole("heading", { name: "No services match" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Clear all filters" })).toBeInTheDocument();
  });
});

describe("OfflineBanner", () => {
  afterEach(() => {
    vi.restoreAllMocks();
    globalThis.history.replaceState(null, "", "/");
  });

  it("shows nothing while the browser is online", () => {
    render(<OfflineBanner message={OFFLINE_MESSAGE} />);
    expect(screen.queryByText(OFFLINE_MESSAGE)).not.toBeInTheDocument();
  });

  it("appears when the browser goes offline", () => {
    render(<OfflineBanner message={OFFLINE_MESSAGE} />);

    vi.spyOn(navigator, "onLine", "get").mockReturnValue(false);
    act(() => {
      globalThis.dispatchEvent(new Event("offline"));
    });

    expect(screen.getByText(OFFLINE_MESSAGE)).toBeInTheDocument();
  });

  it("goes away when the browser comes back online", () => {
    const onLine = vi.spyOn(navigator, "onLine", "get").mockReturnValue(false);
    render(<OfflineBanner message={OFFLINE_MESSAGE} />);
    expect(screen.getByText(OFFLINE_MESSAGE)).toBeInTheDocument();

    onLine.mockReturnValue(true);
    act(() => {
      globalThis.dispatchEvent(new Event("online"));
    });

    expect(screen.queryByText(OFFLINE_MESSAGE)).not.toBeInTheDocument();
  });

  it("appears with ?mockOffline=1 while the browser is online", () => {
    globalThis.history.replaceState(null, "", "/cart?mockOffline=1");
    render(<OfflineBanner message={OFFLINE_MESSAGE} />);

    expect(screen.getByText(OFFLINE_MESSAGE)).toBeInTheDocument();
  });
});
