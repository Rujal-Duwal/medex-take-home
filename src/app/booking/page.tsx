import type { Metadata } from "next";
import { NotBuiltPage } from "@/components/not-built";

// Task 3 is not built in this submission. The README's Task 3 section has the plan.
export const metadata: Metadata = { title: "Book an appointment" };

export default function BookingPage() {
  return (
    <NotBuiltPage
      title="Book an appointment"
      summary="This page would let you pick a specialist and a time, shown in the clinic's time and yours."
      readmeAnchor="task-3"
    />
  );
}
