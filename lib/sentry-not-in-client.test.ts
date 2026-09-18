import { readdirSync, readFileSync, statSync } from "node:fs";
import { dirname, join, relative, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";

/**
 * Sentry must never reach a visitor's browser.
 *
 * `/legal` says "This site sets no cookies. It runs no analytics, no
 * advertising pixels and no third-party trackers... Your visit is not
 * profiled", and app/legal/page.test.ts holds the page to it. That sentence is
 * true today because the error reporting is server-side only — instrumentation
 * .ts and nothing else. One value-import of `@/lib/report` from a client
 * component would put a third party's SDK in every page and make it false,
 * silently, in a diff that looked like a logging improvement.
 *
 * It holds today only by luck: components/property-search.tsx and
 * property-card.tsx do import from @/lib/crm, which now imports the reporter —
 * but they import `Listing` as a TYPE, which the compiler erases before any
 * bundler sees it. vitest.config.ts's comment records the last time that
 * distinction caught somebody out. Luck is not a guarantee, so this walks the
 * value-import graph from every "use client" file and makes it a rule.
 */

const ROOT = fileURLToPath(new URL("../", import.meta.url));
const SOURCE = /\.tsx?$/;
const FORBIDDEN = ["@sentry/nextjs", "lib/report.ts", "instrumentation.ts"];

function sourceFiles(dir: string): string[] {
  const out: string[] = [];
  for (const entry of readdirSync(dir)) {
    if (entry === "node_modules" || entry === ".next" || entry === ".git") continue;
    const full = join(dir, entry);
    if (statSync(full).isDirectory()) out.push(...sourceFiles(full));
    else if (SOURCE.test(entry) && !entry.endsWith(".test.ts") && !entry.endsWith(".test.tsx")) {
      out.push(full);
    }
  }
  return out;
}

/**
 * The specifiers a file pulls in AT RUNTIME. `import type {...}` and a clause
 * whose every specifier is inline-`type` are erased by the compiler and carry
 * nothing into a bundle, so they are not edges in this graph.
 */
function runtimeImports(code: string): string[] {
  const specifiers: string[] = [];

  // import "./side-effect"
  for (const m of code.matchAll(/(?:^|\n)\s*import\s+["']([^"']+)["']/g)) specifiers.push(m[1]);

  /* import("x") — a dynamic import is still an edge. A bundler splits it into
     its own chunk rather than dropping it, so a client component that loaded
     the SDK lazily would ship it just the same, only later. */
  for (const m of code.matchAll(/\bimport\s*\(\s*["']([^"']+)["']\s*\)/g)) specifiers.push(m[1]);

  // import ... from "x" / export ... from "x"
  for (const m of code.matchAll(
    /(?:^|\n)\s*(?:import|export)\s+(type\s+)?([\s\S]*?)\s*from\s*["']([^"']+)["']/g,
  )) {
    const [, typeKeyword, clause, specifier] = m;
    if (typeKeyword) continue; // `import type { X } from` — erased whole
    const named = clause.match(/\{([\s\S]*)\}/);
    if (named) {
      const parts = named[1]
        .split(",")
        .map((s) => s.trim())
        .filter(Boolean);
      const hasDefaultOrNamespace = clause.replace(/\{[\s\S]*\}/, "").replace(/,/g, "").trim() !== "";
      // every specifier inline-`type`, and nothing outside the braces → erased
      if (!hasDefaultOrNamespace && parts.length > 0 && parts.every((p) => /^type\s/.test(p))) {
        continue;
      }
    }
    specifiers.push(specifier);
  }
  return specifiers;
}

/** A specifier resolved to a file in this repo, or null if it is a package. */
function resolveLocal(specifier: string, fromFile: string): string | null {
  let base: string;
  if (specifier.startsWith("@/")) base = join(ROOT, specifier.slice(2));
  else if (specifier.startsWith(".")) base = resolve(dirname(fromFile), specifier);
  else return null; // a bare package specifier

  for (const candidate of [
    base,
    `${base}.ts`,
    `${base}.tsx`,
    join(base, "index.ts"),
    join(base, "index.tsx"),
  ]) {
    try {
      if (statSync(candidate).isFile()) return candidate;
    } catch {
      /* not this one */
    }
  }
  return null;
}

/** Every local file reachable from `entry` by runtime imports, plus the packages hit. */
function reachable(entry: string): { files: Set<string>; packages: Set<string> } {
  const files = new Set<string>();
  const packages = new Set<string>();
  const queue = [entry];
  while (queue.length) {
    const file = queue.pop()!;
    if (files.has(file)) continue;
    files.add(file);
    for (const specifier of runtimeImports(readFileSync(file, "utf8"))) {
      const local = resolveLocal(specifier, file);
      if (local) queue.push(local);
      else packages.add(specifier);
    }
  }
  return { files, packages };
}

const clientEntries = [...sourceFiles(join(ROOT, "app")), ...sourceFiles(join(ROOT, "components"))].filter(
  (f) => /^\s*(?:\/\*[\s\S]*?\*\/\s*)?["']use client["']/.test(readFileSync(f, "utf8")),
);

describe("the error reporter never reaches the browser", () => {
  it("finds the client components, so this suite is not vacuously green", () => {
    // If a refactor removes every "use client" file the walk below would pass
    // by having nothing to walk. It has five today.
    expect(clientEntries.length).toBeGreaterThanOrEqual(5);
  });

  it.each(clientEntries.map((f) => relative(ROOT, f).replace(/\\/g, "/")))(
    "%s cannot reach Sentry",
    (relativePath) => {
      const { files, packages } = reachable(join(ROOT, relativePath));
      const hits = [
        ...[...packages].filter((p) => FORBIDDEN.includes(p)),
        ...[...files]
          .map((f) => relative(ROOT, f).replace(/\\/g, "/"))
          .filter((f) => FORBIDDEN.includes(f)),
      ];
      expect(
        hits,
        "a value-import chain from a client component to the reporter would ship the Sentry SDK to every visitor and make /legal's 'no third-party trackers' false",
      ).toEqual([]);
    },
  );

  it("would catch a value-import if one were added", () => {
    // The walker is only worth having if it can fail. A client file that
    // imports the reporter for a value must be seen, where the same file
    // importing a type from the same module must not.
    const value = runtimeImports('"use client";\nimport { report } from "@/lib/report";');
    const type = runtimeImports('"use client";\nimport type { Report } from "@/lib/report";');
    const inline = runtimeImports('"use client";\nimport { type Report } from "@/lib/report";');
    const mixed = runtimeImports('"use client";\nimport { report, type Report } from "@/lib/report";');
    expect(value).toContain("@/lib/report");
    expect(type, "erased by the compiler").toEqual([]);
    expect(inline, "also erased").toEqual([]);
    expect(mixed, "one runtime specifier is enough to pull the module in").toContain("@/lib/report");
  });
});
