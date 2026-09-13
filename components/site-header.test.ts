import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it, vi } from "vitest";
import { nav, site } from "@/lib/site";

/**
 * The header on a phone.
 *
 * Measured 2026-09-13 at 375 px: the mobile nav row was 462 px wide, so
 * "About" was cut and "Contact" — the primary call to action — started
 * off-screen behind a gradient that only hinted at the overflow (audit
 * WEB-02). Six short items do not need a hamburger and its JavaScript; they
 * need to be allowed to wrap. So: every item visible, nothing scrolling
 * sideways, no fade pretending to be a control, and the phone number kept in
 * the top row where a thumb reaches it.
 */
vi.mock("next/link", () => ({
  default: (props: { href: string; className?: string; children: unknown }) =>
    createElement("a", { href: props.href, className: props.className }, props.children as never),
}));

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

  it("wraps instead of scrolling sideways", () => {
    const m = mobileNav();
    expect(m).toMatch(/class="[^"]*\bflex-wrap\b/);
    expect(html).not.toMatch(/overflow-x-auto/);
    expect(html).not.toMatch(/bg-gradient-to-l/);
  });

  it("keeps the phone number in the top row", () => {
    const topRow = html.slice(0, html.indexOf("<nav aria-label=\"Main, mobile\""));
    expect(topRow).toContain(`href="${site.contact.phoneHref}"`);
    expect(topRow).toContain(site.contact.phone);
  });

  it("hides the phone nav on wider screens where the desktop nav takes over", () => {
    expect(mobileNav()).toMatch(/class="[^"]*\bmd:hidden\b/);
    expect(html).toMatch(/<nav aria-label="Main" class="[^"]*\bmd:flex\b/);
  });
});
