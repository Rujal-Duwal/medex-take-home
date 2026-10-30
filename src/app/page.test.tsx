import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import HomePage from "./page";

describe("HomePage", () => {
  it("links to the three tasks, one link and one heading each", () => {
    render(<HomePage />);

    expect(screen.getByRole("heading", { level: 1 })).toBeInTheDocument();
    expect(screen.getAllByRole("heading", { level: 2 })).toHaveLength(3);
    expect(screen.getAllByRole("link")).toHaveLength(3);
    expect(screen.getByRole("link", { name: "Services" })).toHaveAttribute("href", "/services");
    expect(screen.getByRole("link", { name: "Your cart" })).toHaveAttribute("href", "/cart");
    expect(screen.getByRole("link", { name: "Book an appointment" })).toHaveAttribute(
      "href",
      "/booking",
    );
  });

  it("labels the cart and booking as not built, and only those", () => {
    render(<HomePage />);

    const labels = screen.getAllByText("Not built in this submission");
    expect(labels).toHaveLength(2);
    expect(labels[0]?.closest("li")).toHaveTextContent("Your cart");
    expect(labels[1]?.closest("li")).toHaveTextContent("Book an appointment");
  });
});
