/**
 * The CRM's public API — the site's only source of data, and its only
 * dependency of any kind.
 *
 * No Supabase client, no keys, no service role. If this site were compromised
 * tomorrow, the attacker would gain the ability to read published listings and
 * submit an enquiry, which is what any visitor already has. Keep it that way.
 *
 * Feed contract: migrations 0066 (the feed), 0073 (image renditions) and 0084
 * (the enquiry door) in KALAITSIDIS/gnk-crm.
 */

const CRM = process.env.CRM_API_URL ?? "https://gnk-crm.vercel.app";
const ORG = process.env.CRM_ORG_SLUG ?? "gnk";

/** Seconds before a page rebuilds from the feed. The CRM sends max-age=60. */
export const FEED_REVALIDATE = 60;

/** A language-keyed string. Phase 1 renders English; el/ru arrive with the site's own translation. */
export type Multilang = { en?: string | null; el?: string | null; ru?: string | null } | null;

export interface ListingImage {
  card: string | null;
  thumb: string | null;
  full?: string | null;
  alt?: Multilang;
  is_cover?: boolean;
}

/** One row of `public_listings()`. Every field is nullable — the feed is honest about gaps. */
export interface Listing {
  reference: string;
  kind: string;
  property_type: string;
  transaction_type: string;
  title: Multilang;
  short_description: Multilang;
  public_description: Multilang;
  district: Multilang;
  area: Multilang;
  sea_distance_m: number | null;
  currency: string | null;
  asking_price: number | null;
  rent_price_month: number | null;
  vat_status: string | null;
  covered_area_sqm: number | null;
  plot_area_sqm: number | null;
  veranda_sqm: number | null;
  roof_garden_sqm: number | null;
  basement_sqm: number | null;
  bedrooms: number | null;
  bathrooms: number | null;
  wc: number | null;
  parking_spaces: number | null;
  has_storage: boolean | null;
  floor_number: number | null;
  total_floors: number | null;
  year_built: number | null;
  energy_class: string | null;
  features: string[] | null;
  title_deed_status: string | null;
  construction_status: string | null;
  delivery_date: string | null;
  published_at: string | null;
  updated_at: string | null;
  images: ListingImage[] | null;
}

interface FeedResponse {
  org: string;
  count: number;
  limit: number;
  offset: number;
  listings: Listing[];
}

/**
 * Every published listing.
 *
 * The whole feed in one request, deliberately: at this scale paging costs a
 * round trip and buys nothing, and holding the full set lets the search page
 * filter without a second call. If the portfolio ever outgrows one page this
 * is where paging goes — the caller's shape does not change.
 *
 * A failure returns an empty list rather than throwing. A site that 500s
 * because the CRM hiccupped is worse than one that shows its other pages and
 * says the listings are briefly unavailable.
 */
export async function getListings(): Promise<Listing[]> {
  try {
    const res = await fetch(`${CRM}/api/public/listings?org=${encodeURIComponent(ORG)}&limit=100`, {
      next: { revalidate: FEED_REVALIDATE },
    });
    if (!res.ok) {
      console.error(`[crm] feed responded ${res.status}`);
      return [];
    }
    const body = (await res.json()) as FeedResponse;
    return Array.isArray(body.listings) ? body.listings : [];
  } catch (err) {
    console.error("[crm] feed unreachable:", err);
    return [];
  }
}

export async function getListing(reference: string): Promise<Listing | null> {
  const all = await getListings();
  return all.find((l) => l.reference.toLowerCase() === reference.toLowerCase()) ?? null;
}

export interface EnquiryInput {
  name: string;
  email?: string;
  phone?: string;
  message?: string;
  property_reference?: string;
  /** Honeypot. A person never fills this; a bot fills every field it finds. */
  website?: string;
}

export type EnquiryResult = { ok: true } | { ok: false; error: string };

/**
 * Hand an enquiry to the CRM, which decides whether it becomes a lead.
 *
 * Called from a server route, never the browser: the CRM would accept a direct
 * post (it sends CORS *), but going through the server keeps the honeypot and
 * any future timing check out of reach of whoever is filling the form.
 */
export async function submitEnquiry(input: EnquiryInput): Promise<EnquiryResult> {
  try {
    const res = await fetch(`${CRM}/api/public/enquiries`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ org: ORG, ...input }),
      cache: "no-store",
    });
    if (res.status === 202) return { ok: true };
    if (res.status === 429) {
      return { ok: false, error: "Too many enquiries from this address. Please try again shortly." };
    }
    const body = (await res.json().catch(() => ({}))) as { error?: string };
    return { ok: false, error: body.error ?? "That enquiry could not be sent." };
  } catch (err) {
    console.error("[crm] enquiry failed:", err);
    return { ok: false, error: "That enquiry could not be sent. Please call or WhatsApp us." };
  }
}
