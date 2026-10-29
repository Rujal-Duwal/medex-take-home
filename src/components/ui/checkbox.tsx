"use client";

import * as React from "react";
import { Checkbox as CheckboxPrimitive } from "radix-ui";
import { cn } from "@/lib/utils";

// shadcn Checkbox, adjusted to design/HANDOFF.md (18px box, 4px radius, 1.5px border):
// - the icons are inline SVG, so lucide-react isn't needed (the CLI also adds a stray "cn"
//   package; it was removed again, as in WBS 2.4)
// - no focus ring classes: the global :focus-visible outline in globals.css draws it
// - no dark: classes, because the app is light theme only
// - checked="indeterminate" draws a dash: the Task 1 category tree uses it when some of a
//   category's subcategories are chosen
// - aria-disabled is muted but stays focusable, so a screen reader can still reach an option
//   with 0 results and hear why. The caller's onCheckedChange must do nothing then.
function Checkbox({ className, ...props }: React.ComponentProps<typeof CheckboxPrimitive.Root>) {
  return (
    <CheckboxPrimitive.Root
      data-slot="checkbox"
      className={cn(
        "peer flex size-[18px] shrink-0 items-center justify-center rounded-sm border-[1.5px] border-input bg-card transition-colors data-[state=checked]:border-primary data-[state=checked]:bg-primary data-[state=checked]:text-primary-foreground data-[state=indeterminate]:border-primary data-[state=indeterminate]:bg-primary data-[state=indeterminate]:text-primary-foreground disabled:cursor-not-allowed disabled:border-muted-foreground disabled:bg-muted aria-disabled:cursor-not-allowed aria-disabled:border-muted-foreground aria-disabled:bg-muted",
        className,
      )}
      {...props}
    >
      <CheckboxPrimitive.Indicator data-slot="checkbox-indicator">
        <svg
          aria-hidden="true"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="3.5"
          strokeLinecap="round"
          strokeLinejoin="round"
          className="size-3"
        >
          {props.checked === "indeterminate" ? <path d="M6 12h12" /> : <path d="M20 6 9 17l-5-5" />}
        </svg>
      </CheckboxPrimitive.Indicator>
    </CheckboxPrimitive.Root>
  );
}

export { Checkbox };
