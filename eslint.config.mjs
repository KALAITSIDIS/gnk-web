import nextCoreWebVitals from "eslint-config-next/core-web-vitals";
import nextTypescript from "eslint-config-next/typescript";

/**
 * Flat config straight from eslint-config-next 16. The FlatCompat bridge that
 * create-next-app still emits blows up on a circular reference in this
 * version, and there is no reason to go through it when the package exports
 * flat configs directly.
 */
const config = [
  ...nextCoreWebVitals,
  ...nextTypescript,
  { ignores: [".next/**", "node_modules/**"] },
];

export default config;
