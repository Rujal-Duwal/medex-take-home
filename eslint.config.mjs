import { defineConfig, globalIgnores } from "eslint/config";
import nextVitals from "eslint-config-next/core-web-vitals";
import tseslint from "typescript-eslint";
import jsxA11y from "eslint-plugin-jsx-a11y";
import sonarjs from "eslint-plugin-sonarjs";
import unicorn from "eslint-plugin-unicorn";
import promise from "eslint-plugin-promise";
import testingLibrary from "eslint-plugin-testing-library";
import prettier from "eslint-config-prettier/flat";
import { sonarWayRules, sonarWayTestRules } from "./eslint.sonar-way.mjs";

// Zero-warning quality gate (ADR 0012). The order matters: a later block overrides an earlier one.
// A rule is turned off only here, with a one-line reason, or with an eslint-disable-next-line
// comment that has a reason beside it.

// Hard rule 1 in CLAUDE.md: data only through the mock API.
// Blocks any import path that walks into the top-level data/ folder,
// for example "../../data/task1-service-explorer.json" or "@/../data/...".
// It only sees static import paths: dynamic import(), require(), absolute paths and
// fs.readFile calls get past it, so those stay a review check.
const dataFolderPattern = {
  regex: String.raw`^(\.{1,2}/)+data(/|$)|^@/\.\./data(/|$)`,
  message: "Only src/lib/mock and scripts/ may read data/. Fetch it through the mock API instead.",
};
// The modules in src/lib/mock that hold the data (task1-data.ts) are server only: a client
// component importing one would ship the whole JSON to the browser. Only src/app (route
// handlers and server pages) may import them; see the src/app block below.
const serverDataModulePattern = {
  regex: String.raw`^@/lib/mock/task\d-data$`,
  message: "Server only. Import it from a route handler or a server page in src/app.",
};
const noDataImports = ["error", { patterns: [dataFolderPattern, serverDataModulePattern] }];

const eslintConfig = defineConfig([
  // 1. Next.js: React, hooks, the Next plugin and Core Web Vitals rules.
  ...nextVitals,

  // 2. typescript-eslint's strictest sets, with type information from tsconfig.json.
  // eslint-config-next and we both use typescript-eslint 8, so npm installs one copy. If lint ever
  // fails with "Cannot redefine plugin @typescript-eslint", run `npm ls typescript-eslint`.
  tseslint.configs.strictTypeChecked,
  tseslint.configs.stylisticTypeChecked,
  {
    languageOptions: {
      parserOptions: {
        projectService: true,
        tsconfigRootDir: import.meta.dirname,
      },
    },
  },

  // 3. Accessibility and our own rules.
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
  // Route handlers and server pages may import the server-only data modules, not data/ itself.
  {
    files: ["src/app/**"],
    rules: { "no-restricted-imports": ["error", { patterns: [dataFolderPattern] }] },
  },
  // The two places allowed to read data/. flags.ts is left out: the client fetch
  // wrapper imports it, so a data/ import there would ship the JSON to the browser.
  {
    files: ["src/lib/mock/**", "scripts/**"],
    ignores: ["src/lib/mock/flags.ts"],
    rules: { "no-restricted-imports": "off" },
  },

  // 4. Sonar's code-quality rules, the same family SonarQube for IDE shows in the editor.
  sonarjs.configs.recommended,
  // The rest of SonarQube for IDE's default profile: rules Sonar takes from other plugins.
  // Only the listed rules are turned on, not each plugin's full recommended set.
  {
    plugins: { unicorn, promise },
    rules: sonarWayRules,
  },
  {
    files: ["**/*.test.{ts,tsx}"],
    plugins: { "testing-library": testingLibrary },
    rules: sonarWayTestRules,
  },

  // Plain JavaScript files (this config and the Claude Code hook) are not in tsconfig.json,
  // so they have no types to check. They are still linted by every rule that doesn't need types.
  {
    files: ["**/*.{js,mjs,cjs}"],
    extends: [tseslint.configs.disableTypeChecked],
  },

  // 5. Last, so it can turn off any style rule that would fight Prettier.
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
