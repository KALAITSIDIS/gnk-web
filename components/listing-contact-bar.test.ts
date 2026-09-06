import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";

/**
 * THE INVARIANT THIS FILE EXISTS FOR: nothing on the site knows the contact
 * bar's height.
 *
 * The bar is position: sticky and sits AFTER the listing article inside
 * <main>, so it reserves its own space and scrolls away before the footer.
 * The first version was position: fixed with a hand-copied pb-24 on the
 * article — 96px guarding the enquiry form, which is never at the bottom of
 * the document — and on every phone it hid the footer's last line: the
 * copyright today, the Law 71(I)/2010 licence statement the day lib/site.ts
 * gets its numbers. Two files stated one height; this is what connects them.
 */
const here = dirname(fileURLToPath(import.meta.url));

/** Code, not commentary: a comment explaining why `pb-24` went is not a `pb-24`. */
const stripComments = (src: string) =>
  src.replace(/\/\*[\s\S]*?\*\//g, "").replace(/^\s*\/\/.*$/gm, "");

const bar = stripComments(readFileSync(join(here, "listing-contact-bar.tsx"), "utf-8"));
const page = stripComments(
  readFileSync(join(here, "..", "app", "properties", "[reference]", "page.tsx"), "utf-8"),
);

describe("the listing contact bar", () => {
  it("is sticky, not fixed, so it reserves its own space in flow", () => {
    expect(bar).toMatch(/className="sticky bottom-0/);
    expect(bar).not.toMatch(/className="fixed/);
  });

  it("is rendered after the article, not inside it", () => {
    const article = page.lastIndexOf("</article>");
    const rendered = page.indexOf("<ListingContactBar");
    expect(article, "the page renders an article").toBeGreaterThan(0);
    expect(rendered, "the page renders the bar").toBeGreaterThan(0);
    expect(rendered, "the bar must follow the article's closing tag").toBeGreaterThan(article);
  });

  it("is the only element that knows its own height", () => {
    // A bottom padding on the article is a copy of the bar's height — the
    // thing that guarded the wrong end of the page.
    expect(page).not.toMatch(/\bpb-2\d\b/);
    expect(page).not.toMatch(/lg:pb-/);
  });
});
