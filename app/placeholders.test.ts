import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { feedRow } from "@/lib/feed-fixtures";

/**
 * No page publishes a placeholder as content.
 *
 * On 2026-09-13 the live home page carried, under a heading promising "Two
 * names, on every mandate", two cards reading "Photograph to follow", "Name
 * to follow" and "Biography to follow"; the About page repeated them under
 * "The principals", and the contact page ended its address list with "Full
 * office address to follow". To the sceptical buyer the copy is written for,
 * a promise of two names above two anonymous cards reads as evasion, which
 * is worse than the section not being there.
 *
 * The rule the rest of the site already follows — a development's bedrooms,
 * a listing's VAT, the licence line in the footer — is that a fact renders
 * when the source holds it and is withheld otherwise. lib/site.ts keeps its
 * nulls and its TODOs; the pages simply stop drawing boxes around them. A
 * principal appears the day lib/site.ts carries a name.
 */
vi.mock("next/link", () => ({
  default: (props: { href: string; className?: string; children: unknown }) =>
    createElement("a", { href: props.href, className: props.className }, props.children as never),
}));
vi.mock("next/image", () => ({
  default: (props: { src: string; alt: string }) => createElement("img", { src: props.src, alt: props.alt }),
}));
/* The book the home page is rendered with. Empty by default — and that
   default is how "Photography to follow" sat on every live card while this
   file passed: with no listing there is no card to carry it (2026-10-18).
   The book as published (three listings, no photograph) is tested below. */
const book = vi.hoisted(() => ({ listings: [] as unknown[] }));
vi.mock("@/lib/crm", () => ({
  getListings: async () => ({ ok: true, listings: book.listings }),
}));

const PLACEHOLDER = /to follow/i;

beforeEach(() => {
  vi.resetModules();
  book.listings = [];
});

describe("with the principals still unnamed (lib/site.ts as it is)", () => {
  it("the home page draws no placeholder cards, and promises no names it does not show", async () => {
    const { default: HomePage } = await import("./page");
    const html = renderToStaticMarkup(await HomePage());
    expect(html).not.toMatch(PLACEHOLDER);
    // "Two names, on every mandate." stood over no names at all (measured
    // live 2026-10-18): a heading's promise is a placeholder too.
    expect(html).not.toMatch(/two names/i);
    expect(html).toContain("The person who values a property negotiates it.");
    expect(html).toContain("More about the firm");
  });

  it("the home page with the book as published — three listings, no photograph — says so plainly", async () => {
    book.listings = (["PAF0004", "PAF0003", "PAF0001"] as const).map((reference) => ({
      ...feedRow({ reference }),
      images: [],
    }));
    const { default: HomePage } = await import("./page");
    const html = renderToStaticMarkup(await HomePage());
    expect(html).not.toMatch(PLACEHOLDER);
    expect(html.match(/No photographs yet/g)).toHaveLength(3);
    expect(html).not.toMatch(/<img/);
  });

  it("the about page says the section is being completed, and draws no cards", async () => {
    const { default: AboutPage } = await import("./about/page");
    const html = renderToStaticMarkup(AboutPage());
    expect(html).not.toMatch(PLACEHOLDER);
    expect(html).toContain("The principals");
    expect(html).toContain("+357 94 000015");
  });

  it("the contact page lists what it knows and stops", async () => {
    const { default: ContactPage } = await import("./contact/page");
    const html = renderToStaticMarkup(ContactPage());
    expect(html).not.toMatch(PLACEHOLDER);
    expect(html).toContain("Paphos, Cyprus");
  });
});

describe("the day a principal is named", () => {
  it("both pages render the card, from the same source", async () => {
    vi.doMock("@/lib/site", async () => {
      const real = await vi.importActual<typeof import("@/lib/site")>("@/lib/site");
      const named = {
        name: "A. Example",
        role: "Principal",
        bio: "Twenty years of pricing Paphos property.",
        photo: null,
        phone: null,
        email: null,
      };
      return { ...real, site: { ...real.site, principals: [named, real.site.principals[1]] } };
    });
    const { default: HomePage } = await import("./page");
    const { default: AboutPage } = await import("./about/page");
    const home = renderToStaticMarkup(await HomePage());
    const about = renderToStaticMarkup(AboutPage());
    for (const html of [home, about]) {
      expect(html).toContain("A. Example");
      expect(html).toContain("Twenty years of pricing Paphos property.");
      expect(html).not.toMatch(PLACEHOLDER);
    }
    vi.doUnmock("@/lib/site");
  });
});
