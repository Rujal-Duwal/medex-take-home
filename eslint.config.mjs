import { defineConfig, globalIgnores } from "eslint/config";
import nextVitals from "eslint-config-next/core-web-vitals";
import nextTs from "eslint-config-next/typescript";
import jsxA11y from "eslint-plugin-jsx-a11y";
import prettier from "eslint-config-prettier/flat";

// Hard rule 1 in CLAUDE.md: data only through the mock API.
// Blocks any import path that walks into the top-level data/ folder,
// for example "../../data/task1-service-explorer.json" or "@/../data/...".
// It only sees static import paths: dynamic import(), require(), absolute paths and
// fs.readFile calls get past it, so those stay a review check.
const noDataImports = [
  "error",
  {
    patterns: [
      {
        regex: "^(\\.{1,2}/)+data(/|$)|^@/\\.\\./data(/|$)",
        message:
          "Only src/lib/mock and scripts/ may read data/. Fetch it through the mock API instead.",
      },
    ],
  },
];

const eslintConfig = defineConfig([
  ...nextVitals,
  ...nextTs,

  {
    files: ["**/*.{js,jsx,mjs,ts,tsx,mts,cts}"],
    rules: {
      // Next registers the jsx-a11y plugin but turns on only a few of its rules.
      // Turn on the full recommended set. Only the rules are added: registering the
      // plugin a second time would make ESLint fail with "Cannot redefine plugin".
      ...jsxA11y.flatConfigs.recommended.rules,
      "no-restricted-imports": noDataImports,
    },
  },
  // The two places allowed to read data/. flags.ts is left out: the client fetch
  // wrapper imports it, so a data/ import there would ship the JSON to the browser.
  {
    files: ["src/lib/mock/**", "scripts/**"],
    ignores: ["src/lib/mock/flags.ts"],
    rules: { "no-restricted-imports": "off" },
  },

  // Last, so it can turn off any style rule that would fight Prettier.
  prettier,

  globalIgnores([
    // Default ignores of eslint-config-next:
    ".next/**",
    "out/**",
    "build/**",
    "next-env.d.ts",
    // Ours:
    "coverage/**",
    "data/**",
    "design/**",
  ]),
]);

export default eslintConfig;
