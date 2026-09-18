/**
 * The CRM's public API — the site's only source of data, and its only
 * dependency of any kind.
 *
 * No Supabase client, no keys, no service role. If this site were compromised
 * tomorrow, the attacker would gain the ability to read published listings and
 * submit an enquiry, which is what any visitor already has. Keep it that way.
 *
 * The ONE secret it holds, CRM_FORWARD_KEY, proves to the CRM that an enquiry
 * came through this site — so the CRM meters the visitor we forward instead
 * of metering the whole site as one address. It lifts no limit, reads nothing
 * and unlocks nothing; stolen, it is worth a per-visitor budget of five where
 * a stranger gets a shared one. See submitEnquiry.
 *
 * Feed contract: migrations 0066 (the feed), 0073 (image renditions), 0084
 * (the enquiry door) and 0085 (adviser_view; the current body of
 * public_listings) in KALAITSIDIS/gnk-crm.
 */
import { report } from "@/lib/report";

export const CRM = process.env.CRM_API_URL ?? "https://gnk-crm.vercel.app";
const ORG = process.env.CRM_ORG_SLUG ?? "gnk";

/**
 * The site's proof of identity to the CRM, read at call time as the platform
 * binds it. On an enquiry it makes the CRM meter the visitor we forward rather
 * than our one egress address; on a feed read it exempts the site from the
 * 120-per-quarter-hour meter a stranger gets (the CRM's REL-03, second pass —
 * a build reads every listing at once and the shared counter row serialised
 * it). Unset, both fall back to being metered as a stranger — weaker, not
 * broken. It opens nothing.
 */
const forwardKey = () => process.env.CRM_FORWARD_KEY ?? "";
const forwardHeaders = (): Record<string, string> => {
  const key = forwardKey();
  return key ? { "x-gnk-forward-key": key } : {};
};

/** Seconds before a page rebuilds from the feed. The CRM sends max-age=60. */
export const FEED_REVALIDATE = 60;

/** A language-keyed string. Phase 1 renders English; el/ru arrive with the site's own translation. */
export type Multilang = { en?: string | null; el?: string | null; ru?: string | null } | null;

/**
 * One photograph as the feed sends it: exactly {thumb, card, full, alt,
 * watermarked}.
 *
 * THE COVER IS ELEMENT 0. public_listings() orders `is_cover desc, sort_order,
 * created_at` (gnk-crm supabase/migrations/0085_adviser_view.sql) and carries
 * NO flag — gnk-crm RLS test 49 pins both halves (the cover leads even with a
 * later sort_order; exactly five keys), and it is the test that catches the
 * feed changing. This interface declared `is_cover` from the site's first
 * commit; the feed never sent it, and three lookups were right by accident.
 * CRM-side shape: lib/services/public-listings.ts FeedImage.
 */
export interface ListingImage {
  card: string | null;
  thumb: string | null;
  full?: string | null;
  alt?: Multilang;
  watermarked?: boolean;
}

/** One row of `public_listings()`. Every field is nullable — the feed is honest about gaps. */
export interface Listing {
  reference: string;
  kind: string;
  property_type: string;
  transaction_type: string;
  title: Multilang;
  short_description: Multilang;
  /* The firm's own judgement, written in the CRM's Marketing tab. Joined the
     feed's allowlist in gnk-crm migration 0085. Optional because a feed
     served before that migration simply will not carry it, and an absent
     view is the same as an empty one. What the page shows in its place is
     decided in app/properties/[reference]/page.tsx, not here: the summary —
     unless the summary merely repeats the opening of the description, in
     which case nothing. PAF0003 is that case, and four sentences across the
     two repos said "falls back to the summary" as if it were not. */
  adviser_view?: Multilang;
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
 * The whole feed, every page of it, in one call: holding the full set lets
 * the search page filter without a second request, and the callers' shape
 * does not change as the book grows — see getListings for how the pages are
 * read and why nothing partial is ever returned.
 *
 * A transport failure is REPORTED, not flattened into an empty list. The old
 * contract returned [] for a 503, a timeout and a genuinely empty book alike,
 * and every caller then had to guess which had happened — so a feed hiccup made
 * live client listings answer HTTP 404 (the signal that removes a URL from
 * Google's index) while the home page announced the firm had no properties.
 * Callers now get { ok: false } and can say "briefly unavailable", which is
 * what the paragraph above always claimed happened.
 */
export type FeedResult = { ok: true; listings: Listing[] } | { ok: false };

/** Long enough for a cold CRM function, short enough that nobody watches a spinner. */
const FEED_TIMEOUT_MS = 8000;

/**
 * The feed pages, and the site used to read one page. `limit=100` was written
 * here, once, as the whole book — so the 101st mandate would have answered 404
 * on its own page, vanished from the sitemap and the search, silently. The CRM
 * caps a page and ECHOES the cap in every response; this loop reads that back
 * rather than carrying its own copy of the number, and stops on the first short
 * page. Nothing partial is ever served: a page that fails, or a feed that keeps
 * returning full pages past MAX_PAGES, is {ok:false} for the whole call.
 *
 * Between pages the book can lawfully change — the CRM's edge holds a body for
 * up to 60s, so page 2 may come from a newer snapshot than page 1. The ETag's
 * hash prefix is that snapshot's name; on a mismatch the loop runs once more,
 * and if the book is still moving it serves the union and says so, because
 * refusing would take the whole site down for a minute after every publish.
 */
const MAX_PAGES = 50;

export async function getListings(): Promise<FeedResult> {
  const first = await readAllPages();
  if (!first.result.ok || !first.moved) return first.result;
  const again = await readAllPages();
  if (again.result.ok && again.moved) {
    report({
      event: "crm.feed.unstable",
      level: "warning",
      log: ["[crm] feed changed between pages twice; serving the union"],
    });
  }
  return again.result;
}

/** The pages read, plus whether the book moved underneath the read. */
type PagedRead = { result: FeedResult; moved: boolean };

async function readAllPages(): Promise<PagedRead> {
  const listings: Listing[] = [];
  const seen = new Set<string>();
  let offset = 0;
  let snapshot: string | null = null;
  let moved = false;
  try {
    for (let page = 0; page < MAX_PAGES; page++) {
      const res = await fetch(
        `${CRM}/api/public/listings?org=${encodeURIComponent(ORG)}&offset=${offset}`,
        {
          next: { revalidate: FEED_REVALIDATE },
          headers: forwardHeaders(),
          // Without this a CRM that accepts the connection and never answers
          // hangs until the platform kills the function, and the visitor gets
          // a 504 on the home page rather than the graceful degradation below.
          signal: AbortSignal.timeout(FEED_TIMEOUT_MS),
        },
      );
      if (!res.ok) {
        report({
          event: "crm.feed.bad-status",
          level: "error",
          log: [`[crm] feed responded ${res.status} at offset ${offset}`],
          extra: { status: res.status, offset },
        });
        return { result: { ok: false }, moved };
      }
      const body = (await res.json()) as FeedResponse;
      if (!Array.isArray(body.listings)) {
        report({
          event: "crm.feed.bad-shape",
          level: "error",
          log: ["[crm] feed body had no listings array"],
          extra: { offset },
        });
        return { result: { ok: false }, moved };
      }
      const prefix = (res.headers.get("etag") ?? "").split("-")[0];
      if (prefix) {
        if (snapshot === null) snapshot = prefix;
        else if (prefix !== snapshot) moved = true;
      }
      for (const l of body.listings) {
        if (seen.has(l.reference)) continue; // a boundary duplicate from a moving book
        seen.add(l.reference);
        listings.push(l);
      }
      // The CRM's cap, read back. A feed that does not say is a one-page feed.
      const pageSize = typeof body.limit === "number" && body.limit > 0 ? body.limit : null;
      if (pageSize === null || body.listings.length < pageSize) {
        return { result: { ok: true, listings }, moved };
      }
      offset += body.listings.length;
    }
    report({
      event: "crm.feed.too-many-pages",
      level: "error",
      log: [`[crm] feed still returning full pages after ${MAX_PAGES}; refusing a partial book`],
      extra: { maxPages: MAX_PAGES, offset },
    });
    return { result: { ok: false }, moved };
  } catch (err) {
    report({
      event: "crm.feed.unreachable",
      level: "error",
      log: ["[crm] feed unreachable:", err],
      cause: err,
    });
    return { result: { ok: false }, moved };
  }
}

export type ListingResult = { ok: true; listing: Listing | null } | { ok: false };

/**
 * One listing, and whether we were able to look.
 *
 * The distinction is the whole point: "the feed says there is no PAF0001" is a
 * 404, and "we could not reach the feed" must never be, because the property is
 * still for sale and a 404 tells search engines to forget it exists.
 */
export async function getListing(reference: string): Promise<ListingResult> {
  // One row, asked for by reference (gnk-crm 0088), not the whole book read
  // and searched: every view of a listing page used to fetch every published
  // listing, page by page. The CRM matches case-insensitively and answers the
  // canonical spelling, which is what the page redirects to. A CRM that does
  // not know the parameter yet ignores it and answers the feed's first page,
  // so the find() below is still the last word.
  const wanted = reference.toLowerCase();
  try {
    const res = await fetch(
      `${CRM}/api/public/listings?org=${encodeURIComponent(ORG)}&reference=${encodeURIComponent(reference)}`,
      {
        next: { revalidate: FEED_REVALIDATE },
        headers: forwardHeaders(),
        signal: AbortSignal.timeout(FEED_TIMEOUT_MS),
      },
    );
    if (!res.ok) {
      report({
        event: "crm.listing.bad-status",
        level: "error",
        log: [`[crm] listing lookup responded ${res.status} for ${reference}`],
        extra: { status: res.status, reference },
      });
      return { ok: false };
    }
    const body = (await res.json()) as FeedResponse;
    if (!Array.isArray(body.listings)) {
      report({
        event: "crm.listing.bad-shape",
        level: "error",
        log: ["[crm] listing lookup body had no listings array"],
        extra: { reference },
      });
      return { ok: false };
    }
    return { ok: true, listing: body.listings.find((l) => l.reference.toLowerCase() === wanted) ?? null };
  } catch (err) {
    report({
      event: "crm.listing.failed",
      level: "error",
      log: ["[crm] listing lookup failed:", err],
      cause: err,
      extra: { reference },
    });
    return { ok: false };
  }
}

export interface EnquiryInput {
  name: string;
  email?: string;
  phone?: string;
  message?: string;
  property_reference?: string;
  /** Honeypot. A person never fills this; a bot fills every field it finds. */
  website?: string;
  /**
   * Minted by the form per attempt (gnk-crm migration 0096). The CRM answers a
   * repeated post with the same key with the FIRST lead and writes nothing,
   * which is what makes the one retry in submitEnquiry safe. Absent from the
   * no-JavaScript path, which therefore never retries.
   */
  idempotency_key?: string;
  /**
   * The brief and its provenance as data (gnk-crm 0098): the form's select
   * values, the page, the landing campaign, the referrer host, the consent
   * version. The CRM admits each key from its own allowlist and caps it;
   * nothing personal is ever put here — it lands in a column erasure does not
   * rewrite.
   */
  meta?: Record<string, string>;
}

/**
 * The CRM's door: one or two counter round trips, an insert, an answer. Its
 * own number rather than the feed's, because it is tried TWICE on a timeout
 * and the browser's own wait (components/enquiry-form.tsx) has to outlast
 * both attempts.
 */
export const ENQUIRY_TIMEOUT_MS = 8000;

/**
 * A failure that may already have succeeded. The CRM commits in under a
 * second and answers after; when the ANSWER is what was lost — a timeout, an
 * abort, a connection that fell over — the lead may well exist. A status code
 * is an answer and is never in this set.
 */
function answerWasLost(err: unknown): boolean {
  return (
    err instanceof Error &&
    (err.name === "TimeoutError" || err.name === "AbortError" || err.name === "TypeError")
  );
}

export type EnquiryResult =
  | { ok: true }
  /** `status` and `retryAfter` are set only for a 429: the one refusal that is
   *  about the VISITOR rather than the site, and that the route passes through. */
  | { ok: false; error: string; status?: number; retryAfter?: string | null };

/**
 * Hand an enquiry to the CRM, which decides whether it becomes a lead.
 *
 * Called from a server route, never the browser: the CRM would accept a direct
 * post (it sends CORS *), but going through the server keeps the honeypot and
 * any future timing check out of reach of whoever is filling the form.
 */
export async function submitEnquiry(
  input: EnquiryInput,
  /**
   * The visitor's own address, read from the incoming request by the route.
   *
   * WITHOUT THIS every enquiry reached the CRM from this site's egress IP, so
   * the CRM's per-address budget of five became a budget for the entire
   * internet: the sixth genuine buyer in any quarter of an hour was refused
   * with "Too many enquiries from this address" — an address that was not
   * theirs — and a shell loop could hold the firm's only inbound channel shut
   * for nothing. The CRM still meters this site's transport IP separately, so
   * forging the header buys a fresh per-visitor budget but not an escape.
   *
   * SINCE 2026-09-06 THE CRM BELIEVES THIS HEADER ONLY FROM US. It is sent
   * with x-gnk-forward-key, the shared secret the CRM compares in constant
   * time (gnk-crm lib/services/forwarder.ts); from anyone else the header is
   * ignored and the sender is metered as itself. With no CRM_FORWARD_KEY
   * configured here we are that anyone: every visitor shares one budget of
   * five again, the failure the header was added to end — so README's
   * configuration table names the variable, and this file reads it at call
   * time, as the platform binds it.
   */
  clientIp?: string,
): Promise<EnquiryResult> {
  const body = JSON.stringify({ org: ORG, ...input });
  const attempt = () =>
    fetch(`${CRM}/api/public/enquiries`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        ...(clientIp ? { "x-gnk-visitor-ip": clientIp } : {}),
        ...forwardHeaders(),
      },
      body,
      cache: "no-store",
      signal: AbortSignal.timeout(ENQUIRY_TIMEOUT_MS),
    });
  try {
    let res: Response;
    try {
      res = await attempt();
    } catch (err) {
      /* A lost answer is the one failure worth a second try, and ONLY with a
         key: the CRM then treats the second post as the same enquiry (0096)
         rather than a second lead. Once — a door that is down stays down, and
         the visitor is better told to call than kept waiting. */
      if (!input.idempotency_key || !answerWasLost(err)) throw err;
      report({
        event: "crm.enquiry.retried",
        level: "error",
        log: ["[crm] enquiry answer lost; posting once more with the same key:", err],
        cause: err,
      });
      res = await attempt();
    }
    if (res.status === 202) return { ok: true };
    if (res.status === 429) {
      return {
        ok: false,
        error: "Too many enquiries from this address. Please try again shortly.",
        status: 429,
        retryAfter: res.headers.get("retry-after"),
      };
    }
    const body = (await res.json().catch(() => ({}))) as { error?: string };
    /* The CRM's own words are for us, not for the person filling the form: a
       400 from its validator reads "Too big: expected string to have <=5000
       characters", which tells a seller nothing they can act on and looks
       broken. Logged in full, shown as a sentence. */
    /* `body` here is the CRM's RESPONSE, not the enquiry — the request payload
       of the same name is shadowed above. Nothing the visitor typed goes to
       Sentry. */
    report({
      event: "crm.enquiry.refused",
      level: "error",
      log: ["[crm] enquiry refused:", res.status, body.error],
      extra: { status: res.status, crmError: body.error },
    });
    return {
      ok: false,
      error: "That enquiry could not be sent. Please call or WhatsApp us instead.",
    };
  } catch (err) {
    report({
      event: "crm.enquiry.failed",
      level: "error",
      log: ["[crm] enquiry failed:", err],
      cause: err,
    });
    return { ok: false, error: "That enquiry could not be sent. Please call or WhatsApp us." };
  }
}
