import { readdirSync, readFileSync, statSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";

/**
 * The smallest type on the site is 12 px, and small print is 14.
 *
 * Measured 2026-09-13: the eyebrow labels were 11 px, the card's chips —
 * which carry "Separate title deed", the strongest single buyer signal on
 * the page — were 11 px, and the footnote under the numbers table, the one
 * sentence on the page about transfer fees and VAT, was 12 px in the
 * lightest ink. 12 px is the floor below which nothing on a phone is read
 * without effort; anything that is prose rather than a label gets 14.
 *
 * This file reads the source rather than the rendered page because the
 * floor is a property of every component, including ones no test renders.
 */
const root = join(dirname(fileURLToPath(import.meta.url)), "..");

function sources(dir: string): string[] {
  const out: string[] = [];
  for (const name of readdirSync(dir)) {
    const p = join(dir, name);
    if (statSync(p).isDirectory()) out.push(...sources(p));
    else if (p.endsWith(".tsx") && !p.endsWith(".test.tsx")) out.push(p);
  }
  return out;
}

const files = [...sources(join(root, "app")), ...sources(join(root, "components"))];
const css = readFileSync(join(root, "app", "globals.css"), "utf-8");

describe("the type floor", () => {
  it("no component sets text below 12 px", () => {
    for (const file of files) {
      const src = readFileSync(file, "utf-8");
      expect(src, file).not.toMatch(/text-\[(?:[0-9]|1[01])px\]/);
      expect(src, file).not.toMatch(/text-\[0\.[0-6]\d*rem\]/);
    }
  });

  it("the eyebrow label is at least 12 px", () => {
    const eyebrow = /\.eyebrow\s*\{([^}]*)\}/.exec(css);
    expect(eyebrow, ".eyebrow is defined").not.toBeNull();
    const size = /font-size:\s*([\d.]+)rem/.exec(eyebrow![1]!);
    expect(size, ".eyebrow sets a rem font-size").not.toBeNull();
    expect(Number(size![1])).toBeGreaterThanOrEqual(0.75);
  });

  it("every filled or outlined call to action is at least 44 px tall", () => {
    // Second pass: "How we work" was py-2.5, 42 px; every other CTA is py-3.
    for (const file of files) {
      const src = readFileSync(file, "utf-8");
      for (const m of src.matchAll(/className="([^"]*)"/g)) {
        const cls = m[1]!;
        const cta = /\bbg-accent\b/.test(cls) || /\bborder-accent\b/.test(cls);
        const button = /\bpx-[4-8]\b/.test(cls);
        if (cta && button) expect(cls, `${file}: ${cls}`).toMatch(/\bpy-3\b|\bpy-3\.5\b|\bmin-h-11\b/);
      }
    }
  });

  it("small print in the lightest ink is never smaller than 14 px", () => {
    // `text-xs text-ink-3` is what a footnote looked like: the smallest size
    // in the palest colour, on the sentence about tax.
    for (const file of files) {
      const src = readFileSync(file, "utf-8");
      expect(src, file).not.toMatch(/\btext-xs\b[^"]*\btext-ink-3\b|\btext-ink-3\b[^"]*\btext-xs\b/);
    }
  });
});
