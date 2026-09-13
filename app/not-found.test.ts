import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it, vi } from "vitest";

/**
 * The generic 404 names itself. It carried the site's default title, so the
 * tab, the history entry and a bookmark all read as the home page (second
 * pass, 2026-09-13). A metadata export on the not-found file is what works
 * in this Next — measured on the production build, the head carried the
 * title through the layout's template. A rendered <title> and a client-side
 * document.title were both tried and both lost to the layout's metadata;
 * this pins the one that held.
 */
vi.mock("next/link", () => ({
  default: (props: { href: string; className?: string; children: unknown }) =>
    createElement("a", { href: props.href, className: props.className }, props.children as never),
}));

const { default: NotFound, metadata } = await import("./not-found");
const html = renderToStaticMarkup(createElement(NotFound));

describe("the 404 page", () => {
  it("declares its own title, which the layout's template completes", () => {
    expect(metadata.title).toBe("Page not found");
  });

  it("renders no <title> of its own — the metadata is the one mechanism", () => {
    expect(html).not.toMatch(/<title/);
  });

  it("still sends people to the properties page", () => {
    expect(html).toContain('href="/properties"');
  });
});
