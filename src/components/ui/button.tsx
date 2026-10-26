import * as React from "react";
import { cva, type VariantProps } from "class-variance-authority";
import { cn } from "@/lib/utils";
import { Slot } from "radix-ui";

// shadcn Button, adjusted to design/HANDOFF.md:
// - every size is at least 44px tall (h-11); main actions use lg (h-12)
// - no focus ring classes here: the global :focus-visible outline in globals.css draws it
// - no dark: classes, because the app is light theme only
// - disabled is shown with muted colours (5.3:1) and cursor-not-allowed, never opacity.
//   aria-disabled gets the same look: checkout and confirm buttons stay focusable while
//   unavailable so their reason can be read, and their click handler must do nothing then.
// - aria-expanded styles are for menu triggers (the Task 1 sort menu)
const buttonVariants = cva(
  "inline-flex shrink-0 items-center justify-center gap-2 rounded-lg border border-transparent px-4 text-sm font-medium whitespace-nowrap transition-colors select-none disabled:cursor-not-allowed disabled:border-input disabled:bg-muted disabled:text-muted-foreground aria-disabled:cursor-not-allowed aria-disabled:border-input aria-disabled:bg-muted aria-disabled:text-muted-foreground [&_svg]:pointer-events-none [&_svg]:shrink-0 [&_svg:not([class*='size-'])]:size-4",
  {
    variants: {
      variant: {
        default: "bg-primary text-primary-foreground hover:bg-primary/80",
        outline:
          "border-input bg-background hover:bg-muted hover:text-foreground aria-expanded:bg-muted aria-expanded:text-foreground",
        secondary: "bg-secondary text-secondary-foreground hover:bg-secondary/80",
        ghost:
          "hover:bg-muted hover:text-foreground aria-expanded:bg-muted aria-expanded:text-foreground",
        destructive: "bg-destructive-soft text-destructive-strong hover:bg-destructive/20",
        link: "text-primary underline-offset-4 hover:underline",
      },
      size: {
        default: "h-11",
        lg: "h-12 text-base",
        icon: "size-11 px-0",
      },
    },
    defaultVariants: {
      variant: "default",
      size: "default",
    },
  },
);

function Button({
  className,
  variant = "default",
  size = "default",
  asChild = false,
  ...props
}: React.ComponentProps<"button"> &
  VariantProps<typeof buttonVariants> & {
    asChild?: boolean;
  }) {
  const Comp = asChild ? Slot.Root : "button";

  return (
    <Comp
      data-slot="button"
      data-variant={variant}
      data-size={size}
      className={cn(buttonVariants({ variant, size, className }))}
      {...props}
    />
  );
}

export { Button, buttonVariants };
