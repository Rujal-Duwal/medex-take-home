import Link from "next/link";
import type { ProviderGroupView, RatingView } from "../results-view";
import { PriceTag } from "./price-tag";

function ProviderRating({ rating }: Readonly<{ rating: RatingView }>) {
  if (rating.kind === "new") {
    return (
      <span className="self-start rounded-full bg-muted px-2.5 py-1 text-sm font-medium">
        New, no reviews yet
      </span>
    );
  }
  // The star is decoration; screen readers hear "Rated 4.7 out of 5 (1,203 reviews)".
  return (
    <p className="flex items-baseline gap-1.5 text-sm">
      <span aria-hidden="true" className="text-warning">
        ★
      </span>
      <span className="sr-only">Rated </span>
      <strong className="text-base font-semibold tabular-nums">{rating.stars}</strong>
      <span className="sr-only"> out of 5</span>
      <span className="text-muted-foreground tabular-nums">({rating.reviews})</span>
    </p>
  );
}

// One provider and its first matching services (T1-01, T1-02).
// headingLevel is 4 when the card sits under a "Prices in THB" heading, so headings nest.
export function ProviderGroupCard({
  group,
  headingLevel,
}: Readonly<{ group: ProviderGroupView; headingLevel: 3 | 4 }>) {
  const Heading = headingLevel === 3 ? "h3" : "h4";
  return (
    <article className="flex flex-col rounded-xl border bg-card px-4 pt-4">
      <header className="flex flex-col gap-1 border-b pb-3">
        <Heading className="text-lg font-semibold">{group.name}</Heading>
        <p className="text-sm text-muted-foreground">{group.place}</p>
        <ProviderRating rating={group.rating} />
      </header>
      <ul>
        {group.services.map((service) => (
          <li
            key={service.id}
            className="flex items-start justify-between gap-6 border-b border-muted py-3 last:border-b-0"
          >
            <div className="flex flex-col items-start gap-1">
              <span className="font-medium">{service.title}</span>
              <span className="rounded-md border px-2 py-0.5 text-xs font-medium text-text-secondary">
                {service.typeLabel}
              </span>
            </div>
            <PriceTag price={service.price} />
          </li>
        ))}
      </ul>
      {/* A link, not a button: the open groups live in the URL (D10), so it works before the
          client has taken over, and back and forward restore it. scroll={false} keeps the card
          where it is. "Show fewer" is the same link in the same place, so focus stays on it. */}
      {group.toggle && (
        <div className="flex min-h-13 items-center border-t">
          <Link
            href={group.toggle.href}
            scroll={false}
            className="inline-flex min-h-11 items-center font-medium text-primary underline-offset-4 hover:underline"
          >
            {group.toggle.label}
          </Link>
        </div>
      )}
    </article>
  );
}
