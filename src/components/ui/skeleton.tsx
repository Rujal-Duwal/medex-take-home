import { cn } from "@/lib/utils";

function Skeleton({ className, ...props }: React.ComponentProps<"div">) {
  return (
    <div
      data-slot="skeleton"
      // bg-skeleton is the handoff's skeleton token. Hidden from screen readers, so the blocks
      // are not read out one by one. The screen that shows them says "Loading" once instead,
      // with aria-busy on its results area and a line of sr-only text.
      aria-hidden="true"
      className={cn("animate-pulse rounded-md bg-skeleton", className)}
      {...props}
    />
  );
}

export { Skeleton };
