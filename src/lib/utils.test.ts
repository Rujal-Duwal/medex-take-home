import { describe, expect, it } from "vitest";
import { cn } from "./utils";

describe("cn", () => {
  it("keeps the later class when two Tailwind classes clash", () => {
    expect(cn("px-2 py-1", "px-4")).toBe("py-1 px-4");
  });

  it("drops false, null and undefined so conditional classes read naturally", () => {
    const tabClasses = (isActive: boolean) =>
      cn("rounded", isActive && "bg-primary", null, undefined);
    expect(tabClasses(false)).toBe("rounded");
    expect(tabClasses(true)).toBe("rounded bg-primary");
  });
});
