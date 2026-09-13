import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";

/**
 * The palette's contrast, measured from the tokens the pages actually use.
 *
 * globals.css carries its ratios in prose ("4.56:1 on paper and 4.89:1 on
 * surface") beside the hex they describe. Prose does not fail when the hex
 * moves; this does. WCAG 2.1: 4.5:1 for text (1.4.3), 3:1 for the boundary of
 * a control (1.4.11). The resting edge of every input and select was
 * `--color-line`, which measures 1.32:1 on white — a focus ring passing does
 * not excuse the resting state (audit 2026-09-13, WEB-03).
 */
const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const css = readFileSync(join(root, "app", "globals.css"), "utf-8");

function tokens(): Record<string, string> {
  const theme = css.slice(css.indexOf("@theme {"), css.indexOf("}", css.indexOf("@theme {")));
  const out: Record<string, string> = {};
  for (const m of theme.matchAll(/(--color-[a-z0-9-]+):\s*(#[0-9a-fA-F]{6})\s*;/g)) {
    out[m[1]!] = m[2]!.toLowerCase();
  }
  return out;
}

function luminance(hex: string): number {
  const [r, g, b] = [1, 3, 5].map((i) => {
    const c = parseInt(hex.slice(i, i + 2), 16) / 255;
    return c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4;
  }) as [number, number, number];
  return 0.2126 * r + 0.7152 * g + 0.0722 * b;
}

/** WCAG 2.1 contrast ratio, rounded the way audit tools print it. */
export function contrast(a: string, b: string): number {
  const [hi, lo] = [luminance(a), luminance(b)].sort((x, y) => y - x) as [number, number];
  return Math.round(((hi + 0.05) / (lo + 0.05)) * 100) / 100;
}

const t = tokens();
const grounds = { paper: t["--color-paper"]!, surface: t["--color-surface"]! };

describe("text tokens clear 4.5:1 on both grounds", () => {
  for (const name of ["--color-ink", "--color-ink-2", "--color-ink-3", "--color-accent"]) {
    for (const [ground, hex] of Object.entries(grounds)) {
      it(`${name} on ${ground}`, () => {
        expect(t[name], `${name} is declared`).toBeDefined();
        expect(contrast(t[name]!, hex)).toBeGreaterThanOrEqual(4.5);
      });
    }
  }

  it("white on the accent (button labels)", () => {
    expect(contrast("#ffffff", t["--color-accent"]!)).toBeGreaterThanOrEqual(4.5);
  });
});

describe("the resting edge of a control clears 3:1 on both grounds", () => {
  it("--color-line-strong exists for that role", () => {
    expect(t["--color-line-strong"], "--color-line-strong is declared").toBeDefined();
  });

  for (const [ground, hex] of Object.entries(grounds)) {
    it(`--color-line-strong on ${ground}`, () => {
      expect(contrast(t["--color-line-strong"] ?? "#ffffff", hex)).toBeGreaterThanOrEqual(3);
    });
  }

  it("the decorative rule stays pale — it is exempt, and a heavier rule would read as a control", () => {
    expect(contrast(t["--color-line"]!, grounds.surface)).toBeLessThan(2);
  });
});

describe("every field draws its edge with the strong token", () => {
  // A field is recognised by its role, not by its tag: the one class string
  // that gives an input, select or textarea its placeholder colour.
  const files = ["components/enquiry-form.tsx", "components/property-search.tsx"];
  for (const file of files) {
    it(file, () => {
      const src = readFileSync(join(root, file), "utf-8");
      const fieldClassStrings = [...src.matchAll(/"([^"]*placeholder:text-ink-3[^"]*)"/g)].map(
        (m) => m[1]!,
      );
      expect(fieldClassStrings.length, `${file} styles at least one field`).toBeGreaterThan(0);
      for (const cls of fieldClassStrings) {
        expect(cls, cls).toContain("border-line-strong");
        expect(cls, cls).not.toMatch(/\bborder-line\b(?!-)/);
      }
    });
  }
});
