import { render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { NoResults } from "./no-results";

describe("NoResults", () => {
  it("with nothing to remove, says there is nothing to show and offers no button", () => {
    render(<NoResults waysOut={[]} isEnabled onChange={vi.fn()} onWayOut={vi.fn()} />);

    expect(screen.getByRole("heading", { name: "No services to show" })).toBeVisible();
    expect(screen.getByText(/Please check back later/)).toBeVisible();
    expect(screen.queryByRole("button")).not.toBeInTheDocument();
  });
});
