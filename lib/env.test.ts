import { readdirSync, readFileSync, statSync } from "node:fs";
import { dirname, join, relative } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";

/**
 * README.md § Configuration is the only human-facing list of what this site
 * reads from its environment, and this file is what makes that table a
 * statement rather than a copy: it scans every shipped source file for
 * `process.env.NAME ?? "default"` and requires the table to name exactly those
 * variables, each against the file that reads it and the default it ships.
 *
 * The README said "the only configuration is CRM_API_URL" from the repo's first
 * commit while the code, from its first commit, read three variables — nothing
 * connected the sentence to lib/crm.ts and lib/site-url.ts, so nothing failed.
 * Now a new read anywhere (a SUPABASE_* key included, which README § "It holds
 * no credentials" promises never appears), a moved read, or a changed default
 * fails CI until the table says so.
 */
const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const SHIPPED = ["app", "components", "lib"];

function sourceFiles(dir: string): string[] {
  return readdirSync(dir).flatMap((name) => {
    const full = join(dir, name);
    if (statSync(full).isDirectory()) return sourceFiles(full);
    if (!/\.(ts|tsx)$/.test(name) || /\.test\.tsx?$/.test(name)) return [];
    return [full];
  });
}

/** Every `process.env.NAME ?? "default"` in shipped source, as (name, file, default). */
function readsInCode(): string[] {
  const out: string[] = [];
  for (const dir of SHIPPED) {
    for (const file of sourceFiles(join(root, dir))) {
      const src = readFileSync(file, "utf-8");
      for (const m of src.matchAll(/process\.env\.([A-Z0-9_]+)(?:\s*\?\?\s*"([^"]*)")?/g)) {
        out.push(`${m[1]} | ${relative(root, file).replace(/\\/g, "/")} | ${m[2] ?? "(none)"}`);
      }
    }
  }
  return out.sort();
}

/** Every `| \`NAME\` | \`file\` | \`default\` |` row of README's configuration table. */
function rowsInReadme(): string[] {
  const readme = readFileSync(join(root, "README.md"), "utf-8");
  return [...readme.matchAll(/^\| `([A-Z0-9_]+)` \| `([^`]+)` \| `([^`]*)` \|$/gm)]
    .map((m) => `${m[1]} | ${m[2]} | ${m[3]}`)
    .sort();
}

describe("README's configuration table is the code's, not a copy of it", () => {
  it("names exactly the variables the site reads, where, with their defaults", () => {
    const code = readsInCode();
    expect(code.length, "the scan must find the known reads").toBeGreaterThanOrEqual(3);
    expect(rowsInReadme()).toEqual(code);
  });

  it("proves the site reads no credential but the one README names", () => {
    // README § "It holds one secret, and that secret grants nothing" — a
    // promise this scan keeps. CRM_FORWARD_KEY is the one allowed: it proves
    // to the CRM that an enquiry came through this site and nothing more.
    // Anything else secret-shaped is the thing the section forbids.
    const THE_ONE = "CRM_FORWARD_KEY | lib/crm.ts | ";
    const reads = readsInCode();
    expect(reads, "the one secret is read where README says").toContain(THE_ONE);
    for (const read of reads) {
      if (read === THE_ONE) continue;
      expect(read).not.toMatch(/SUPABASE|SERVICE_ROLE|SECRET|TOKEN|KEY/);
    }
  });
});
