import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it, vi } from "vitest";
import type { Listing } from "@/lib/crm";

/**
 * The card is one target.
 *
 * Measured on the live site 2026-09-13: the two most prominent things on a
 * card — the €285,000 and the "Apartment in Kato Paphos" line — did nothing
 * when clicked; the links were the photograph slot and a 20 px line reading
 * "PAF0004 — full detail →" at the bottom, and the cursor never changed over
 * the card body. Every portal a buyer has used makes the whole card the
 * target, so a mis-tap on a phone went nowhere.
 *
 * Now the price is the ONE link, stretched over the card with a pseudo-
 * element, and it carries the place line in its accessible name so a screen
 * reader hears "€285,000, Apartment in Kato Paphos, Paphos — view property"
 * rather than a bare figure. The visible affordance is a 44 px row at the
 * bottom; the reference stays there, small, for the person who phones and
 * reads it out.
 */
vi.mock("next/link", () => ({
  default: (props: { href: string; className?: string; children: unknown }) =>
    createElement("a", { href: props.href, className: props.className }, props.children as never),
}));
vi.mock("next/image", () => ({
  default: (props: { src: string; alt: string }) => createElement("img", { src: props.src, alt: props.alt }),
}));

const { PropertyCard } = await import("./property-card");

const villa = {
  reference: "PAF0001",
  kind: "standalone",
  property_type: "villa",
  transaction_type: "sale",
  title: { en: "Two-storey villa in Peyia / Coral Bay" },
  district: { en: "Paphos" },
  area: { en: "Peyia / Coral Bay" },
  short_description: { en: "Two-storey villa about 1 km from the sea." },
  currency: "EUR",
  asking_price: 450_000,
  bedrooms: 3,
  bathrooms: 3,
  covered_area_sqm: 185,
  title_deed_status: "separate",
  features: ["sea_view", "communal_pool"],
  images: [],
} as unknown as Listing;

const html = renderToStaticMarkup(createElement(PropertyCard, { listing: villa }));

describe("a property card", () => {
  it("links to its page exactly once", () => {
    expect(html.match(/href="\/properties\/PAF0001"/g)).toHaveLength(1);
  });

  it("stretches that one link over the whole card", () => {
    const link = /<a href="\/properties\/PAF0001" class="([^"]*)"/.exec(html);
    expect(link, "the link carries a class").not.toBeNull();
    expect(link![1]).toMatch(/\bafter:absolute\b/);
    expect(link![1]).toMatch(/\bafter:inset-0\b/);
    expect(html).toMatch(/<article class="[^"]*\brelative\b/);
  });

  it("names the property in the link, not just its price", () => {
    const link = /<a href="\/properties\/PAF0001"[^>]*>([\s\S]*?)<\/a>/.exec(html);
    expect(link![1]).toContain("€450,000");
    expect(link![1]).toContain("Villa in Peyia / Coral Bay, Paphos");
  });

  it("shows a visible affordance and keeps the reference legible, not as the link text", () => {
    expect(html).toContain("View property");
    expect(html).toContain("PAF0001");
    expect(html).not.toContain("full detail");
  });

  it("changes on hover, so a pointer knows it is a target", () => {
    expect(html).toMatch(/<article class="[^"]*\bhover:border-accent\b/);
  });

  it("sets no text below 12 px", () => {
    expect(html).not.toMatch(/text-\[1[01]px\]/);
  });
});

describe("the plate where no photograph is (2026-10-18)", () => {
  /* Set like the title page of a set of particulars: what it is and where,
     then plainly that there are no photographs. One definition of what it
     is (lib/format.ts kindOf), so a development is never called a villa. */
  const plateOf = (h: string) => /<div class="placeholder[^"]*">([\s\S]*?)<\/div>\s*<\/div>/.exec(h)?.[1] ?? "";
  const render = (over: Record<string, unknown>) =>
    renderToStaticMarkup(createElement(PropertyCard, { listing: { ...villa, ...over } as unknown as Listing }));

  it("names the kind and the place, hidden from a screen reader that hears both in the link, and says there are no photographs", () => {
    const h = render({});
    expect(h).toMatch(/<div aria-hidden="true"><p[^>]*>Villa<\/p><p[^>]*>Peyia \/ Coral Bay<\/p><\/div>/);
    expect(h).toContain("No photographs yet");
  });

  it("calls a development a development, and draws no second Development badge over it", () => {
    const h = render({ kind: "project" });
    expect(h).toMatch(/<div aria-hidden="true"><p[^>]*>Villa development<\/p>/);
    expect(h).not.toMatch(/>Development</);
  });

  it("falls back to the district when the listing has no area", () => {
    const h = render({ area: null });
    expect(h).toMatch(/<div aria-hidden="true"><p[^>]*>Villa<\/p><p[^>]*>Paphos<\/p><\/div>/);
  });

  it("never says 'no photographs' when the feed holds photographs without a card rendition", () => {
    // The contract allows a null rendition (lib/feed-schema.ts); that listing
    // HAS photographs, and the plate must not deny it.
    const h = render({ images: [{ thumb: null, card: null, full: null, alt: {}, watermarked: false }] });
    expect(h).not.toContain("No photographs yet");
    expect(plateOf(h)).toContain("Villa");
  });

  it("is replaced by the photograph when there is one, in the same 3:2 box", () => {
    const h = render({ images: [{ thumb: "t.jpg", card: "c.jpg", full: "f.jpg", alt: { en: "The terrace" }, watermarked: true }] });
    expect(h).toMatch(/<div class="relative aspect-\[3\/2\][^"]*"><img src="c.jpg" alt="The terrace"/);
    expect(h).not.toContain("No photographs yet");
  });
});
