import Link from "next/link";

// One entry per task. The name matches the h1 of the page it opens. The link text is the
// name only, so a screen reader's link list stays short; the description sits beside it.
const tasks = [
  {
    href: "/services",
    name: "Services",
    description: "Search and filter health checks, tests and wellness from every provider.",
  },
  {
    href: "/cart",
    name: "Your cart",
    description: "Review what you picked and pay for each type of service as its own order.",
  },
  {
    href: "/booking",
    name: "Book an appointment",
    description: "Pick a specialist and a time, shown in the clinic's time and yours.",
  },
] as const;

export default function HomePage() {
  return (
    <div className="mx-auto flex w-full max-w-3xl flex-col gap-8 px-4 py-10 md:px-6">
      <header className="flex flex-col gap-2">
        <h1 className="text-2xl font-semibold md:text-3xl">MedEx take-home</h1>
        <p className="text-text-secondary">Three parts of a health services marketplace.</p>
      </header>
      <ul className="flex flex-col gap-4">
        {tasks.map((task) => (
          <li key={task.href} className="flex flex-col gap-1 rounded-xl border bg-card p-6">
            {/* A heading per card, so screen reader users can jump between the three tasks.
                min-h-11 keeps the link a 44px target even though it is plain text. */}
            <h2 className="text-lg font-semibold">
              <Link
                href={task.href}
                className="inline-flex min-h-11 items-center text-primary underline underline-offset-4"
              >
                {task.name}
              </Link>
            </h2>
            <p className="text-text-secondary">{task.description}</p>
          </li>
        ))}
      </ul>
    </div>
  );
}
