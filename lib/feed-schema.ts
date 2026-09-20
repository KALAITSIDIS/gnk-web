import { z } from "zod";

/**
 * The CRM's feed, described in a way a test can check a PAYLOAD against.
 *
 * WHY THIS EXISTS. Until 2026-09-20 `interface Listing` in lib/crm.ts was a
 * compile-time claim and nothing more: the feed was JSON off the wire, `as
 * FeedResponse` was a cast, and TypeScript had never looked at a single byte
 * the CRM actually sent. What stood in for that was one assertion — the first
 * live row's KEY NAMES equal the interface's key names — which is real drift
 * detection and is blind to everything else: a `numeric` that started arriving
 * as a string, an `images` array whose members changed shape, a null in a
 * column the site multiplies, a second row unlike the first, and the
 * envelope's own pagination fields, which decide when the paging loop stops
 * and were checked by nothing at all.
 *
 * SINCE 2026-09-20 THE READER APPLIES IT. lib/crm.ts parses every feed
 * response with feedEnvelopeSchema — once, at the fetch boundary, never on
 * render — and refuses whatever fails as "unavailable": never as an empty
 * book, never as a 404, never as a book minus the bad row. `Listing` is
 * z.infer of feedRowSchema, so the type IS the check. For six days after this
 * file was written the schema was used by the tests alone while the reader
 * went on casting, and every fixture in "what the site must refuse" below
 * passed while the site served the same payloads whole (measured 2026-09-20,
 * lib/crm.validation.test.ts).
 *
 * SO: THIS IS THE CONTRACT, AND IT IS DELIBERATELY ASYMMETRIC.
 *
 *  - STRICT about what the site reads and would render wrongly: `reference` is
 *    a non-empty string (it is the identity, the URL and the sitemap entry), a
 *    price is a NUMBER or null, a multilingual field is an object of strings or
 *    null, `images` is an array of the five-key rendition object.
 *  - LOOSE about what the CRM may add: unknown keys pass through rather than
 *    failing, and the enum-backed columns are typed as plain strings. The CRM
 *    owns those vocabularies; a new `property_type` is an additive change on
 *    its side, and a consumer that refuses the whole feed over one would take
 *    the site down for a listing it merely did not recognise. The site already
 *    renders an unknown token gracefully (lib/format.ts `label`).
 *
 * NUMBERS ARE NUMBERS. `asking_price` is `numeric(14,2)` (gnk-crm 0085:72) and
 * PostgREST serialises it as a JSON number, measured against both the local
 * stack and the hosted project. Typing it as a string here — or coercing it in
 * the application — would be wrong in the more expensive direction, because it
 * would pass on a feed that had genuinely started sending strings.
 */

/** One rendition set, as the CRM builds it — exactly these five keys. */
export const feedImageSchema = z.looseObject({
  thumb: z.string().nullable(),
  card: z.string().nullable(),
  full: z.string().nullable(),
  /** jsonb, and `{}` until somebody writes alt text (gnk-crm 0086). */
  alt: z.record(z.string(), z.string().nullable()).nullable().optional(),
  watermarked: z.boolean().nullable().optional(),
});

/** A language-keyed jsonb column: `{en, el, ru}`, any subset, or null. */
const multilang = z
  .looseObject({
    en: z.string().nullable().optional(),
    el: z.string().nullable().optional(),
    ru: z.string().nullable().optional(),
  })
  .nullable();

const num = z.number().nullable();
const int = z.number().int().nullable();
const str = z.string().nullable();

/**
 * One row of `public_listings()`. The column list and its SQL types are
 * gnk-crm supabase/migrations/0085_adviser_view.sql:59-96 — the migration that
 * currently owns the function — and the order below is that migration's.
 */
export const feedRowSchema = z.looseObject({
  /* Non-blank, not merely non-empty: the reader used to trim a reference and
     drop the row on its own; that guard lives here now, where refusing is
     the whole payload's answer. */
  reference: z.string().regex(/\S/, "reference is blank"),
  kind: z.string(),
  property_type: z.string(),
  transaction_type: z.string(),
  title: multilang,
  short_description: multilang,
  /* Optional: a feed served by a database before 0085 simply does not carry
     it, and an absent adviser view is the same as an empty one. */
  adviser_view: multilang.optional(),
  public_description: multilang,
  district: multilang,
  area: multilang,
  sea_distance_m: int,
  currency: str,
  asking_price: num,
  rent_price_month: num,
  vat_status: str,
  covered_area_sqm: num,
  plot_area_sqm: num,
  veranda_sqm: num,
  roof_garden_sqm: num,
  basement_sqm: num,
  bedrooms: int,
  bathrooms: int,
  wc: int,
  parking_spaces: int,
  has_storage: z.boolean().nullable(),
  floor_number: int,
  total_floors: int,
  year_built: int,
  energy_class: str,
  features: z.array(z.string()).nullable(),
  title_deed_status: str,
  construction_status: str,
  /** `date` (0085:92) — a calendar day, `2099-10-01`. See lib/format.ts. */
  delivery_date: z
    .string()
    .regex(/^\d{4}-\d{2}-\d{2}$/, "delivery_date is a date column: YYYY-MM-DD")
    .nullable(),
  /** `timestamptz` — an instant, unlike delivery_date. */
  published_at: str,
  updated_at: str,
  images: z.array(feedImageSchema).nullable(),
});

/**
 * The envelope, whose pagination fields decide when lib/crm.ts stops paging.
 *
 * `limit` is the CRM's own cap echoed back, and the site reads it rather than
 * carrying a copy of the number; if it ever stopped being a positive integer
 * the paging loop would treat every feed as one page and the 51st listing would
 * disappear from the site with nothing raised. Nothing checked it.
 */
export const feedEnvelopeSchema = z.looseObject({
  org: z.string().min(1),
  count: z.number().int().nonnegative(),
  limit: z.number().int().positive(),
  offset: z.number().int().nonnegative(),
  /** Echoed only on a `?reference=` lookup (gnk-crm 0088). */
  reference: z.string().optional(),
  listings: z.array(feedRowSchema),
});

/**
 * The shapes as PARSED — what the reader hands the rest of the site. lib/crm.ts
 * re-exports the first three as Listing, ListingImage and Multilang, so there
 * is one definition of a row and the type is the parser's guarantee.
 */
export type FeedRow = z.infer<typeof feedRowSchema>;
export type FeedImage = z.infer<typeof feedImageSchema>;
export type FeedMultilang = z.infer<typeof multilang>;
export type FeedEnvelope = z.infer<typeof feedEnvelopeSchema>;

/**
 * The 36 keys the CRM's allowlist pins, in the feed's own order.
 *
 * Derived from the schema rather than written out a second time, so the list
 * and the value rules cannot drift apart.
 */
export const FEED_KEYS: readonly string[] = Object.keys(feedRowSchema.shape);

/** The five keys of a rendition object. */
export const FEED_IMAGE_KEYS: readonly string[] = Object.keys(feedImageSchema.shape);

/**
 * A human-readable list of what a payload got wrong, or [] when it is sound.
 * Used by the tests. The application parses once per HTTP response, in
 * lib/crm.ts, and reports with feedIssueSummary below; nothing parses on
 * render.
 */
export function feedProblems(payload: unknown): string[] {
  const parsed = feedEnvelopeSchema.safeParse(payload);
  if (parsed.success) return [];
  return parsed.error.issues.map((i) => `${i.path.join(".") || "(root)"}: ${i.message}`);
}

/**
 * What the reader may LOG about a refused payload: the path of each problem
 * and the kind of problem, capped — never the value that was there. A feed
 * row is public, but the same line is written for every payload that fails
 * this schema whatever it turns out to be — a 200 that was really an error
 * page, a body from the wrong service — and a log line that quotes it is a
 * log line that quotes an unknown. Zod's own messages carry no input either,
 * but paths and codes are the part a reader of the log actually needs.
 */
export function feedIssueSummary(error: z.ZodError, cap = 8): string {
  // String(p): a path element is a PropertyKey, and join() throws on a symbol.
  // JSON.parse cannot produce one, and a throw inside the handler that reports
  // a refusal is not a thing to leave to that argument.
  const shown = error.issues
    .slice(0, cap)
    .map((i) => `${i.path.map(String).join(".") || "(root)"}: ${i.code}`);
  const more = error.issues.length - shown.length;
  return shown.join("; ") + (more > 0 ? `; +${more} more` : "");
}
