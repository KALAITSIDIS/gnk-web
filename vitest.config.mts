import { fileURLToPath } from "node:url";
import { defineConfig } from "vitest/config";

/**
 * One line of configuration, for one reason: `@/` has to mean the same thing
 * to the tests that it means to the application.
 *
 * tsconfig.json maps `@/*` to the repo root, so every file in app/ and
 * components/ imports that way and tsc is satisfied. Vitest does not read
 * tsconfig paths. Until this file existed the tests only appeared to work,
 * because the modules they imported happened to use `@/lib/crm` for a TYPE —
 * which the compiler erases before Vitest ever sees it. The first module under
 * test to import a real value through the alias failed to resolve, and the
 * suite that would have caught a defect could not even load.
 */
export default defineConfig({
  resolve: {
    alias: {
      "@": fileURLToPath(new URL("./", import.meta.url)),
    },
  },
});
