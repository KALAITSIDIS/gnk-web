import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { feedRow } from "@/lib/feed-fixtures";
import { site } from "@/lib/site";

/**
 * The home page's first screen and what it promises (2026-10-18).
 *
 * The three journeys are routed on the first screen; the book keeps a heading
 * and the search stays the first control inside it; the selling band states
 * the valuation's cost in the same two sentences as the valuation page; and
 * nothing on the page defines the firm against portals, developers or
 * "algorithms", claims a named person who is not named, or promises a buyer
 * that the advice "answers to" them above the firm's sellers' mandates.
 */
vi.mock("next/link", () => ({
  default: (props: { href: string; className?: string; children: unknown }) =>
    createElement("a", { href: props.href, className: props.className }, props.children as never),
}));
vi.mock("next/image", () => ({
  default: (props: { src: string; alt: string }) => createElement("img", { src: props.src, alt: props.alt }),
}));
const book = vi.hoisted(() => ({ listings: [] as unknown[] }));
vi.mock("@/lib/crm", () => ({
  getListings: async () => ({ ok: true, listings: book.listings }),
}));

const PUBLISHED = (["PAF0004", "PAF0003", "PAF0001"] as const).map((reference) => ({
  ...feedRow({ reference }),
  images: [],
}));

async function home(listings: unknown[] = PUBLISHED) {
  book.listings = listings;
  const { default: HomePage } = await import("./page");
  return renderToStaticMarkup(await HomePage());
}

beforeEach(() => {
  vi.resetModules();
});

/* Every case imports the page cold (resetModules), and the first one under
   a loaded machine took over vitest's 5 s default (review 2026-10-18). */
vi.setConfig({ testTimeout: 20_000 });

describe("the ways in", () => {
  it("routes a seller and an advisory client from the first screen, and a buyer from lg", async () => {
    const html = await home();
    const nav = /<nav aria-label="Where to start"[^>]*>([\s\S]*?)<\/nav>/.exec(html);
    expect(nav, "a labelled nav of the ways in").not.toBeNull();
    const items = [...nav![1]!.matchAll(/<li class="([^"]*)"[\s\S]*?<a href="([^"]+)"[^>]*>([^<]+)/g)].map((m) => ({
      cls: m[1]!,
      href: m[2]!,
      action: m[3]!.trim(),
    }));
    expect(items.map((i) => [i.href, i.action])).toEqual([
      ["/properties#brief", "Send us a brief"],
      ["/valuation", "Request a valuation"],
      ["/services", "What we advise on"],
    ]);
    // On a phone the search beneath IS the buyer's way in.
    expect(items[0]!.cls).toMatch(/(^|\s)hidden(\s|$)/);
    expect(items[0]!.cls).toMatch(/\blg:grid\b/);
    for (const i of items.slice(1)) expect(i.cls).not.toMatch(/(^|\s)hidden(\s|$)/);
  });

  it("comes after the statement and before the search, in the DOM as on the screen", async () => {
    const html = await home();
    const h1 = html.indexOf("<h1");
    const nav = html.indexOf('<nav aria-label="Where to start"');
    const search = html.indexOf('type="search"');
    expect(h1).toBeGreaterThan(-1);
    expect(nav).toBeGreaterThan(h1);
    expect(search).toBeGreaterThan(nav);
  });

  it("says on a phone that this is an advisory: the eyebrow is not hidden at any width", async () => {
    const html = await home();
    expect(html).toMatch(new RegExp(`<p class="eyebrow">${site.tagline}</p>`));
  });
});

describe("the book", () => {
  it("has a heading the outline can find, and an anchor", async () => {
    const html = await home();
    expect(html).toMatch(/<section id="properties" aria-labelledby="current-properties"/);
    expect(html).toMatch(/<h2 id="current-properties"[^>]*>Current properties<\/h2>/);
  });

  it("closes with the off-list route — a brief and WhatsApp — beneath the results", async () => {
    const html = await home();
    // The block itself, not "everything after the last card": the people
    // section further down carries its own WhatsApp link, and an unbounded
    // slice let this pass with the off-list link removed (review 2026-10-18).
    const block = /<div[^>]*>\s*<p[^>]*>Not on the list\?[\s\S]*?<\/div>/.exec(html);
    expect(block, "the off-list block").not.toBeNull();
    expect(html.indexOf("Not on the list?")).toBeGreaterThan(html.lastIndexOf("<article"));
    expect(block![0]).toMatch(/<a href="\/properties#brief"[^>]*>Send us a brief/);
    expect(block![0]).toContain(`href="${site.contact.whatsappHref}"`);
  });

  it("does not, on an empty book, where the empty state already invites the brief", async () => {
    const html = await home([]);
    expect(html).not.toContain("Not on the list?");
    expect(html).toContain("Our current mandates are being prepared.");
  });
});

describe("what the page promises", () => {
  it("states the valuation's cost in both sentences, as the valuation page does", async () => {
    const html = await home();
    expect(html).toContain(site.valuationTerms);
    expect(site.valuationTerms).toMatch(/cost nothing/);
    expect(site.valuationTerms).toMatch(/tell you the fee before we start/);
    const { default: ValuationPage } = await import("./valuation/page");
    expect(renderToStaticMarkup(ValuationPage())).toContain(site.valuationTerms);
  });

  it("defines the firm by what the client gets, not against portals, developers or algorithms", async () => {
    const { default: ValuationPage, metadata: valuationMeta } = await import("./valuation/page");
    const { metadata: aboutMeta } = await import("./about/page");
    const surfaces = {
      home: await home(),
      valuation: renderToStaticMarkup(ValuationPage()),
      "valuation description": String(valuationMeta.description),
      "about description": String(aboutMeta.description),
    };
    const RETIRED =
      /portal is paid|developer sells|algorithm|automated estimate|named (?:person|adviser)|principals, named|two names|on your side|answers to you|to follow/i;
    for (const [where, text] of Object.entries(surfaces)) expect(text, where).not.toMatch(RETIRED);
  });
});
