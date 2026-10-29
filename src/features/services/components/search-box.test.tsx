import { act, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi, type Mock } from "vitest";
import type { FilterChange } from "../filter-changes";
import { SEARCH_SEND_INTERVAL_MS, SearchBox } from "./search-box";

// Typing is sent on at most once every 250 ms, so the explorer's history writes stay under
// Safari's limit (WBS 3.9).

function renderSearchBox() {
  const onChange = vi.fn<(change: FilterChange) => void>();
  render(<SearchBox id="search" urlText="" onChange={onChange} />);
  const box = screen.getByRole("searchbox", { name: "Search" });
  // Typing happens in a focused box; unfocused, the box follows the URL instead.
  fireEvent.focus(box);
  return { onChange, box };
}

// The texts sent so far. The box only ever sends search changes.
function sentTexts(onChange: Mock<(change: FilterChange) => void>): string[] {
  return onChange.mock.calls.map(([change]) => (change.kind === "search" ? change.text : ""));
}

beforeEach(() => {
  vi.useFakeTimers();
});

afterEach(() => {
  vi.useRealTimers();
});

describe("SearchBox", () => {
  it("sends the first letter at once, then the latest text once every 250 ms", () => {
    const { onChange, box } = renderSearchBox();

    fireEvent.change(box, { target: { value: "t" } });
    expect(sentTexts(onChange)).toEqual(["t"]);

    fireEvent.change(box, { target: { value: "th" } });
    fireEvent.change(box, { target: { value: "thy" } });
    // The box shows every letter straight away; only the change waits.
    expect(box).toHaveValue("thy");
    expect(sentTexts(onChange)).toEqual(["t"]);

    act(() => {
      vi.advanceTimersByTime(SEARCH_SEND_INTERVAL_MS);
    });
    expect(sentTexts(onChange)).toEqual(["t", "thy"]);
  });

  it("sends a letter at once when 250 ms have passed since the last one sent", () => {
    const { onChange, box } = renderSearchBox();
    fireEvent.change(box, { target: { value: "t" } });
    act(() => {
      vi.advanceTimersByTime(SEARCH_SEND_INTERVAL_MS);
    });

    fireEvent.change(box, { target: { value: "th" } });
    expect(sentTexts(onChange)).toEqual(["t", "th"]);
  });

  it("sends the waiting text at once when focus leaves the box", () => {
    const { onChange, box } = renderSearchBox();
    fireEvent.change(box, { target: { value: "t" } });
    fireEvent.change(box, { target: { value: "thyroid" } });

    fireEvent.blur(box);
    expect(sentTexts(onChange)).toEqual(["t", "thyroid"]);

    // Nothing is left to send when the time is up.
    act(() => {
      vi.advanceTimersByTime(SEARCH_SEND_INTERVAL_MS);
    });
    expect(sentTexts(onChange)).toEqual(["t", "thyroid"]);
  });

  it("sends nothing after the box is gone", () => {
    const onChange = vi.fn<(change: FilterChange) => void>();
    const { unmount } = render(<SearchBox id="search" urlText="" onChange={onChange} />);
    const box = screen.getByRole("searchbox", { name: "Search" });
    fireEvent.focus(box);
    fireEvent.change(box, { target: { value: "t" } });
    fireEvent.change(box, { target: { value: "thyroid" } });

    unmount();
    vi.advanceTimersByTime(SEARCH_SEND_INTERVAL_MS);
    expect(sentTexts(onChange)).toEqual(["t"]);
  });

  it("drops the waiting text on Back, so the address bar wins", () => {
    const { onChange, box } = renderSearchBox();
    fireEvent.change(box, { target: { value: "t" } });
    fireEvent.change(box, { target: { value: "thyroid" } });

    act(() => {
      globalThis.dispatchEvent(new PopStateEvent("popstate"));
      vi.advanceTimersByTime(SEARCH_SEND_INTERVAL_MS);
    });
    expect(sentTexts(onChange)).toEqual(["t"]);
  });
});
