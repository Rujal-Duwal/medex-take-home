import * as React from "react";
import { cva, type VariantProps } from "class-variance-authority";
import { cn } from "@/lib/utils";

// shadcn Alert, trimmed to what we use, with the variants from design/HANDOFF.md section 2.
// Sizes follow the handoff: 16px text, p-4, rounded-xl like the design's alert cards.
// No role here on purpose: the caller picks it. Errors pass role="alert" (read out at once),
// notices like the offline banner pass role="status" (read out politely).
const alertVariants = cva("grid w-full gap-1 rounded-xl border p-4 text-left text-base", {
  variants: {
    variant: {
      default: "bg-card text-card-foreground",
      // Text pairs are the checked ones from HANDOFF.md section 3: primary on secondary 6.3:1,
      // warning-foreground on warning-soft 9.7:1, destructive-strong on destructive-soft 8.1:1.
      info: "border-transparent bg-secondary text-secondary-foreground *:data-[slot=alert-description]:text-secondary-foreground",
      warning:
        "border-transparent bg-warning-soft text-warning-foreground *:data-[slot=alert-description]:text-warning-foreground",
      destructive:
        "border-transparent bg-destructive-soft text-destructive-strong *:data-[slot=alert-description]:text-destructive-strong",
    },
  },
  defaultVariants: {
    variant: "default",
  },
});

function Alert({
  className,
  variant,
  ...props
}: React.ComponentProps<"div"> & VariantProps<typeof alertVariants>) {
  return <div data-slot="alert" className={cn(alertVariants({ variant }), className)} {...props} />;
}

function AlertTitle({ className, ...props }: React.ComponentProps<"div">) {
  return <div data-slot="alert-title" className={cn("font-semibold", className)} {...props} />;
}

function AlertDescription({ className, ...props }: React.ComponentProps<"div">) {
  return (
    <div
      data-slot="alert-description"
      className={cn("text-text-secondary", className)}
      {...props}
    />
  );
}

export { Alert, AlertTitle, AlertDescription };
