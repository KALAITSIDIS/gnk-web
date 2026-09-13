import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";
import { auditFontCss, REQUIRED_SCRIPTS } from "../scripts/check-fonts.mjs";

/**
 * The site's type must set Greek and Russian in its own faces.
 *
 * The CRM feed carries `el` and `ru` for every title and description, and the
 * site falls back per language; CSS then falls back per CHARACTER, so a Greek
 * word inside an English heading silently switches typeface mid-line. Until
 * 2026-09-13 the two families were Newsreader and Public Sans, which Google
 * Fonts serves in latin, latin-ext and vietnamese only — and both were
 * requested with `subsets: ["latin"]`, so even a capable family would have
 * shipped without the glyphs (audit WEB-01).
 *
 * Two halves. This file pins the SOURCE: the families and the subsets asked
 * for. scripts/check-fonts.mjs runs after every build (`postbuild`) and pins
 * the RESULT: the CSS Next actually emitted declares Greek and Cyrillic faces
 * for both families. Trimming the subsets "for performance" fails both.
 */
const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const layout = readFileSync(join(root, "app", "layout.tsx"), "utf-8");
const css = readFileSync(join(root, "app", "globals.css"), "utf-8");
const og = readFileSync(join(root, "app", "api", "og", "route.tsx"), "utf-8");
const pkg = JSON.parse(readFileSync(join(root, "package.json"), "utf-8")) as {
  scripts: Record<string, string>;
};

const FAMILIES = { display: "Literata", sans: "Inter_Tight" } as const;
const SUBSETS = ["latin", "latin-ext", "greek", "cyrillic"];

describe("the two families carry all three scripts", () => {
  it("layout imports exactly Literata and Inter Tight from next/font/google", () => {
    const m = /import \{([^}]+)\} from "next\/font\/google"/.exec(layout);
    expect(m, "one next/font/google import").not.toBeNull();
    const names = m![1]!.split(",").map((s) => s.trim()).filter(Boolean).sort();
    expect(names).toEqual([FAMILIES.display, FAMILIES.sans].sort());
  });

  for (const family of Object.values(FAMILIES)) {
    it(`${family} is requested with latin, latin-ext, greek and cyrillic`, () => {
      const call = new RegExp(`${family}\\(\\{([\\s\\S]*?)\\}\\)`).exec(layout);
      expect(call, `${family}(...) is called`).not.toBeNull();
      const subsets = /subsets:\s*\[([^\]]*)\]/.exec(call![1]!);
      expect(subsets, `${family} declares subsets`).not.toBeNull();
      const asked = [...subsets![1]!.matchAll(/"([a-z-]+)"/g)].map((x) => x[1]);
      for (const s of SUBSETS) expect(asked, `${family} subsets`).toContain(s);
    });
  }

  it("globals.css maps the display and body roles to those families", () => {
    expect(css).toMatch(/--font-display:\s*var\(--font-literata\)/);
    expect(css).toMatch(/--font-sans:\s*var\(--font-inter-tight\)/);
    expect(css).not.toMatch(/newsreader|public-sans/);
  });

  it("the share card is set in the same display face", () => {
    expect(og).toMatch(/family=Literata/);
    expect(og).not.toMatch(/Newsreader/);
  });
});

describe("the display face ships as the two static weights the site sets", () => {
  /* Measured from Google Fonts 2026-09-13, the latin face alone: 110 KB as
     the variable font with its optical-size axis (what the h1 waited for,
     at a mobile LCP of 4.3 s), 52 KB variable without it, 22 KB as a static
     500. The site sets the display face at 500 (headings, prices) and 600
     (the wordmark, a card's price) and nothing else. */
  const call = /Literata\(\{([\s\S]*?)\}\)/.exec(layout);

  it("asks for 500 and 600, and no axis", () => {
    expect(call, "Literata(...) is called").not.toBeNull();
    const weight = /weight:\s*\[([^\]]*)\]/.exec(call![1]!);
    expect(weight, "Literata declares its weights").not.toBeNull();
    const asked = [...weight![1]!.matchAll(/"(\d+)"/g)].map((m) => m[1]).sort();
    expect(asked).toEqual(["500", "600"]);
    expect(call![1]).not.toMatch(/axes:/);
  });

  it("nothing sets the display face heavier than the 600 that ships", () => {
    // A weight the file does not carry is synthesised by the browser —
    // smeared strokes on the largest type on the page.
    for (const file of ["app/page.tsx", "components/property-card.tsx", "components/site-header.tsx", "components/site-footer.tsx"]) {
      const src = readFileSync(join(root, file), "utf-8");
      for (const m of src.matchAll(/className="([^"]*)"/g)) {
        const cls = m[1]!;
        if (cls.includes("font-display")) expect(cls, `${file}: ${cls}`).not.toMatch(/\bfont-(bold|extrabold|black)\b/);
      }
    }
    expect(css).toMatch(/h1, h2, h3 \{[^}]*font-weight:\s*500/);
  });
});

describe("the post-build check reads the emitted CSS", () => {
  it("runs after every build", () => {
    expect(pkg.scripts.postbuild).toMatch(/check-fonts\.mjs/);
  });

  it("requires greek and cyrillic", () => {
    expect([...REQUIRED_SCRIPTS].sort()).toEqual(["cyrillic", "greek"]);
  });

  const face = (family: string, range: string) =>
    `@font-face{font-family:${family};font-style:normal;font-weight:400;font-display:swap;src:url(/x.woff2) format("woff2");unicode-range:${range}}`;
  const latin = "U+0000-00FF,U+0131,U+0152-0153";
  const greek = "U+0370-0377,U+037A-037F,U+0384-038A,U+038C,U+038E-03A1,U+03A3-03FF";
  const cyrillic = "U+0301,U+0400-045F,U+0490-0491,U+04B0-04B1,U+2116";

  it("passes a build whose CSS declares all three scripts for both families", () => {
    const css = ["Literata", "Inter Tight"]
      .flatMap((f) => [face(f, latin), face(f, greek), face(f, cyrillic)])
      .join("");
    expect(auditFontCss(css, ["Literata", "Inter Tight"])).toEqual([]);
  });

  it("names the family and the script when a subset is missing", () => {
    const css = [face("Literata", latin), face("Literata", greek), face("Inter Tight", latin), face("Inter Tight", greek), face("Inter Tight", cyrillic)].join("");
    expect(auditFontCss(css, ["Literata", "Inter Tight"])).toEqual([
      { family: "Literata", missing: ["cyrillic"] },
    ]);
  });

  it("treats a family absent from the build as missing everything", () => {
    const css = [face("Literata", latin), face("Literata", greek), face("Literata", cyrillic)].join("");
    expect(auditFontCss(css, ["Literata", "Inter Tight"])).toEqual([
      { family: "Inter Tight", missing: ["greek", "cyrillic"] },
    ]);
  });

  it("understands quoted family names and wildcard ranges", () => {
    const css =
      face("'Literata'", "U+03??") + face('"Literata"', "U+04??") + face("Literata", latin);
    expect(auditFontCss(css, ["Literata"])).toEqual([]);
  });
});
