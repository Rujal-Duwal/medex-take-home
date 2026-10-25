// Rules that SonarQube for IDE turns on in its default "Sonar way" profile but that
// eslint-plugin-sonarjs's recommended config does not ship, because Sonar takes them from
// other plugins. Turning them on here makes `npm run lint` report what the editor reports
// (ADR 0012). Each rule has its Sonar key and title above it; options are Sonar's defaults.
//
// How this list was made (2026-10-25): the "ESLint rules" and "Improved ESLint rules" tables in
// node_modules/eslint-plugin-sonarjs/README.md, kept only where the rule's metadata in
// SonarSource/SonarJS lists "Sonar way". Angular and Vue rules are left out: not in this stack.
// To refresh it after upgrading eslint-plugin-sonarjs, repeat those two steps.

/** 137 rules for all source files. */
export const sonarWayRules = {
  // ----- ESLint core (Sonar runs these; we never turned on eslint:recommended) -----
  // S3854 "super()" should be invoked appropriately
  "constructor-super": "error",
  // S4275 Getters and setters should access the expected fields
  "getter-return": ["error", { allowImplicit: false }],
  // S107 Functions should not have too many parameters
  "max-params": ["error", { max: 7 }],
  // S2430 Constructor names should start with an upper case letter
  "new-cap": ["error", { newIsCap: true, capIsNew: false, properties: false }],
  // S9382 Promises should not be awaited sequentially in a loop
  "no-await-in-loop": "error",
  // S2685 "arguments.caller" and "arguments.callee" should not be used
  "no-caller": "error",
  // S6836 "case" and "default" clauses should not contain lexical declarations
  "no-case-declarations": "error",
  // S6638 Binary expressions should not always return the same value
  "no-constant-binary-expression": "error",
  // S6635 Constructors should not return values
  "no-constructor-return": "error",
  // S1536 Function argument names should be unique
  "no-dupe-args": "error",
  // S1534 Member names should not be duplicated within a class or object literal
  "no-dupe-keys": "error",
  // S108 Nested blocks of code should not be left empty
  "no-empty": ["error", { allowEmptyCatch: true }],
  // S3799 Destructuring patterns should not be empty
  "no-empty-pattern": ["error", { allowObjectPatternsAsParameters: true }],
  // S6643 Prototypes of builtin objects should not be modified
  "no-extend-native": "error",
  // S6637 Unnecessary calls to ".bind()" should not be used
  "no-extra-bind": "error",
  // S6509 Extra boolean casts should be removed
  "no-extra-boolean-cast": "error",
  // S6522 Import variables should not be reassigned
  "no-import-assign": "error",
  // S1199 Nested code blocks should not be used
  "no-lone-blocks": "error",
  // S6660 If statements should not be the only statement in else blocks
  "no-lonely-if": "error",
  // S6534 Numbers should not lose precision
  "no-loss-of-precision": "error",
  // S1516 Multiline string literals should not be used
  "no-multi-str": "error",
  // S3834 "new" operator should not be used with Symbol and BigInt
  "no-new-native-nonconstructor": "error",
  // S1314 Octal values should not be used
  "no-octal": "error",
  // S6657 Octal escape sequences should not be used
  "no-octal-escape": "error",
  // S6654 __proto__ property should not be used
  "no-proto": "error",
  // S1656 Variables should not be self-assigned
  "no-self-assign": "error",
  // S6679 "Number.isNaN()" should be used to check for "NaN" value
  "no-self-compare": "error",
  // S878 Comma operator should not be used
  "no-sequences": "error",
  // S2432 Setters should not return values
  "no-setter-return": "error",
  // S3696 Literals should not be thrown
  "no-throw-literal": "error",
  // S6645 Variables should not be initialized to undefined
  "no-undef-init": "error",
  // S2189 Loops should not be infinite
  "no-unmodified-loop-condition": "error",
  // S6644 Ternary operator should not be used instead of simpler alternatives
  "no-unneeded-ternary": ["error", { defaultAssignment: false }],
  // S1763 All code should be reachable
  "no-unreachable": "error",
  // S1751 Loops with at most one iteration should be refactored
  "no-unreachable-loop": "error",
  // S1143 Jump statements should not occur in "finally" blocks
  "no-unsafe-finally": "error",
  // S3812 Parentheses should be used when negating "in" and "instanceof" operations
  "no-unsafe-negation": "error",
  // S6523 Optional chaining should not be used if returning "undefined" throws an error
  "no-unsafe-optional-chaining": "error",
  // S1068 Unused private class members should be removed
  "no-unused-private-class-members": "error",
  // S6676 Calls to ".call()" and ".apply()" methods should not be redundant
  "no-useless-call": "error",
  // S6647 Unnecessary constructors should be removed
  "no-useless-constructor": "error",
  // S6535 Unnecessary character escapes should be removed
  "no-useless-escape": "error",
  // S6650 Renaming import, export, and destructuring assignments should not be to the same name
  "no-useless-rename": "error",
  // S1321 "with" statements should not be used
  "no-with": "error",
  // S6653 Use Object.hasOwn static method instead of hasOwnProperty
  "prefer-object-has-own": "error",
  // S6661 Object spread syntax should be used instead of "Object.assign"
  "prefer-object-spread": "error",
  // S6325 Regular expression literals should be used when possible
  "prefer-regex-literals": "error",
  // S2688 "NaN" should not be used in comparisons
  "use-isnan": "error",
  // S4125 "typeof" expressions should only be compared to valid values
  "valid-typeof": "error",
  // ----- typescript-eslint (not in strictTypeChecked or stylisticTypeChecked) -----
  // S1788 Function parameters with default values should be last
  "@typescript-eslint/default-param-last": "error",
  // S2814 Variables and functions should not be redeclared
  "@typescript-eslint/no-redeclare": [
    "error",
    { builtinGlobals: false, ignoreDeclarationMerge: true },
  ],
  // S6572 Enum member values should be either all initialized or none
  "@typescript-eslint/prefer-enum-initializers": "error",
  // S2933 Fields that are only assigned in the constructor should be "readonly"
  "@typescript-eslint/prefer-readonly": "error",
  // ----- React (eslint-plugin-react, registered by eslint-config-next) -----
  // S9011 "<button>" elements should have a valid "type" attribute, explicitly set when associated with a "<form>"
  "react/button-has-type": "error",
  // S6775 All "defaultProps" should have non-required PropTypes
  "react/default-props-match-prop-types": "error",
  // S6754 The return value of "useState" should be destructured and named symmetrically
  "react/hook-use-state": ["error", { allowDestructuredState: true }],
  // S6772 (react/jsx-child-element-spacing) is left out: Prettier owns JSX whitespace and
  // eslint-config-prettier turns it off, since ADR 0012 puts Prettier last.
  // S6481 React Context Provider values should have stable identities
  "react/jsx-no-constructed-context-values": "error",
  // S6749 Redundant JSX fragments should be removed
  "react/jsx-no-useless-fragment": ["error", { allowExpressions: true }],
  // S6770 User-defined JSX components should use Pascal case
  "react/jsx-pascal-case": "error",
  // S6756 "setState" should use a callback when referencing the previous state
  "react/no-access-state-in-setstate": "error",
  // S6479 JSX list components should not use array indexes as key
  "react/no-array-index-key": "error",
  // S6763 "shouldComponentUpdate" should not be defined when extending "React.PureComponent"
  "react/no-redundant-should-component-update": "error",
  // S6757 "this" should not be used in functional components
  "react/no-this-in-sfc": "error",
  // S6747 JSX elements should not use unknown properties and attributes
  "react/no-unknown-property": "error",
  // S6791 React legacy lifecycle methods should not be used
  "react/no-unsafe": ["error", { checkAliases: true }],
  // S6478 React components should not be nested
  "react/no-unstable-nested-components": [
    "error",
    { allowAsProps: false, propNamePattern: "{render*,*Enhancer,*Renderer}" },
  ],
  // S6441 Unused methods of React components should be removed
  "react/no-unused-class-component-methods": "error",
  // S6767 Unused React typed props should be removed
  "react/no-unused-prop-types": "error",
  // ----- Imports (eslint-plugin-import, registered by eslint-config-next) -----
  // S6859 Imports should not use absolute paths
  "import/no-absolute-path": "error",
  // S3863 Imports from the same module should be merged
  "import/no-duplicates": "error",
  // S6861 Mutable variables should not be exported
  "import/no-mutable-exports": "error",
  // S7060 Module should not import itself
  "import/no-self-import": "error",
  // ----- Accessibility (not in jsx-a11y recommended) -----
  // S5254 HTML elements should have a valid language attribute
  "jsx-a11y/lang": "error",
  // S6825 Focusable elements should not have "aria-hidden" attribute
  "jsx-a11y/no-aria-hidden-on-focusable": "error",
  // S6819 Prefer tag over ARIA role
  "jsx-a11y/prefer-tag-over-role": "error",
  // ----- eslint-plugin-unicorn -----
  // S7718 Error parameters in catch clauses should follow a consistent naming convention
  "unicorn/catch-error-name": [
    "error",
    {
      name: "error",
      ignore: [
        "^(e|ex)$",
        "[eE][xX][cC][eE][pP][tT][iI][oO][nN]$",
        "[eE][rR][rR]$",
        "^_",
        String.raw`^\w\$\d+$`,
        "^[cC][aA][uU][sS][eE]$",
        "^[rR][eE][aA][sS][oO][nN]$",
      ],
    },
  ],
  // S7719 Date objects should be cloned directly without calling "getTime()"
  "unicorn/consistent-date-clone": "error",
  // S7720 Ternary expressions in array spreads should use consistent types
  "unicorn/consistent-empty-array-spread": "error",
  // S7721 Functions should be moved to the highest possible scope
  "unicorn/consistent-function-scoping": ["error", { checkArrowFunctions: false }],
  // S7761 Data attributes should be accessed using ".dataset"
  "unicorn/dom-node-dataset": "error",
  // S7722 Built-in error objects should have meaningful messages
  "unicorn/error-message": "error",
  // S7723 Built-in constructors should be called consistently with or without "new"
  "unicorn/new-for-builtins": "error",
  // S7724 ESLint disable comments should specify which rules to disable
  "unicorn/no-abusive-eslint-disable": "error",
  // S7725 Getters and setters should not recursively access the same property
  "unicorn/no-accessor-recursion": "error",
  // S7726 Default exports should be named
  "unicorn/no-anonymous-default-export": "error",
  // S7727 Function references should not be passed directly to iterator methods
  "unicorn/no-array-callback-reference": "error",
  // S7729 Array method callbacks should not use the "thisArg" parameter
  "unicorn/no-array-method-this-argument": "error",
  // S7732 "instanceof" should not be used with built-in objects
  "unicorn/no-instanceof-builtins": "error",
  // S7733 HTTP GET and HEAD requests should not include a request body
  "unicorn/no-invalid-fetch-options": "error",
  // S7734 Default imports and exports should use the dedicated syntax
  "unicorn/no-named-default": "error",
  // S7736 Negated expressions should not be used in equality checks
  "unicorn/no-negation-in-equality-check": "error",
  // S7737 Objects should not be used as default parameters
  "unicorn/no-object-as-default-parameter": "error",
  // S7738 Single-element arrays should not be passed to Promise methods
  "unicorn/no-single-promise-in-promise-methods": "error",
  // S7739 Objects should not have a "then" property
  "unicorn/no-thenable": "error",
  // S7740 Variables should not be assigned the value of "this"
  "unicorn/no-this-assignment": "error",
  // S7741 "typeof" should not be used to check for "undefined"
  "unicorn/no-typeof-undefined": "error",
  // S7742 Polyfills should not be used when native support is available in target environments
  "unicorn/no-unnecessary-polyfills": "error",
  // S7743 Immediately invoked arrow functions with parenthesized expressions should be avoided
  "unicorn/no-unreadable-iife": "error",
  // S7744 Unnecessary fallback objects should not be used when spreading in object literals
  "unicorn/no-useless-fallback-in-spread": "error",
  // S7745 Array length checks should not be used before "some()" and "every()" calls
  "unicorn/no-useless-length-check": "error",
  // S7746 Promise.resolve() and Promise.reject() should not be used in async functions or promise callbacks
  "unicorn/no-useless-promise-resolve-reject": "error",
  // S7747 Spread syntax should not be used unnecessarily
  "unicorn/no-useless-spread": "error",
  // S7749 Numeric literals should use consistent digit grouping with separators
  "unicorn/numeric-separators-style": [
    "error",
    { onlyIfContainsSeparator: true, number: { minimumDigits: 0, groupLength: 3 } },
  ],
  // S7750 Array methods ".find()" and ".findLast()" should be preferred over ".filter()" for single element retrieval
  "unicorn/prefer-array-find": "error",
  // S7751 Array flattening should use the native "flat()" method
  "unicorn/prefer-array-flat": "error",
  // S7752 Array methods ".map().flat()" should be replaced with ".flatMap()"
  "unicorn/prefer-array-flat-map": "error",
  // S7753 "indexOf()" and "lastIndexOf()" should be used instead of "findIndex()" and "findLastIndex()" for simple equality searches
  "unicorn/prefer-array-index-of": "error",
  // S7754 Use ".some()" instead of ".filter().length" checks or ".find()" for existence testing
  "unicorn/prefer-array-some": "error",
  // S7755 Complex index access patterns should be replaced with ".at()" method
  "unicorn/prefer-at": "error",
  // S7756 Modern Blob methods should be used instead of FileReader
  "unicorn/prefer-blob-reading-methods": "error",
  // S7757 Class properties should be declared as fields rather than assigned in constructors
  "unicorn/prefer-class-fields": "error",
  // S7758 Unicode-aware string methods should be used for proper character handling
  "unicorn/prefer-code-point": "error",
  // S7759 Use "Date.now()" instead of creating Date objects to get current timestamp
  "unicorn/prefer-date-now": "error",
  // S7760 Default parameters should be used instead of reassigning parameters with literal fallback values
  "unicorn/prefer-default-parameters": "error",
  // S7762 DOM nodes should be removed using "remove()" instead of "removeChild()"
  "unicorn/prefer-dom-node-remove": "error",
  // S7763 Re-exports should use "export...from" syntax
  "unicorn/prefer-export-from": "error",
  // S7765 Existence checks should use ".includes()" instead of ".indexOf()" or ".lastIndexOf()"
  "unicorn/prefer-includes": "error",
  // S7766 Ternary expressions should be replaced with "Math.min()" or "Math.max()" for simple comparisons
  "unicorn/prefer-math-min-max": "error",
  // S7767 Bitwise operators should not be used to truncate numbers
  "unicorn/prefer-math-trunc": "error",
  // S7768 Modern DOM manipulation methods should be used instead of legacy alternatives
  "unicorn/prefer-modern-dom-apis": "error",
  // S7769 Modern Math APIs should be used instead of legacy mathematical expressions
  "unicorn/prefer-modern-math-apis": "error",
  // S7770 Wrapper functions around built-in type conversion functions should be avoided
  "unicorn/prefer-native-coercion-functions": "error",
  // S7771 Negative indices should be used instead of length calculations
  "unicorn/prefer-negative-index": "error",
  // S7772 Node.js built-in modules should be imported using the "node:" protocol
  "unicorn/prefer-node-protocol": "error",
  // S7773 Number static methods and properties should be preferred over global equivalents
  "unicorn/prefer-number-properties": "error",
  // S7774 Methods should be accessed from prototypes, not instances
  "unicorn/prefer-prototype-methods": "error",
  // S7776 Arrays used only for existence checks should be Sets
  "unicorn/prefer-set-has": "error",
  // S7777 Set size should be accessed directly instead of converting to array first
  "unicorn/prefer-set-size": "error",
  // S7778 Multiple consecutive calls to methods that accept multiple arguments should be combined
  "unicorn/prefer-single-call": "error",
  // S7780 String literals with escaped backslashes should use `String.raw` template literals
  "unicorn/prefer-string-raw": "error",
  // S7781 Strings should use "replaceAll()" instead of "replace()" with global regex
  "unicorn/prefer-string-replace-all": "error",
  // S7783 "trimLeft()" and "trimRight()" should be replaced with "trimStart()" and "trimEnd()"
  "unicorn/prefer-string-trim-start-end": "error",
  // S7784 "structuredClone()" should be used instead of other deep cloning methods
  "unicorn/prefer-structured-clone": "error",
  // S7785 Top-level await should be preferred over promise chains and async wrappers
  "unicorn/prefer-top-level-await": "error",
  // S7786 Generic "Error" should be "TypeError" when thrown after type checking
  "unicorn/prefer-type-error": "error",
  // S7787 Import and export statements should not have empty specifier lists
  "unicorn/require-module-specifiers": "error",
  // ----- eslint-plugin-promise -----
  // S9381 Promises should not be nested
  "promise/no-nesting": "error",
};

/** 6 Testing Library rules, for test files only. */
export const sonarWayTestRules = {
  // S9115 Promises returned by Testing Library async events should be handled
  "testing-library/await-async-events": "error",
  // S9026 Promises returned by Testing Library async queries should be handled
  "testing-library/await-async-queries": "error",
  // S9333 Synchronous Testing Library queries should not be awaited
  "testing-library/no-await-sync-queries": "error",
  // S8981 Regular expressions used in Testing Library queries should not have the global flag
  "testing-library/no-global-regexp-flag-in-query": "error",
  // S8990 Promises should not be passed to "fireEvent"
  "testing-library/no-promise-in-fire-event": "error",
  // S8985 Side effects should not be performed inside "waitFor" callbacks
  "testing-library/no-wait-for-side-effects": "error",
};
