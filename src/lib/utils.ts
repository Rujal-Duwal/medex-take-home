import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";

// Joins class names, and when two Tailwind classes clash (px-2 and px-4), keeps the last one.
// Used by every shadcn component so callers can override a component's default classes.
export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}
