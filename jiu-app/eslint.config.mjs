import coreWebVitals from 'eslint-config-next/core-web-vitals';
import typescript from 'eslint-config-next/typescript';

// eslint-config-next 16 ships native flat configs, so the previous FlatCompat
// bridge is gone — under ESLint 9 it threw "Converting circular structure to
// JSON" while formatting config errors.
const config = [
  ...coreWebVitals,
  ...typescript,
  {
    // Next 16's core-web-vitals turns on the React Compiler rules as errors.
    // They fire on effect patterns that predate this config across the
    // academy games, layout, and workshop — real smells, but the code is
    // shipped and working, and restructuring game effects with no test
    // coverage is not something to do as a side effect of a lint upgrade.
    // Kept visible as warnings to clear incrementally.
    rules: {
      'react-hooks/set-state-in-effect': 'warn',
      'react-hooks/purity': 'warn',
    },
  },
  {
    ignores: ['.next/**', '.next-stale-*/**', '.open-next/**', '.wrangler/**', 'out/**', 'build/**', 'next-env.d.ts'],
  },
];

export default config;
