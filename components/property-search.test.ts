import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { beforeEach, describe, expect, it, vi } from "vitest";
import type { Listing } from "@/lib/crm";

/**
 * The search bar reads its state from the URL and writes it back.
 *
 * Rendered on the server with Next's navigation hooks replaced by a URL of
 * our choosing, which is enough to prove the half that matters for a shared
 * link: what a visitor sees when they arrive with `?type=villa` in the
 * address bar. The other half — a change writing itself to the URL — is a
 * router call the component makes, asserted on the mock. The one-answer rule
 * (a control renders only when it has more than one answer), the three empty
 * states and the small-book grid are untouched and their tests still pass.
 */
const state = vi.hoisted(() => ({ search: "", replace: vi.fn() }));
vi.mock("next/navigation", () => ({
  useSearchParams: () => new URLSearchParams(state.search),
  usePathname: () => "/properties",
  useRouter: () => ({ replace: state.replace }),
}));
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
  state.replace.mockClear();
  return renderToStaticMarkup(createElement(PropertySearch, { listings: BOOK }));
};
/** Card order by reference — a card links to its page twice (photo and title), so dedupe in order. */
const cards = (html: string) => [
  ...new Set([...html.matchAll(/href="\/properties\/(PAF\d{4})"/g)].map((m) => m[1]!)),
];

beforeEach(() => {
  state.replace.mockClear();
});

describe("arriving with a URL", () => {
  it("shows every listing on the clean URL and no chips", () => {
    const html = render("");
    expect(new Set(cards(html))).toEqual(new Set(["PAF0004", "PAF0003", "PAF0001"]));
    expect(html).not.toMatch(/Clear all/);
  });

  it("applies ?type= from the URL and shows the chip with a way to remove it", () => {
    const html = render("type=villa");
    expect(new Set(cards(html))).toEqual(new Set(["PAF0001"]));
    expect(html).toMatch(/Villa/);
    expect(html).toMatch(/Clear all/);
    expect(html).toMatch(/aria-label="Remove filter: Villa"/);
  });

  it("applies ?max= and ?beds= together", () => {
    const html = render("max=500000&beds=2");
    expect(new Set(cards(html))).toEqual(new Set(["PAF0004", "PAF0001"]));
  });

  it("orders by price when asked, cheapest first, and the land card shows its plot", () => {
    const html = render("sort=price-asc");
    expect(cards(html)).toEqual(["PAF0004", "PAF0001", "PAF0003"]);
    expect(html).toMatch(/980 m² plot/);
  });

  it("offers the sort control, since there is more than one priced listing", () => {
    const html = render("");
    expect(html).toMatch(/<select[^>]*name="sort"/);
    expect(html).toMatch(/Price: low to high/);
  });

  it("ignores a sort it does not know", () => {
    const html = render("sort=random");
    expect(cards(html)).toEqual(["PAF0004", "PAF0003", "PAF0001"]);
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
