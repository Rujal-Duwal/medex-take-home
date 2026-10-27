import type { Metadata } from "next";
import Link from "next/link";

// Placeholder until the cart is built in WBS 4.x.
export const metadata: Metadata = { title: "Your cart" };

export default function CartPage() {
  return (
    <div className="mx-auto flex w-full max-w-3xl flex-col items-start gap-4 px-4 py-10 md:px-6">
      <h1 className="text-2xl font-semibold md:text-3xl">Your cart</h1>
      <p className="text-text-secondary">This page is not ready yet.</p>
      <Link
        href="/"
        className="inline-flex min-h-11 items-center font-medium text-primary underline underline-offset-4"
      >
        Back to home
      </Link>
    </div>
  );
}
