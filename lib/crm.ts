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
import {
  feedEnvelopeSchema,
  feedIssueSummary,
  type FeedImage,
  type FeedMultilang,
  type FeedRow,
} from "@/lib/feed-schema";
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

/**
 * THE TYPES ARE THE SCHEMA'S. `Multilang`, `ListingImage` and `Listing` are
 * z.infer of lib/feed-schema.ts — the same schema readAllPages and getListing
 * parse every response with below — so a value of one of these types has been
 * checked, field by field, against the contract, and a change to the contract
 * is a change to the type. Until 2026-09-20 they were hand-written interfaces
 * beside a cast, kept in step with the schema by a test that compared key
 * names, and TypeScript's word for a row was a wish.
 */

/** A language-keyed field: `{en, el, ru}`, any subset, or null. Phase 1 renders English; el/ru arrive with the site's own translation. */
export type Multilang = FeedMultilang;

/**
 * One photograph as the feed sends it: exactly {thumb, card, full, alt,
 * watermarked}.
 *
 * THE COVER IS ELEMENT 0. public_listings() orders `is_cover desc, sort_order,
 * created_at` (gnk-crm supabase/migrations/0085_adviser_view.sql) and carries
 * NO flag — gnk-crm RLS test 49 pins both halves (the cover leads even with a
 * later sort_order; exactly five keys), and it is the test that catches the
 * feed changing. The old interface declared `is_cover` from the site's first
 * commit; the feed never sent it, and three lookups were right by accident.
 * CRM-side shape: lib/services/public-listings.ts FeedImage.
 */
export type ListingImage = FeedImage;

/**
 * One row of `public_listings()`. Every field is nullable — the feed is honest
 * about gaps. The column list and its order are feedRowSchema's, which follows
 * gnk-crm 0085.
 *
 * `adviser_view` is the firm's own judgement, written in the CRM's Marketing
 * tab; it joined the feed's allowlist in 0085 and is optional because a feed
 * served before that migration simply will not carry it, and an absent view
 * is the same as an empty one. What the page shows in its place is decided in
 * app/properties/[reference]/page.tsx, not here: the summary — unless the
 * summary merely repeats the opening of the description, in which case
 * nothing. PAF0003 is that case, and four sentences across the two repos said
 * "falls back to the summary" as if it were not.
 */
export type Listing = FeedRow;

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
 *
 * `{ ok: false }` means "we could not read the book", and `{ ok: true,
 * listings: [] }` means "we read it and it is empty". The two must never
 * collapse into one another, in either direction — a mixed book reported
 * `ok: true` is the same lie wearing the other face.
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
 */
const MAX_PAGES = 50;

/**
 * How many times the whole book may be read before the site gives up on getting
 * a clean one.
 *
 * Between pages the book can lawfully change — the CRM's edge holds a body for
 * up to 60s, so page 2 may come from a newer snapshot than page 1 — and when it
 * does, a paged read LOSES ROWS. Withdraw a listing after page 1 and the window
 * shifts left by one, so the row that would have opened page 2 is stepped over
 * and never returned. With A,B,C,D at two a page: page 1 gives A,B; A is
 * withdrawn; page 2 gives D. The union is A,B,D — it carries a listing that is
 * no longer for sale and is missing one that is.
 *
 * Until this change the second read's result was returned WHATEVER it was, so a
 * book that moved twice was served as a complete catalogue with a warning in a
 * log nobody reads. Reading again is the right instinct and one more read was
 * simply not enough of it: three reads, and if the book is still moving after
 * all three, {ok:false} — "briefly unavailable", which every caller already
 * handles (the home page and /properties say so, the sitemap 5xxs so a crawler
 * keeps its last copy, a listing page is unaffected because it fetches its own
 * row). A catalogue we know to be wrong is worse than one we admit we cannot
 * read.
 */
const MAX_READS = 3;

/**
 * The ceiling on everything below: pagination, retries and all.
 *
 * MAX_PAGES x FEED_TIMEOUT_MS x MAX_READS is twenty minutes, which is not a
 * bound, it is an absence of one. Nobody waits that long and no platform lets
 * them; the render is killed and the visitor gets a gateway error instead of
 * the graceful degradation this whole module is built for. One deadline covers
 * every request, and the per-page timeout below is whatever is left of it.
 */
const FEED_DEADLINE_MS = 25_000;

export async function getListings(): Promise<FeedResult> {
  const deadline = Date.now() + FEED_DEADLINE_MS;
  for (let read = 0; read < MAX_READS; read++) {
    const attempt = await readAllPages(deadline);
    // A transport failure is its own answer and reading again will not mend it.
    if (!attempt.result.ok) return attempt.result;
    if (!attempt.moved) return attempt.result;
    if (Date.now() >= deadline) break;
  }
  report({
    event: "crm.feed.unstable",
    level: "error",
    log: [`[crm] feed still moving after ${MAX_READS} reads; refusing a book we know is mixed`],
    extra: { reads: MAX_READS },
  });
  return { ok: false };
}

/** The pages read, plus whether the book moved underneath the read. */
type PagedRead = { result: FeedResult; moved: boolean };

/**
 * WHAT `moved` DOES AND DOES NOT PROVE.
 *
 * The ETag's first segment is `public_listings_etag()` — md5 of (published row
 * count | max(updated_at) | a fingerprint of the photo set), gnk-crm 0086. Two
 * pages carrying DIFFERENT segments prove the book changed between them, and
 * that is the whole of what is relied on here.
 *
 * The converse does not hold and is not claimed. The CRM computes the snapshot
 * and reads the page in two separate round trips with no transaction between
 * them (gnk-crm app/api/public/listings/route.ts), so a change landing in that
 * gap is invisible to it; and the hash itself could in principle survive one
 * (a publish and an unpublish in the same instant keep the count). Equal
 * segments mean "nothing this validator can see has moved", not "one snapshot".
 * The old comment here said the segment WAS the snapshot's name, which read as
 * a guarantee the producer does not give.
 */
async function readAllPages(deadline: number): Promise<PagedRead> {
  const listings: Listing[] = [];
  const seen = new Set<string>();
  let offset = 0;
  let snapshot: string | null = null;
  let moved = false;
  try {
    for (let page = 0; page < MAX_PAGES; page++) {
      // Whatever is left of the call's budget, never more than one page's worth.
      const budget = Math.min(FEED_TIMEOUT_MS, deadline - Date.now());
      if (budget <= 0) {
        report({
          event: "crm.feed.deadline",
          level: "error",
          log: [`[crm] feed read ran past ${FEED_DEADLINE_MS}ms at offset ${offset}`],
          extra: { offset, deadlineMs: FEED_DEADLINE_MS },
        });
        return { result: { ok: false }, moved };
      }
      const res = await fetch(
        `${CRM}/api/public/listings?org=${encodeURIComponent(ORG)}&offset=${offset}`,
        {
          next: { revalidate: FEED_REVALIDATE },
          headers: forwardHeaders(),
          // Without this a CRM that accepts the connection and never answers
          // hangs until the platform kills the function, and the visitor gets
          // a 504 on the home page rather than the graceful degradation below.
          signal: AbortSignal.timeout(budget),
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
      /* THE BOUNDARY. The body is JSON off the wire and nothing more until the
         contract has looked at it — every field the site reads, every field
         the paging below reads, every row. What fails is refused whole, as
         "unavailable": not as an empty book, not as a book minus the bad row,
         and (in getListing) not as a 404. Until 2026-09-20 this was a cast
         and a check that `listings` was an array, so a price arriving as a
         string was multiplied, a title arriving as an object was rendered,
         and a first page that forgot its `limit` was the whole book — with
         listing 51 onward simply not on the site (lib/crm.validation.test.ts).
         Parsed ONCE per response; nothing downstream parses again. */
      const parsed = feedEnvelopeSchema.safeParse(await res.json());
      if (!parsed.success) {
        const issues = feedIssueSummary(parsed.error);
        report({
          event: "crm.feed.bad-shape",
          level: "error",
          // paths and codes only — never a value the payload carried
          log: [`[crm] feed body at offset ${offset} failed the contract: ${issues}`],
          extra: { offset, issues },
        });
        return { result: { ok: false }, moved };
      }
      const body = parsed.data;
      const prefix = (res.headers.get("etag") ?? "").split("-")[0];
      if (prefix) {
        if (snapshot === null) snapshot = prefix;
        else if (prefix !== snapshot) moved = true;
      }
      for (const l of body.listings) {
        /* A REFERENCE IS THE ROW'S IDENTITY: it is the dedup key here, the URL
           of the page, and the entry in the sitemap. A row without one used to
           pass straight through — `seen.has(undefined)` is false the first time
           — so the first such row became /properties/undefined in the sitemap;
           then it was dropped here with a report and the rest served. The
           schema above now refuses the payload that carries it, like any other
           malformed one: a book we know is wrong is worse than one we admit we
           cannot read. */
        if (seen.has(l.reference)) continue; // a boundary duplicate from a moving book
        seen.add(l.reference);
        listings.push(l);
      }
      // The CRM's cap, read back — a positive integer, or the schema refused
      // it above. A feed that does not say is not a one-page feed; it is a
      // feed the site cannot page, and it is refused rather than cut short.
      if (body.listings.length < body.limit) {
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
    /* The same boundary as readAllPages, for the same reason: a row this page
       is about to render has been checked against the contract, or the page
       is told "could not look" — never "no such property". A malformed row
       used to be found here and rendered; a row without a reference used to be
       skipped by the find(), so a broken payload answered `listing: null` and
       the page answered 404 for a mandate that was live. */
    const parsed = feedEnvelopeSchema.safeParse(await res.json());
    if (!parsed.success) {
      const issues = feedIssueSummary(parsed.error);
      report({
        event: "crm.listing.bad-shape",
        level: "error",
        // paths and codes only — never a value the payload carried
        log: [`[crm] listing lookup for ${reference} failed the contract: ${issues}`],
        extra: { reference, issues },
      });
      return { ok: false };
    }
    /* The find() is still the last word: the CRM answers this call with the
       feed's first PAGE when it does not know `?reference=`, and the wrong
       row must not be taken for the one asked for. */
    const listing = parsed.data.listings.find((l) => l.reference.toLowerCase() === wanted) ?? null;
    return { ok: true, listing };
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
