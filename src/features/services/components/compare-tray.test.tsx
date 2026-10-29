import { fireEvent, render, screen, within } from "@testing-library/react";
import { useRef, useState } from "react";
import { describe, expect, it, vi } from "vitest";
import { LiveAnnouncerProvider } from "@/lib/a11y/live-announcer";
import { parseMoney, type Currency } from "@/lib/money/money";
import { toCompareTrayView } from "../compare";
import { defaultQuery } from "../engine";
import type { Catalogue, Provider, Service } from "../types";
import { CompareTray } from "./compare-tray";

// The tray and the comparison, with the compare list kept in state instead of the URL: the
// focus moves and the announcements are the point here. compare.test.ts covers what each
// column shows.

function provider(id: number, name: string, currency: Currency): Provider {
  return {
    id,
    name,
    currency,
    city: { slug: "bangkok", name: "Bangkok" },
    country: { code: "TH", name: "Thailand" },
    rating: { kind: "new" },
  };
}

function service(id: string, owner: Provider, amount: string): Service {
  const final = parseMoney(amount, owner.currency);
  return {
    id,
    title: `Service ${id}`,
    type: "package",
    providerId: owner.id,
    categoryKey: "other",
    testAtHome: false,
    price: { kind: "fixed", final },
    payableAmounts: [final],
    search: { title: `service ${id}`, category: "", provider: "" },
  };
}

const riverside = provider(48, "Riverside International Hospital", "THB");
const chaoPhraya = provider(52, "Chao Phraya Hospital", "THB");
const himal = provider(70, "Himal Hospital", "NPR");
const catalogue: Catalogue = {
  categories: [],
  providers: [riverside, chaoPhraya, himal],
  services: [
    service("1", riverside, "1200.00"),
    service("2", chaoPhraya, "2500.00"),
    service("3", himal, "3000.00"),
  ],
};

// "Go to" stands in for the browser's Back and Forward: it sets the list from outside the
// comparison, as a URL change would.
function Harness({
  initialIds,
  elsewhereIds = [],
}: Readonly<{ initialIds: number[]; elsewhereIds?: number[] }>) {
  const [ids, setIds] = useState(initialIds);
  const resultsRef = useRef<HTMLElement>(null);
  return (
    <LiveAnnouncerProvider>
      <section ref={resultsRef} tabIndex={-1} aria-label="Results" />
      <button
        type="button"
        onClick={() => {
          setIds(elsewhereIds);
        }}
      >
        Go elsewhere
      </button>
      <button
        type="button"
        onClick={() => {
          setIds(initialIds);
        }}
      >
        Go back to the start
      </button>
      <CompareTray
        tray={toCompareTrayView(catalogue, ids)}
        loaded={{
          catalogue,
          urlState: { query: defaultQuery, compareProviderIds: ids },
          chips: [],
        }}
        onCompareChange={setIds}
        onTrayGone={() => resultsRef.current?.focus()}
      />
    </LiveAnnouncerProvider>
  );
}

// The stand-ins for Back and Forward sit behind the modal comparison, which hides them from
// the accessibility tree (with no names), as it does the rest of the page. So they are found by
// their text.
function goButton(text: string): HTMLElement {
  return screen.getByText(text, { selector: "button" });
}

function liveRegion(): HTMLElement {
  const region = document.querySelector("output");
  if (region === null) throw new Error("the live region is missing");
  return region;
}

function columnNames(): string[] {
  const table = screen.getByRole("table");
  return within(table)
    .getAllByRole("columnheader")
    .map((header) => header.textContent);
}

function stayOnPage(event: MouseEvent) {
  event.preventDefault();
}

function openComparison(initialIds: number[]) {
  render(<Harness initialIds={initialIds} />);
  const compare = screen.getByRole("button", { name: `Compare (${String(initialIds.length)})` });
  fireEvent.click(compare);
  return { compare, dialog: screen.getByRole("dialog") };
}

describe("CompareTray", () => {
  it("shows a chip per provider, the hint and Compare (N)", () => {
    render(<Harness initialIds={[48, 52, 70]} />);
    const tray = screen.getByRole("region", { name: "Compare tray" });
    expect(
      within(tray).getByRole("button", { name: "Remove Chao Phraya Hospital from compare" }),
    ).toBeVisible();
    expect(within(tray).getByText("You can compare up to 3")).toBeVisible();
    expect(within(tray).getByRole("button", { name: "Compare (3)" })).toBeVisible();
  });

  it("removing a chip moves focus to the chip in its place, the last one to the results", () => {
    render(<Harness initialIds={[48, 52]} />);
    fireEvent.click(
      screen.getByRole("button", { name: "Remove Riverside International Hospital from compare" }),
    );
    expect(
      screen.getByRole("button", { name: "Remove Chao Phraya Hospital from compare" }),
    ).toHaveFocus();

    fireEvent.click(
      screen.getByRole("button", { name: "Remove Chao Phraya Hospital from compare" }),
    );
    expect(screen.queryByRole("region", { name: "Compare tray" })).not.toBeInTheDocument();
    expect(screen.getByRole("region", { name: "Results" })).toHaveFocus();
  });

  it("removing the last chip in the row moves focus to Clear", () => {
    render(<Harness initialIds={[48, 52]} />);
    fireEvent.click(
      screen.getByRole("button", { name: "Remove Chao Phraya Hospital from compare" }),
    );
    expect(screen.getByRole("button", { name: "Clear" })).toHaveFocus();
  });

  it("Clear empties the tray and moves focus to the results", () => {
    render(<Harness initialIds={[48, 52]} />);
    fireEvent.click(screen.getByRole("button", { name: "Clear" }));
    expect(screen.queryByRole("region", { name: "Compare tray" })).not.toBeInTheDocument();
    expect(screen.getByRole("region", { name: "Results" })).toHaveFocus();
  });
});

describe("The comparison", () => {
  it("opens with focus on its heading and a column per provider, in the order picked", () => {
    const { dialog } = openComparison([70, 48]);
    expect(within(dialog).getByRole("heading", { name: "Compare 2 providers" })).toHaveFocus();
    expect(columnNames()).toEqual(["Himal Hospital", "Riverside International Hospital"]);
    expect(within(dialog).getByRole("rowheader", { name: "Rating" })).toBeVisible();
  });

  it("says prices stay in each provider's currency when they are mixed", () => {
    const { dialog } = openComparison([70, 48]);
    expect(within(dialog).getByText(/Prices are in each provider's own currency/)).toBeVisible();
  });

  it("Esc closes it and puts focus back on Compare (N)", async () => {
    const { compare, dialog } = openComparison([48, 52]);
    fireEvent.keyDown(dialog, { key: "Escape" });
    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
    await vi.waitFor(() => {
      expect(compare).toHaveFocus();
    });
  });

  it("removing a provider moves focus to the heading, says so, and Undo puts it back in place", async () => {
    const { dialog } = openComparison([48, 52, 70]);
    fireEvent.click(
      within(dialog).getByRole("button", {
        name: "Remove Chao Phraya Hospital from the comparison",
      }),
    );

    expect(within(dialog).getByRole("heading", { name: "Compare 2 providers" })).toHaveFocus();
    expect(columnNames()).toEqual(["Riverside International Hospital", "Himal Hospital"]);
    expect(
      within(dialog).getByText("Chao Phraya Hospital was removed from the comparison."),
    ).toBeVisible();
    await vi.waitFor(() => {
      expect(liveRegion()).toHaveTextContent(
        "Chao Phraya Hospital was removed from the comparison.",
      );
    });

    fireEvent.click(within(dialog).getByRole("button", { name: "Undo" }));
    expect(columnNames()).toEqual([
      "Riverside International Hospital",
      "Chao Phraya Hospital",
      "Himal Hospital",
    ]);
    expect(within(dialog).getByRole("heading", { name: "Compare 3 providers" })).toHaveFocus();
    expect(within(dialog).queryByRole("button", { name: "Undo" })).not.toBeInTheDocument();
  });

  it("with 1 left it asks for another, and removing the last closes it with focus on the results", async () => {
    const { dialog } = openComparison([48, 52]);
    fireEvent.click(
      within(dialog).getByRole("button", {
        name: "Remove Chao Phraya Hospital from the comparison",
      }),
    );
    expect(within(dialog).getByText("Pick at least one more to compare")).toBeVisible();
    await vi.waitFor(() => {
      expect(liveRegion()).toHaveTextContent(
        "Chao Phraya Hospital was removed from the comparison. Pick at least one more to compare.",
      );
    });

    fireEvent.click(
      within(dialog).getByRole("button", {
        name: "Remove Riverside International Hospital from the comparison",
      }),
    );
    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
    await vi.waitFor(() => {
      expect(screen.getByRole("region", { name: "Results" })).toHaveFocus();
    });
  });

  it("Back to results closes it and puts focus back on Compare (N)", async () => {
    const { compare, dialog } = openComparison([48, 52]);
    fireEvent.click(within(dialog).getByRole("button", { name: "Back to results" }));
    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
    await vi.waitFor(() => {
      expect(compare).toHaveFocus();
    });
  });

  it("closes when the list empties from outside (Back), and Forward doesn't reopen it", async () => {
    openComparison([48, 52]);
    fireEvent.click(goButton("Go elsewhere"));
    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
    await vi.waitFor(() => {
      expect(screen.getByRole("region", { name: "Results" })).toHaveFocus();
    });

    fireEvent.click(goButton("Go back to the start"));
    expect(screen.getByRole("region", { name: "Compare tray" })).toBeVisible();
    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
  });

  it("offers Undo only while it would work", () => {
    render(<Harness initialIds={[48, 52, 70]} elsewhereIds={[48, 52, 70]} />);
    fireEvent.click(screen.getByRole("button", { name: "Compare (3)" }));
    const dialog = screen.getByRole("dialog");
    fireEvent.click(
      within(dialog).getByRole("button", {
        name: "Remove Chao Phraya Hospital from the comparison",
      }),
    );
    expect(within(dialog).getByRole("button", { name: "Undo" })).toBeVisible();

    // Forward brings Chao Phraya back: there is nothing to undo.
    fireEvent.click(goButton("Go elsewhere"));
    expect(
      within(dialog).getByText("Chao Phraya Hospital was removed from the comparison."),
    ).toBeVisible();
    expect(within(dialog).queryByRole("button", { name: "Undo" })).not.toBeInTheDocument();
  });

  it("View services closes the comparison and puts focus back on Compare (N)", async () => {
    const { dialog } = openComparison([48, 52]);
    const link = within(dialog).getByRole("link", {
      name: "View services at Chao Phraya Hospital",
    });
    expect(link).toHaveAttribute("href", "/services?provider=52&open=52&compare=48%2C52");
    // jsdom can't follow a link. Stopped on the document, after React has handled the click,
    // so Radix still sees a click it should close on.
    document.addEventListener("click", stayOnPage);
    fireEvent.click(link);
    document.removeEventListener("click", stayOnPage);
    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
    await vi.waitFor(() => {
      expect(screen.getByRole("button", { name: "Compare (2)" })).toHaveFocus();
    });
  });
});
