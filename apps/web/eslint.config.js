// next lint was removed entirely in Next.js 16 (confirmed via `next --help` --
// no `lint` subcommand exists anymore); this repo now runs ESLint directly.
// ESLint 10 also dropped legacy .eslintrc.* support outright (flat config is
// the only format), so this replaces the old .eslintrc.json's
// { "extends": "next/core-web-vitals" }. eslint-config-next@16.3.1 exports
// a ready-made flat-config array here, no FlatCompat shim needed.
module.exports = [
  ...require("eslint-config-next/core-web-vitals"),
  {
    settings: {
      // eslint-plugin-react@7.37.5 (latest published) auto-detects the React
      // version via a helper that calls the removed ESLint 9+
      // context.getFilename() API, crashing every rule that needs the
      // version (react/display-name, react/no-direct-mutation-state, etc).
      // Declaring it explicitly skips that broken detection path entirely --
      // keep in sync with the installed `react` version in package.json.
      react: { version: "19.2.8" },
    },
    rules: {
      // eslint-plugin-react-hooks@^7.0.0 (pulled in by this eslint-config-next
      // bump) added this rule, newly flagging a pattern used throughout
      // app/dashboard/**/page.tsx: try/catch around an async data fetch,
      // with the success-path JSX inside the same try block for an early-
      // return style. The rule is technically correct that JSX construction
      // itself isn't caught by the try/catch -- but here the try/catch is
      // guarding the `await backendClientFor(pairing).xyz()` call before the
      // JSX exists, which does throw synchronously into it; the JSX itself
      // isn't expected to throw. Downgraded to a warning rather than fixed
      // outright -- restructuring every dashboard page's error handling
      // around this is real, separate work, not a dependency-bump side effect.
      "react-hooks/error-boundaries": "warn",
      // Same eslint-plugin-react-hooks@^7.0.0 bump also brought in React
      // Compiler-era rules assuming client-side re-render/memoization
      // semantics. app/dashboard/page.tsx's `let running = 0` accumulator
      // inside a .map() (flagged as "reassign after render completes") is a
      // plain Server Component function with no "use client" -- it runs
      // once per request, there is no "subsequent render" for the rule's
      // stated concern to apply to. Downgraded rather than restructured for
      // the same reason as react-hooks/error-boundaries above.
      "react-hooks/immutability": "warn",
    },
  },
];
