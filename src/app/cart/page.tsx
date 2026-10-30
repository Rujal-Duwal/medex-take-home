import type { Metadata } from "next";
import { NotBuiltPage } from "@/components/not-built";

// Task 2 is not built in this submission. The README's Task 2 section has the plan.
export const metadata: Metadata = { title: "Your cart" };

export default function CartPage() {
  return (
    <NotBuiltPage
      title="Your cart"
      summary="This page would let you review what you picked and pay for each type of service as its own order."
      readmeAnchor="task-2"
    />
  );
}
