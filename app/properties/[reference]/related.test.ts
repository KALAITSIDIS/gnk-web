import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { afterEach, describe, expect, it, vi } from "vitest";

/**
 * The listing page carries an onward path.
 *
 * Rendered as the server renders it, against a faked feed shaped like the
 * live book of 2026-09-13 (PAF0001 and PAF0003 in Peyia / Coral Bay,
 * PAF0004 in Kato Paphos). The page asks the CRM for its own listing by
 * reference and for the book; the fetch mock answers each by its URL.
 */
vi.mock("next/navigation", () => ({
  notFound: () => {
    throw new Error("notFound");
  },
  permanentRedirect: (to: string) => {
    throw new Error(`redirect ${to}`);
  },
}));
vi.mock("next/link", () => ({
  default: (props: { href: string; className?: string; children: unknown }) =>
    createElement("a", { href: props.href, className: props.className }, props.children as never),
}));
vi.mock("next/image", () => ({
  default: (props: { src: string; alt: string }) => createElement("img", { src: props.src, alt: props.alt }),
}));

const row = (reference: string, area: string, property_type: string) => ({
  reference,
  kind: "standalone",
  property_type,
  transaction_type: "sale",
  title: { en: `${reference} title` },
  short_description: { en: "" },
  public_description: { en: "A paragraph about it." },
  district: { en: "Paphos" },
  area: { en: area },
  sea_distance_m: null,
  currency: "EUR",
  asking_price: 450_000,
  rent_price_month: null,
  vat_status: null,
  covered_area_sqm: 185,
  plot_area_sqm: null,
  veranda_sqm: null,
  roof_garden_sqm: null,
  basement_sqm: null,
  bedrooms: 3,
  bathrooms: 3,
  wc: null,
  parking_spaces: null,
  has_storage: null,
  floor_number: null,
  total_floors: null,
  year_built: 2007,
  energy_class: null,
  features: [],
  title_deed_status: "separate",
  construction_status: null,
  delivery_date: null,
  published_at: null,
  updated_at: null,
  images: [],
});

const BOOK = [row("PAF0004", "Kato Paphos", "apartment"), row("PAF0003", "Peyia / Coral Bay", "land"), row("PAF0001", "Peyia / Coral Bay", "villa")];

function fakeFeed(book: ReturnType<typeof row>[]) {
  vi.spyOn(globalThis, "fetch").mockImplementation(((input: string | URL | Request) => {
    const url = new URL(String(input instanceof Request ? input.url : input));
    const wanted = url.searchParams.get("reference")?.toLowerCase();
    const listings = wanted ? book.filter((l) => l.reference.toLowerCase() === wanted) : book;
    return Promise.resolve(
      new Response(JSON.stringify({ org: "gnk", count: listings.length, limit: 50, offset: 0, listings }), {
        status: 200,
        headers: { "content-type": "application/json" },
      }),
    );
  }) as never);
}

afterEach(() => vi.restoreAllMocks());

const render = async (reference: string) => {
  const { default: PropertyPage } = await import("./page");
  return renderToStaticMarkup(await PropertyPage({ params: Promise.resolve({ reference }) }));
};

describe("the onward path on a listing page", () => {
  it("shows the other listings, closest first, under a heading that names what they share", async () => {
    fakeFeed(BOOK);
    const html = await render("PAF0001");
    const section = /<section[^>]*aria-labelledby="related-heading"[\s\S]*?<\/section>/.exec(html);
    expect(section, "a related section is rendered").not.toBeNull();
    // One sibling in Peyia, one in Kato Paphos: the district is the honest name.
    expect(section![0]).toContain("Other properties in Paphos");
    const refs = [...section![0].matchAll(/href="\/properties\/(PAF\d{4})"/g)].map((m) => m[1]);
    expect(refs).toEqual(["PAF0003", "PAF0004"]);
  });

  it("never links a listing to itself", async () => {
    fakeFeed(BOOK);
    const html = await render("PAF0001");
    expect(html).not.toMatch(/href="\/properties\/PAF0001"/);
  });

  it("renders no section at all for a book of one", async () => {
    fakeFeed([BOOK[2]!]);
    const html = await render("PAF0001");
    expect(html).not.toMatch(/related-heading/);
    expect(html).not.toMatch(/Other properties/);
  });
});
