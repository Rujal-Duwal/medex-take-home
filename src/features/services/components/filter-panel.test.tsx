import Big from "big.js";
import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { LiveAnnouncerProvider } from "@/lib/a11y/live-announcer";
import type { FilterOptionView, PriceFilterView } from "../filters-view";
import { FilterOption } from "./filter-option";
import { PriceFilter } from "./price-filter";
import { ProviderFilter } from "./provider-filter";
import { SearchBox } from "./search-box";

// The panel's behaviour that isn't in filters-view: what a click sends, the provider name
// search, and where focus goes in the price filter. The views are built by hand here; their
// rules are tested in filters-view.test.ts.

function option(label: string, overrides: Partial<FilterOptionView> = {}): FilterOptionView {
  return {
    id: `provider-${label}`,
    label,
    count: "3",
    isChecked: false,
    isMixed: false,
    isUnavailable: false,
    change: { kind: "provider", id: 48 },
    ...overrides,
  };
}

describe("FilterOption", () => {
  it("a click sends the option's change; its name includes the count", () => {
    const onChange = vi.fn();
    render(<FilterOption option={option("Riverside")} onChange={onChange} />);

    fireEvent.click(screen.getByRole("checkbox", { name: "Riverside 3" }));
    expect(onChange).toHaveBeenCalledWith({ kind: "provider", id: 48 });
  });

  it("an unavailable option stays focusable but a click does nothing (D5)", () => {
    const onChange = vi.fn();
    render(
      <FilterOption
        option={option("Lanna", { count: "0", isUnavailable: true })}
        onChange={onChange}
      />,
    );
    const checkbox = screen.getByRole("checkbox", { name: "Lanna 0" });

    expect(checkbox).toHaveAttribute("aria-disabled", "true");
    expect(checkbox).toBeEnabled();
    fireEvent.click(checkbox);
    expect(onChange).not.toHaveBeenCalled();
  });
});

describe("ProviderFilter", () => {
  it("the name search narrows the list, and says when nothing matches", () => {
    render(
      <ProviderFilter
        providers={[option("Riverside International Hospital"), option("Himal Hospital")]}
        onChange={vi.fn()}
      />,
    );
    const search = screen.getByRole("searchbox", { name: "Search providers" });

    fireEvent.change(search, { target: { value: "himal" } });
    expect(screen.getAllByRole("checkbox").map((box) => box.id)).toEqual([
      "provider-Himal Hospital",
    ]);

    fireEvent.change(search, { target: { value: "nowhere" } });
    expect(screen.queryAllByRole("checkbox")).toEqual([]);
    expect(screen.getByText("No providers match that name.")).toBeVisible();
  });

  it("unticking a provider with 0 moves it below the divider and keeps focus on it", () => {
    const lanna = option("Lanna", { id: "provider-50", count: "0", isChecked: true });
    const { rerender } = render(
      <ProviderFilter providers={[lanna, option("Riverside")]} onChange={vi.fn()} />,
    );
    const checkbox = screen.getByRole("checkbox", { name: "Lanna 0" });
    checkbox.focus();
    fireEvent.click(checkbox);

    // A browser drops focus when React moves the node below; jsdom doesn't, so it is dropped
    // here by hand.
    checkbox.blur();
    // The new view: Lanna is unticked, so it is unavailable and sinks to the end (D5).
    rerender(
      <ProviderFilter
        providers={[option("Riverside"), { ...lanna, isChecked: false, isUnavailable: true }]}
        onChange={vi.fn()}
      />,
    );
    expect(screen.getAllByRole("checkbox").map((box) => box.id)).toEqual([
      "provider-Riverside",
      "provider-50",
    ]);
    expect(screen.getByRole("checkbox", { name: "Lanna 0" })).toHaveFocus();
  });

  it("starts with a short list; Show all shows every provider, and Show fewer goes back", () => {
    const providers = Array.from({ length: 10 }, (_, index) => option(`Provider ${String(index)}`));
    render(<ProviderFilter providers={providers} onChange={vi.fn()} />);

    expect(screen.getAllByRole("checkbox")).toHaveLength(8);
    const toggle = screen.getByRole("button", { name: "Show all 10 providers" });
    expect(toggle).toHaveAttribute("aria-expanded", "false");

    fireEvent.click(toggle);
    expect(screen.getAllByRole("checkbox")).toHaveLength(10);
    expect(toggle).toHaveAccessibleName("Show fewer providers");
    expect(toggle).toHaveAttribute("aria-expanded", "true");

    fireEvent.click(toggle);
    expect(screen.getAllByRole("checkbox")).toHaveLength(8);
  });

  it("while a name is typed, every match shows and there is no Show all", () => {
    const providers = Array.from({ length: 10 }, (_, index) => option(`Provider ${String(index)}`));
    render(<ProviderFilter providers={providers} onChange={vi.fn()} />);

    fireEvent.change(screen.getByRole("searchbox", { name: "Search providers" }), {
      target: { value: "provider" },
    });
    expect(screen.getAllByRole("checkbox")).toHaveLength(10);
    expect(screen.queryByRole("button", { name: /Show/ })).not.toBeInTheDocument();
  });
});

describe("SearchBox", () => {
  it("follows the URL while not focused, and Back while typing", () => {
    const { rerender } = render(<SearchBox urlText="" onChange={vi.fn()} />);
    const box = screen.getByRole("searchbox", { name: "Search" });

    rerender(<SearchBox urlText="thyroid" onChange={vi.fn()} />);
    expect(box).toHaveValue("thyroid");

    // Typing, then Back from the keyboard: focus stays in the box.
    box.focus();
    fireEvent.change(box, { target: { value: "thyroid panel" } });
    window.history.pushState(null, "", "/services?q=liver");
    fireEvent(window, new PopStateEvent("popstate"));
    expect(box).toHaveValue("liver");
    window.history.replaceState(null, "", "/");
  });
});

const chooseCurrency: PriceFilterView = {
  kind: "choose-currency",
  note: "These results use more than one currency. Pick one to set a price range.",
  currencies: [
    option("THB", {
      id: "currency-THB",
      count: "1,204",
      change: { kind: "currency", currency: "THB" },
    }),
    option("INR", {
      id: "currency-INR",
      count: "0",
      isUnavailable: true,
      change: { kind: "currency", currency: "INR" },
    }),
  ],
};

const thbRange: PriceFilterView = {
  kind: "range",
  currency: "THB",
  min: "",
  max: "",
  canChangeCurrency: true,
  emptyRangeChange: { kind: "currency", currency: "THB" },
};

describe("PriceFilter", () => {
  it("picking a currency sends it, and focus moves to Min once the range shows", () => {
    const onChange = vi.fn();
    const { rerender } = render(<PriceFilter price={chooseCurrency} onChange={onChange} />, {
      wrapper: LiveAnnouncerProvider,
    });

    fireEvent.click(screen.getByRole("button", { name: "INR (0)" }));
    expect(onChange).not.toHaveBeenCalled();

    const thb = screen.getByRole("button", { name: "THB (1,204)" });
    thb.focus();
    fireEvent.click(thb);
    expect(onChange).toHaveBeenCalledWith({ kind: "currency", currency: "THB" });

    rerender(<PriceFilter price={thbRange} onChange={onChange} />);
    expect(screen.getByRole("textbox", { name: "Min (THB)" })).toHaveFocus();
  });

  it("Change currency that lands on the location's currency moves focus to Min", () => {
    // Bangkok with an NPR range: Change gives the THB range, with no Change button to keep focus.
    const onChange = vi.fn();
    const nprRange: PriceFilterView = { ...thbRange, currency: "NPR" };
    const { rerender } = render(<PriceFilter price={nprRange} onChange={onChange} />, {
      wrapper: LiveAnnouncerProvider,
    });

    const change = screen.getByRole("button", { name: "Change currency" });
    change.focus();
    fireEvent.click(change);
    expect(onChange).toHaveBeenCalledWith({ kind: "currency" });

    rerender(<PriceFilter price={{ ...thbRange, canChangeCurrency: false }} onChange={onChange} />);
    expect(screen.getByRole("textbox", { name: "Min (THB)" })).toHaveFocus();
  });

  it("Apply sends the range in the shown currency", () => {
    const onChange = vi.fn();
    render(<PriceFilter price={thbRange} onChange={onChange} />, {
      wrapper: LiveAnnouncerProvider,
    });

    fireEvent.change(screen.getByRole("textbox", { name: "Max (THB)" }), {
      target: { value: "5,000" },
    });
    fireEvent.click(screen.getByRole("button", { name: "Apply price" }));

    expect(onChange).toHaveBeenCalledExactlyOnceWith({
      kind: "price-range",
      currency: "THB",
      min: undefined,
      max: new Big(5000),
    });
  });

  it("Apply with both boxes empty sends the view's empty-range change", () => {
    const onChange = vi.fn();
    render(
      <PriceFilter
        price={{ ...thbRange, emptyRangeChange: { kind: "currency" } }}
        onChange={onChange}
      />,
      {
        wrapper: LiveAnnouncerProvider,
      },
    );

    fireEvent.click(screen.getByRole("button", { name: "Apply price" }));
    expect(onChange).toHaveBeenCalledExactlyOnceWith({ kind: "currency" });
  });

  it("a box that can't be read gets focus and its message, and nothing is sent", () => {
    const onChange = vi.fn();
    render(<PriceFilter price={thbRange} onChange={onChange} />, {
      wrapper: LiveAnnouncerProvider,
    });
    const min = screen.getByRole("textbox", { name: "Min (THB)" });

    fireEvent.change(min, { target: { value: "lots" } });
    fireEvent.click(screen.getByRole("button", { name: "Apply price" }));

    expect(onChange).not.toHaveBeenCalled();
    expect(min).toHaveFocus();
    expect(min).toHaveAttribute("aria-invalid", "true");
    expect(min).toHaveAccessibleDescription("Enter an amount in numbers, like 5000.");
  });

  it("a Max box that can't be read gets focus, and the message is read out", async () => {
    const onChange = vi.fn();
    render(<PriceFilter price={thbRange} onChange={onChange} />, {
      wrapper: LiveAnnouncerProvider,
    });
    const max = screen.getByRole("textbox", { name: "Max (THB)" });

    fireEvent.change(max, { target: { value: "5k" } });
    fireEvent.click(screen.getByRole("button", { name: "Apply price" }));

    expect(onChange).not.toHaveBeenCalled();
    expect(max).toHaveFocus();
    expect(max).toHaveAccessibleDescription("Enter an amount in numbers, like 5000.");
    await vi.waitFor(() => {
      expect(document.querySelector("output")).toHaveTextContent(
        "Enter an amount in numbers, like 5000.",
      );
    });
  });
});
