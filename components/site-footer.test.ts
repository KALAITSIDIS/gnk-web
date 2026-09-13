import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it, vi } from "vitest";
import { nav } from "@/lib/site";

/**
 * Every link in the footer is a 44 px target. Measured 2026-09-13 on an
 * iPhone 13 viewport: the footer's page links and contact links were 17 px
 * tall, which is under the size a thumb needs (WCAG 2.5.8 asks 24 px, Apple
 * and Material 44/48). The list keeps its rhythm; the padding lives on the
 * link, so the hit area grows without the column growing much.
 */
vi.mock("next/link", () => ({
  default: (props: { href: string; className?: string; children: unknown }) =>
    createElement("a", { href: props.href, className: props.className }, props.children as never),
}));

const { SiteFooter } = await import("./site-footer");
const html = renderToStaticMarkup(createElement(SiteFooter));

describe("the site footer", () => {
  it("lists every page", () => {
    for (const item of nav) expect(html).toContain(`href="${item.href}"`);
  });

  it("makes every link a 44 px target", () => {
    const links = [...html.matchAll(/<a [^>]*class="([^"]*)"/g)].map((m) => m[1]!);
    expect(links.length).toBeGreaterThanOrEqual(nav.length + 3);
    for (const cls of links) expect(cls, cls).toMatch(/\bmin-h-11\b/);
  });
});
