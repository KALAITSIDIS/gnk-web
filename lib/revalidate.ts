import { createHash, timingSafeEqual } from "node:crypto";
import { report } from "@/lib/report";

/**
 * Who may ask this site to rebuild a page, and which pages.
 *
 * The CRM knocks after a write that changes a listing's public face; the site
 * marks the affected pages stale and rebuilds them on the next request. That
 * is the whole power the key grants: a public feed re-read a little sooner.
 * Without it the site still refreshes on its own timers — sixty seconds, and
 * a stale ceiling of an hour (next.config.ts expireTime) — so a lost knock
 * costs freshness, never correctness.
 *
 * The key is compared in constant time over fixed-length digests, as the CRM
 * compares the forward key. With no key configured on this side NOTHING is
 * trusted, and the site says so once at error level: a deployment without
 * the key is the weaker system, and it should not be quiet about it.
 */
export const REVALIDATE_KEY_HEADER = "x-gnk-revalidate-key";

/** A canonical CRM reference: PAF0001, PAF0002-V03. Nothing else becomes a path. */
export const REFERENCE = /^[A-Z0-9][A-Z0-9-]{0,39}$/;

let warnedUnset = false;

/** Test seam: the once-per-instance latch. */
export function resetRevalidateLatch(): void {
  warnedUnset = false;
}

export function isTrustedRevalidator(
  presented: string | null | undefined,
  expected: string = process.env.SITE_REVALIDATE_KEY ?? "",
): boolean {
  if (!expected) {
    if (!warnedUnset) {
      warnedUnset = true;
      report({
        event: "revalidate.key-unset",
        level: "error",
        log: [
          "[revalidate] SITE_REVALIDATE_KEY is not set; every knock is refused and pages refresh on their timers alone",
        ],
      });
    }
    return false;
  }
  if (!presented) return false;
  const a = createHash("sha256").update(presented).digest();
  const b = createHash("sha256").update(expected).digest();
  return timingSafeEqual(a, b);
}

/**
 * Every listing page, as Next names the route: `revalidatePath` with this
 * pattern and type "page" expires all of them at once, and each is rebuilt
 * on its own next visit — nothing is rendered at the moment of the knock
 * (Next 16 docs, revalidatePath: "Route Handlers"), and that visitor waits
 * for the fresh render rather than being handed the old one (measured on a
 * production build, 2026-10-08: `x-nextjs-cache: MISS`, then `HIT`).
 */
export const EVERY_LISTING_PAGE = "/properties/[reference]";

/**
 * What one knock asks for, read and checked IN FULL before anything is
 * rebuilt:
 *
 *  - `{ reference }` — one listing changed (a save, a photograph, a unit's
 *    status): the home page, the list and that listing's page;
 *  - `{ scope: "listings" }` — many listings changed at once (the CRM's bulk
 *    reprice and unit-type stamp, T-unit-site-revalidate): the home page, the
 *    list and EVERY listing page. No list of references — the CRM would have
 *    to read which units are public to send one, and the "Other properties"
 *    cards on every listing page carry those units' prices too;
 *  - `{}` — the home page and the list.
 *
 * Anything else is refused whole: a body that is not an object, a reference
 * that is not a reference, a scope it does not know, both at once, or a field
 * this door does not read. Until 2026-10-08 an unknown field was ignored, so
 * `{ scope: "listings" }` sent to the old door answered 200 having rebuilt
 * the home page and the list and no listing — a knock that half-did what it
 * asked and said it had done it.
 */
export type Knock =
  | { kind: "list" }
  | { kind: "listing"; reference: string }
  | { kind: "listings" };

const KNOCK_FIELDS = new Set(["reference", "scope"]);

export function readKnock(body: unknown): { ok: true; knock: Knock } | { ok: false; error: string } {
  if (typeof body !== "object" || body === null || Array.isArray(body)) {
    return { ok: false, error: "The body must be a JSON object." };
  }
  const fields = body as Record<string, unknown>;
  if (Object.keys(fields).some((k) => !KNOCK_FIELDS.has(k))) {
    return { ok: false, error: "Only `reference` or `scope` may be sent." };
  }

  const raw = fields.reference;
  let reference: string | null = null;
  if (raw !== undefined && raw !== null && raw !== "") {
    if (typeof raw !== "string" || !REFERENCE.test(raw)) {
      return { ok: false, error: "reference must be a listing reference such as PAF0001." };
    }
    reference = raw;
  }

  const scope = fields.scope;
  if (scope !== undefined && scope !== null) {
    if (scope !== "listings") return { ok: false, error: 'scope must be "listings".' };
    if (reference) return { ok: false, error: "Send a reference or a scope, not both." };
    return { ok: true, knock: { kind: "listings" } };
  }
  return { ok: true, knock: reference ? { kind: "listing", reference } : { kind: "list" } };
}

/** One page or route pattern to mark stale; `type` only for a pattern. */
export type RevalidateTarget = { path: string; type?: "page" };

/**
 * The pages a knock can have moved: the home page and the list carry every
 * card, a listing carries itself, and a bulk change reaches every listing
 * page (each also shows other listings' cards). The sitemap is rendered per
 * request and needs no rebuild.
 */
export function targetsFor(knock: Knock): RevalidateTarget[] {
  const always: RevalidateTarget[] = [{ path: "/" }, { path: "/properties" }];
  if (knock.kind === "listing") return [...always, { path: `/properties/${knock.reference}` }];
  if (knock.kind === "listings") return [...always, { path: EVERY_LISTING_PAGE, type: "page" }];
  return always;
}
