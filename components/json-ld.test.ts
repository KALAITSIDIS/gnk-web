import { readdirSync, readFileSync, statSync } from "node:fs";
import { dirname, join, relative } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";
import { serializeJsonLd } from "./json-ld";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");

/** Code, not commentary: a comment explaining the sink is not a sink. */
const stripComments = (src: string) =>
  src.replace(/\/\*[\s\S]*?\*\//g, "").replace(/^\s*\/\/.*$/gm, "");

function tsxFiles(dir: string): string[] {
  return readdirSync(dir).flatMap((name) => {
    const full = join(dir, name);
    if (statSync(full).isDirectory()) return tsxFiles(full);
    return /\.tsx$/.test(name) ? [full] : [];
  });
}

describe("structured data cannot end its own script element", () => {
  it("escapes < so a </script> in a listing title stays data", () => {
    // What a malicious or careless editor could put in a title, and what the
    // service-role import would insert past every validator.
    const hostile = { name: "</script><img src=x onerror=alert(1)>", d: "a<!--b" };
    const out = serializeJsonLd(hostile);
    expect(out).not.toContain("<");
    expect(out).toContain("\\u003c/script");
    expect(JSON.parse(out), "identical once parsed — nothing is lost").toEqual(hostile);
  });

  it("keeps a legitimate less-than readable once parsed", () => {
    // "<100 m from the sea" is real listing copy; escaping is not rejection.
    expect(JSON.parse(serializeJsonLd({ d: "<100 m from the sea" })).d).toBe("<100 m from the sea");
  });
});

describe("the sink exists in exactly one file", () => {
  it("no other .tsx under app/ or components/ writes application/ld+json or uses dangerouslySetInnerHTML", () => {
    // One rule, three copies was how the bug existed; a fourth copy is how it
    // would come back. Anything that needs structured data renders <JsonLd>.
    const offenders: string[] = [];
    for (const dir of ["app", "components"]) {
      for (const file of tsxFiles(join(root, dir))) {
        const rel = relative(root, file).replace(/\\/g, "/");
        if (rel === "components/json-ld.tsx") continue;
        const src = stripComments(readFileSync(file, "utf-8"));
        if (/application\/ld\+json|dangerouslySetInnerHTML/.test(src)) offenders.push(rel);
      }
    }
    expect(offenders, "render <JsonLd data={…} /> from components/json-ld.tsx instead").toEqual([]);
  });
});
