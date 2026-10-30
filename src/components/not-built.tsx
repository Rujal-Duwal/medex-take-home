import Link from "next/link";

// Tasks 2 and 3 are not built in this submission. The home page and both placeholder pages use
// this label, so they always say the same thing.
export const NOT_BUILT_LABEL = "Not built in this submission";

// The README explains why and how each task would be built. The repo is private, so the link
// works for anyone it has been shared with. Anchors are GitHub's slugs for the "### Task 2" and
// "### Task 3" headings; rename a heading there and the link must change here.
const README_URL = "https://github.com/Rujal-Duwal/medex-take-home#";

export function NotBuiltBadge() {
  return (
    <span className="self-start rounded-md bg-warning-soft px-2 py-0.5 text-sm font-medium text-warning-foreground">
      {NOT_BUILT_LABEL}
    </span>
  );
}

interface NotBuiltPageProps {
  title: string;
  // What the page would do, in the customer's words.
  summary: string;
  readmeAnchor: "task-2" | "task-3";
}

export function NotBuiltPage({ title, summary, readmeAnchor }: Readonly<NotBuiltPageProps>) {
  return (
    <div className="mx-auto flex w-full max-w-3xl flex-col items-start gap-4 px-4 py-10 md:px-6">
      <h1 className="text-2xl font-semibold md:text-3xl">{title}</h1>
      <NotBuiltBadge />
      <p className="text-text-secondary">{summary}</p>
      <p className="text-text-secondary">
        I chose to finish the service explorer fully rather than hand in three half-done tasks. The
        plan for this one is written up in the README.
      </p>
      <a
        href={`${README_URL}${readmeAnchor}`}
        className="inline-flex min-h-11 items-center font-medium text-primary underline underline-offset-4"
      >
        Why it isn&apos;t built, and how it would be
      </a>
      <Link
        href="/"
        className="inline-flex min-h-11 items-center font-medium text-primary underline underline-offset-4"
      >
        Back to home
      </Link>
    </div>
  );
}
