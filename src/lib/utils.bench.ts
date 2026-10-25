import { test } from "vitest";
import { cn } from "./utils";

// Sample benchmark that proves `npm run bench` works.
// Replaced by the Task 1 engine benchmark (engine.bench.ts) in WBS 3.9.
// Vitest 5 style: `bench` is a fixture on the test context, and `.run()` runs it.
// https://vitest.dev/guide/benchmarking
test("cn merges a button's classes with an override", async ({ bench }) => {
  // Vitest turns imports into getters; a local reference keeps that cost out of the numbers.
  // https://vitest.dev/guide/benchmarking#module-runner-overhead
  const merge = cn;
  const isDisabled = false;
  await bench("cn", () => {
    merge("inline-flex h-8 items-center px-2.5 text-sm", "px-4", isDisabled && "opacity-50");
  }).run();
});
