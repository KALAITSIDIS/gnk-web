import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it, vi } from "vitest";
import { nav, site } from "@/lib/site";

/**
 * The header on a phone.
 *
 * Two measurements, one day apart. 2026-09-13 morning at 375 px: the mobile
 * nav row was 462 px wide, so "Contact" started off-screen behind a gradient
 * (audit WEB-02); the fix let the six items wrap. 2026-09-13 evening on an
 * iPhone 13 viewport (390 × 664): the wrapped header measured 143 px — a
 * fifth of the screen — with every link 17 px tall, and the phone number
 * left the screen on the first scroll. On the home page the first property
 * sat at 819 px.
 *
 * So the six items now live behind a native <details> disclosure. That keeps
 * the property the wrap was chosen for — the menu works before hydration and
 * without JavaScript at all — while the header drops to one row, sticks to
 * the top so the number is always a thumb away, and every link in it is a
 * 44 px target. globals.css reserves scroll padding so an in-page anchor
 * (the listing page's #enquire) is never hidden beneath it.
 */
vi.mock("next/link", () => ({
  default: (props: { href: string; className?: string; children: unknown }) =>
    createElement("a", { href: props.href, className: props.className }, props.children as never),
}));

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const { SiteHeader } = await import("./site-header");
const html = renderToStaticMarkup(createElement(SiteHeader));

const mobileNav = () => {
  const m = /<nav aria-label="Main, mobile"[^>]*>([\s\S]*?)<\/nav>/.exec(html);
  expect(m, "a mobile nav is rendered").not.toBeNull();
  return m![0];
};

describe("the site header on a phone", () => {
  it("shows every navigation item", () => {
    const m = mobileNav();
    for (const item of nav) expect(m).toContain(`>${item.label}<`);
  });

  it("puts the phone menu behind a native disclosure that needs no JavaScript", () => {
    const details = /<details[^>]*>\s*<summary[^>]*>[\s\S]*?<\/summary>[\s\S]*?<\/details>/.exec(html);
    expect(details, "a <details> with a <summary> is rendered").not.toBeNull();
    expect(details![0]).toContain('aria-label="Main, mobile"');
    expect(details![0]).toMatch(/<summary[^>]*>[\s\S]*Menu/);
    expect(details![0]).toMatch(/<details class="[^"]*\bmd:hidden\b/);
  });

  it("never scrolls sideways and never hides an item behind a fade", () => {
    expect(html).not.toMatch(/overflow-x-auto/);
    expect(html).not.toMatch(/bg-gradient-to-l/);
  });

  it("keeps the phone number in the top row, before the menu", () => {
    const topRow = html.slice(0, html.indexOf("<details"));
    expect(topRow).toContain(`href="${site.contact.phoneHref}"`);
    expect(topRow).toContain(site.contact.phone);
  });

  it("sticks to the top of the viewport", () => {
    expect(html).toMatch(/<header class="[^"]*\bsticky\b[^"]*\btop-0\b/);
  });

  it("makes every link and the menu control a 44 px target", () => {
    const controls = [...html.matchAll(/<(?:a|summary) [^>]*class="([^"]*)"/g)].map((m) => m[1]!);
    expect(controls.length).toBeGreaterThanOrEqual(nav.length * 2 + 2);
    for (const cls of controls) expect(cls, cls).toMatch(/\bmin-h-11\b/);
  });

  it("hides the phone menu where the desktop nav takes over", () => {
    expect(html).toMatch(/<nav aria-label="Main" class="[^"]*\bmd:flex\b/);
  });
});

describe("the two items that are conversions carry weight", () => {
  /* Audit 2026-09-13: six equal items, no primary. Properties is where a
     buyer goes and Valuation is where a seller goes; the other four are
     reading. The flag lives in lib/site.ts so the header and the phone menu
     read one definition. */
  const primary = nav.filter((i) => i.primary).map((i) => i.href);
  const secondary = nav.filter((i) => !i.primary).map((i) => i.href);

  it("are Properties and Valuation, and only those", () => {
    expect(primary).toEqual(["/properties", "/valuation"]);
    expect(secondary).toHaveLength(nav.length - 2);
  });

  it("are set heavier than the rest in both the desktop nav and the phone menu", () => {
    for (const href of primary) {
      const links = [...html.matchAll(new RegExp(`<a href="${href}" class="([^"]*)"`, "g"))].map((m) => m[1]!);
      expect(links.length, href).toBe(2);
      for (const cls of links) expect(cls, `${href}: ${cls}`).toMatch(/\bfont-medium\b/);
    }
    for (const href of secondary) {
      for (const m of html.matchAll(new RegExp(`<a href="${href}" class="([^"]*)"`, "g"))) {
        expect(m[1], `${href}: ${m[1]}`).not.toMatch(/\bfont-medium\b/);
      }
    }
  });
});

describe("what a sticky header asks of the rest of the page", () => {
  const css = readFileSync(join(root, "app", "globals.css"), "utf-8");
  const listing = readFileSync(join(root, "app", "properties", "[reference]", "page.tsx"), "utf-8");

  it("globals.css reserves scroll padding, so an anchor target is not hidden beneath the header", () => {
    expect(css).toMatch(/scroll-padding-top:\s*[4-6]rem/);
  });

  it("the listing page's pinned enquiry column starts below the header, not under it", () => {
    // lg:top-8 would slide the card beneath a sticky header on every scroll.
    expect(listing).toMatch(/id="enquire"[^>]*className="[^"]*\blg:top-2[0-9]\b/);
    expect(listing).not.toMatch(/\blg:top-8\b/);
  });
});
