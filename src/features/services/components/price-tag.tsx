import type { PriceView } from "../results-view";

// PriceTag from design/HANDOFF.md: fixed, discounted, "From" (wellness) and Free.
// The texts come ready-made from results-view.ts; this only lays them out.
// tabular-nums keeps digits the same width, so prices line up and don't shift when they change.

function OriginalPrice({ amount }: Readonly<{ amount: string }>) {
  // Screen readers don't announce strike-through, so the struck price says what it is.
  return (
    <s className="text-sm text-muted-foreground">
      <span className="sr-only">Original price </span>
      {amount}
    </s>
  );
}

export function PriceTag({ price }: Readonly<{ price: PriceView }>) {
  if (price.kind === "free") {
    return <strong className="font-semibold text-success">Free</strong>;
  }
  if (price.kind === "from") {
    return (
      <span className="flex flex-col items-end tabular-nums">
        <span>
          <span className="text-muted-foreground">From </span>
          <strong className="font-semibold">{price.lowest}</strong>
          <span className="text-muted-foreground">, {price.duration}</span>
        </span>
        {price.original && <OriginalPrice amount={price.original} />}
      </span>
    );
  }
  return (
    <span className="flex flex-col items-end tabular-nums">
      <strong className="font-semibold">{price.final}</strong>
      {price.original && <OriginalPrice amount={price.original} />}
    </span>
  );
}
