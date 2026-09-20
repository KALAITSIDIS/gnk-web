/**
 * Fixtures for the feed contract — test-only. Nothing under app/ or
 * components/ imports this file, so it ships in no bundle.
 *
 * Shared by lib/feed-schema.test.ts (which checks what the schema accepts and
 * refuses), lib/crm.validation.test.ts (which checks that the READER applies
 * it) and lib/crm.test.ts (pagination, retries, the moving book). One fixture
 * for all three, because the reader now refuses any row that is not a row:
 * a test that feeds it `{ reference, kind }` and expects a catalogue back is
 * testing a feed the CRM has never sent.
 *
 * `feedRow()` is a complete, well-formed row — every one of the 36 keys of
 * public_listings() (gnk-crm supabase/migrations/0085_adviser_view.sql:59-96),
 * plausibly filled. `feedEnvelope()` wraps rows the way the CRM's route does:
 * org, count, the page cap echoed back as `limit`, and the offset asked for.
 */
import { CURRENCY } from "@/lib/format";

export const feedRow = (over: Record<string, unknown> = {}): Record<string, unknown> => ({
  reference: "PAF0001",
  kind: "standalone",
  property_type: "villa",
  transaction_type: "sale",
  title: { en: "Two-storey villa in Peyia", el: null, ru: null },
  short_description: { en: "Three bedrooms across two floors." },
  adviser_view: { en: "The plot is the value here." },
  public_description: { en: "A detached villa on a 1,200 m² plot." },
  district: { en: "Paphos", el: "Πάφος" },
  area: { en: "Peyia" },
  sea_distance_m: 1400,
  // the feed's one currency, read from its one home (lib/format.test.ts holds it there)
  currency: CURRENCY,
  // numeric(14,2) — PostgREST sends a JSON number, measured on both stacks
  asking_price: 450000,
  rent_price_month: null,
  vat_status: "resale_no_vat",
  covered_area_sqm: 185,
  plot_area_sqm: 1200,
  veranda_sqm: 40,
  roof_garden_sqm: null,
  basement_sqm: null,
  bedrooms: 3,
  bathrooms: 3,
  wc: 1,
  parking_spaces: 2,
  has_storage: true,
  floor_number: null,
  total_floors: 2,
  year_built: 2007,
  energy_class: "B",
  features: ["sea_view", "private_pool"],
  title_deed_status: "separate",
  delivery_date: null,
  construction_status: "completed",
  published_at: "2026-09-01T09:12:44.191Z",
  updated_at: "2026-09-06T18:03:11.004Z",
  images: [
    {
      thumb: "https://x.supabase.co/storage/v1/object/public/media/a/thumb.jpg",
      card: "https://x.supabase.co/storage/v1/object/public/media/a/card.jpg",
      full: "https://x.supabase.co/storage/v1/object/public/media/a/full.jpg",
      alt: { en: "The pool terrace" },
      watermarked: true,
    },
  ],
  ...over,
});

export const feedEnvelope = (
  listings: unknown,
  over: Record<string, unknown> = {},
): Record<string, unknown> => ({
  org: "gnk",
  count: Array.isArray(listings) ? listings.length : 0,
  limit: 50,
  offset: 0,
  listings,
  ...over,
});

/** The fixture with one key removed outright — absent, not undefined. */
export const without = (obj: Record<string, unknown>, key: string): Record<string, unknown> => {
  const copy = { ...obj };
  delete copy[key];
  return copy;
};
