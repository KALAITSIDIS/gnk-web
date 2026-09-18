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
 * The pages a change to one listing can have moved: the home page and the
 * list carry every card, and the listing carries itself. The sitemap is
 * rendered per request and needs no rebuild.
 */
export function pathsFor(reference: string | null): string[] {
  return ["/", "/properties", ...(reference ? [`/properties/${reference}`] : [])];
}
