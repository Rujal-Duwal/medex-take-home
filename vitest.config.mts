import { defineConfig } from "vitest/config";

// Vitest setup (ADR 0009). JSX in tests is compiled by Vite itself using
// tsconfig's "jsx": "react-jsx", so no React plugin is needed.
export default defineConfig({
  resolve: {
    // Read the @/* alias from tsconfig.json so it is defined in one place.
    tsconfigPaths: true,
  },
  test: {
    // jsdom gives component tests a DOM. Pure logic tests run in it too; they just don't use it.
    environment: "jsdom",
    setupFiles: ["./vitest.setup.ts"],
    include: ["src/**/*.test.{ts,tsx}", "scripts/**/*.test.ts"],
    benchmark: {
      include: ["src/**/*.bench.ts"],
    },
  },
});
