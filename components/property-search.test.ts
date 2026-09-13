import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { beforeEach, describe, expect, it, vi } from "vitest";
import type { Listing } from "@/lib/crm";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");

/**
 * The search bar, as the server renders it.
 *
 * The URL state (`?q&type&beds&max&sort`) is read on the client after
 * hydration and written back with history.replaceState; lib/search.ts owns
 * the reading, writing and sorting and lib/search-state.test.ts pins them.
 * What THIS file pins is the server's output, which is what a crawler and a
 * visitor's first paint get: the whole book, always. The one-answer rule
 * (a control renders only when it has more than one answer), the three empty
 * states and the small-book grid are untouched and their tests still pass.
 */
const state = vi.hoisted(() => ({ search: "" }));
// The server has no window; the component's server snapshot is the empty
// URL. `state.search` is what a request URL would carry, and the point of the
// tests below is that the server output does not depend on it.
vi.mock("next/navigation", () => ({ usePathname: () => "/properties" }));
vi.mock("next/link", () => ({
  default: (props: { href: string; className?: string; children: unknown }) =>
    createElement("a", { href: props.href, className: props.className }, props.children as never),
}));
vi.mock("next/image", () => ({
  default: (props: { src: string; alt: string }) => createElement("img", { src: props.src, alt: props.alt }),
}));

const { PropertySearch } = await import("./property-search");

const listing = (over: Partial<Listing>): Listing =>
  ({
    kind: "standalone",
    transaction_type: "sale",
    title: { en: "T" },
    district: { en: "Paphos" },
    area: { en: "Peyia / Coral Bay" },
    currency: "EUR",
    images: [],
    features: [],
    ...over,
  }) as unknown as Listing;

const BOOK = [
  listing({ reference: "PAF0004", property_type: "apartment", asking_price: 285_000, bedrooms: 2, bathrooms: 1, covered_area_sqm: 92 }),
  listing({ reference: "PAF0003", property_type: "land", asking_price: 780_000, plot_area_sqm: 980 }),
  listing({ reference: "PAF0001", property_type: "villa", asking_price: 450_000, bedrooms: 3, bathrooms: 3, covered_area_sqm: 185 }),
];

const render = (search: string) => {
  state.search = search;
  return renderToStaticMarkup(createElement(PropertySearch, { listings: BOOK }));
};
/** Card order by reference — a card links to its page twice (photo and title), so dedupe in order. */
const cards = (html: string) => [
  ...new Set([...html.matchAll(/href="\/properties\/(PAF\d{4})"/g)].map((m) => m[1]!)),
];

beforeEach(() => {
  state.search = "";
});

describe("the server HTML always carries the whole book", () => {
  /* THE INVARIANT THAT WAS BROKEN FOR 40 MINUTES ON 2026-09-13. Reading the
     URL with useSearchParams inside a Suspense boundary made Next prerender
     the fallback and render the search on the client only: the live home
     and list pages shipped with NO listing cards in their HTML — nothing for
     a crawler, nothing before hydration. The URL is therefore read after
     hydration, and the server render is the unfiltered book whatever the URL
     says; a filtered deep link is applied the moment the page is interactive. */
  it("renders every card and no chips, even when the request URL carries a filter", () => {
    for (const search of ["", "type=villa", "max=500000&beds=2", "sort=price-asc"]) {
      const html = render(search);
      expect(new Set(cards(html)), search).toEqual(new Set(["PAF0004", "PAF0003", "PAF0001"]));
      expect(html, search).not.toMatch(/Clear all/);
      expect(html, search).not.toMatch(/Remove filter/);
    }
  });

  it("keeps the feed's order on the server — sorting is a client decision", () => {
    expect(cards(render("sort=price-asc"))).toEqual(["PAF0004", "PAF0003", "PAF0001"]);
  });

  it("shows the land card's plot", () => {
    expect(render("")).toMatch(/980 m² plot/);
  });

  it("offers the sort control, since there is more than one priced listing", () => {
    const html = render("");
    expect(html).toMatch(/<select[^>]*name="sort"/);
    expect(html).toMatch(/Price: low to high/);
  });

  it("does not reach for useSearchParams or a Suspense boundary — that is what emptied the HTML", () => {
    // A call or an import, not the word: the component's own comment names the
    // hook to say why it is avoided, and a guard that trips on its explanation
    // is the trap this repo has recorded twice.
    const src = readFileSync(join(root, "components", "property-search.tsx"), "utf-8");
    expect(src).not.toMatch(/useSearchParams\s*\(|import[^;]*\buseSearchParams\b/);
    for (const page of ["app/page.tsx", "app/properties/page.tsx"]) {
      const p = readFileSync(join(root, page), "utf-8");
      expect(p, page).not.toMatch(/<Suspense/);
    }
  });
});

describe("the one-answer rule still holds", () => {
  it("renders no sort control when only one listing has a sale price", () => {
    state.search = "";
    const html = renderToStaticMarkup(
      createElement(PropertySearch, { listings: [BOOK[0]!, listing({ reference: "PAF0009", property_type: "villa", asking_price: null })] }),
    );
    expect(html).not.toMatch(/name="sort"/);
  });
});
