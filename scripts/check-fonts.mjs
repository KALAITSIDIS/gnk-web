/**
 * Post-build check: the CSS Next emitted declares Greek and Cyrillic faces for
 * every family the site sets type in.
 *
 * WHY AFTER THE BUILD AND NOT IN A UNIT TEST. lib/type.test.ts pins what the
 * source ASKS for (families and subsets in app/layout.tsx). What the visitor
 * gets is decided when `next build` downloads the font files and writes one
 * @font-face per subset with a `unicode-range`; a family that stops serving a
 * script, or a subset list trimmed "for performance", changes that output and
 * nothing in the source. Wired as `postbuild`, so `npm run build` fails here
 * before a deploy can ship a site that sets Greek in whatever serif the
 * visitor's machine happens to have (audit 2026-09-13, WEB-01).
 *
 * Next writes ranges without leading zeros and with `?` wildcards
 * (`U+??`, `U+370-3FF`, `U+400-45F`), so the parser reads numbers, not text.
 *
 * No shebang: this module is imported by lib/type.test.ts, and a shebang-bearing
 * .mjs fails to load under some vitest paths.
 */
import { readdirSync, readFileSync, statSync } from "node:fs";
import { join } from "node:path";
import { fileURLToPath } from "node:url";

/** Scripts the site must be able to set in its own faces: the feed carries el and ru. */
export const REQUIRED_SCRIPTS = ["greek", "cyrillic"];

/** One representative codepoint per script — a lowercase letter every text uses. */
const PROBE = { greek: 0x03b1 /* α */, cyrillic: 0x0430 /* а */ };

/** Families the site sets type in, exactly as next/font names them in CSS. */
export const FAMILIES = ["Literata", "Inter Tight"];

/**
 * Parse one `unicode-range` value into [start, end] pairs.
 * Accepts `U+0370-03FF`, `U+370-3FF`, `U+2116`, `U+03??`, `U+??`.
 */
export function parseUnicodeRange(value) {
  const ranges = [];
  for (const raw of value.split(",")) {
    const token = raw.trim().toUpperCase();
    const m = /^U\+([0-9A-F?]+)(?:-([0-9A-F]+))?$/.exec(token);
    if (!m) continue;
    const [, start, end] = m;
    if (start.includes("?")) {
      ranges.push([parseInt(start.replaceAll("?", "0"), 16), parseInt(start.replaceAll("?", "F"), 16)]);
    } else {
      const from = parseInt(start, 16);
      ranges.push([from, end ? parseInt(end, 16) : from]);
    }
  }
  return ranges;
}

const covers = (ranges, codepoint) => ranges.some(([a, b]) => codepoint >= a && codepoint <= b);

/**
 * Which required scripts each family fails to declare in the given CSS.
 * Returns [] when every family covers every required script.
 */
export function auditFontCss(css, families = FAMILIES) {
  const problems = [];
  for (const family of families) {
    const escaped = family.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
    // `font-family:Literata;` — not `Literata Fallback`, which is the local
    // metric-matched stand-in and covers nothing.
    const face = new RegExp(
      `@font-face\\{[^}]*font-family:\\s*['"]?${escaped}['"]?\\s*;[^}]*\\}`,
      "g",
    );
    const ranges = [];
    for (const block of css.match(face) ?? []) {
      const ur = /unicode-range:\s*([^;}]+)/.exec(block);
      if (ur) ranges.push(...parseUnicodeRange(ur[1]));
    }
    const missing = REQUIRED_SCRIPTS.filter((script) => !covers(ranges, PROBE[script]));
    if (missing.length > 0) problems.push({ family, missing });
  }
  return problems;
}

function cssFilesUnder(dir) {
  const out = [];
  for (const name of readdirSync(dir)) {
    const p = join(dir, name);
    if (statSync(p).isDirectory()) out.push(...cssFilesUnder(p));
    else if (name.endsWith(".css")) out.push(p);
  }
  return out;
}

function main() {
  const root = fileURLToPath(new URL("..", import.meta.url));
  const staticDir = join(root, ".next", "static");
  let files;
  try {
    files = cssFilesUnder(staticDir);
  } catch {
    console.error(`check-fonts: ${staticDir} not found — run after next build`);
    process.exit(1);
  }
  const css = files.map((f) => readFileSync(f, "utf-8")).join("\n");
  const problems = auditFontCss(css, FAMILIES);
  if (problems.length === 0) {
    console.log(
      `check-fonts: ${FAMILIES.join(" and ")} declare ${REQUIRED_SCRIPTS.join(" and ")} faces in ${files.length} css file(s)`,
    );
    return;
  }
  for (const p of problems) {
    console.error(`check-fonts: ${p.family} is missing ${p.missing.join(", ")} in the emitted CSS`);
  }
  console.error("check-fonts: app/layout.tsx must request those subsets from a family that serves them");
  process.exit(1);
}

if (process.argv[1] && fileURLToPath(import.meta.url) === process.argv[1]) main();
