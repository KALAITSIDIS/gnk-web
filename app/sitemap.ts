import type { MetadataRoute } from "next";
import { getListings } from "@/lib/crm";

import { SITE_URL } from "@/lib/site-url";

/**
 * MEASURED, NOT ASSUMED — and the first attempt at this was wrong.
 *
 * A sitemap route is prerendered once at build time and served forever ("a
 * special Route Handler that is cached by default unless it uses a Request-time
 * API or dynamic config option" — Next 16 docs). On 2026-09-04 that meant
 * publishing a property never reached sitemap.xml, which is the exact staleness
 * the comment below says this file exists to end.
 *
 * `export const revalidate = 60` was added and looked right: `next build`
 * reported /sitemap.xml at "1m 1y", alongside the genuinely revalidating pages.
 * IT DID NOT WORK. When PAF0004 was published on 2026-09-05, /properties served
 * it within seconds while sitemap.xml still listed two properties 140 seconds
 * later — Age climbing past 200, X-Vercel-Cache: HIT, and no X-Nextjs-Prerender
 * header at all, unlike the ISR pages beside it. A cache-busting query string
 * returned the same stale document, so the origin itself was frozen, not the
 * edge. The build table reported the intent, not the behaviour.
 *
 * force-dynamic renders the route per request instead. A sitemap is read by
 * crawlers, not people, so the cost is negligible — and correctness here is
 * worth more than a cached document, because a sitemap nobody can trust is
 * worse than no sitemap at all.
 *
 * The lesson is the measurement: the only proof a cache behaves is watching new
 * data cross it.
 */
export const dynamic = "force-dynamic";

/**
 * Generated from the feed, so publishing a property in the CRM puts it in the
 * sitemap without a deploy. The old site's sitemap was hand-written and went
 * stale in March.
 */
export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const pages = ["", "/properties", "/selling", "/services", "/valuation", "/about", "/contact", "/legal"];
  const staticEntries: MetadataRoute.Sitemap = pages.map((p) => ({
    url: SITE_URL + p,
    changeFrequency: p === "" || p === "/properties" ? "weekly" : "monthly",
    // /selling and /valuation are where a mandate starts, so they outrank the
    // brochure pages even though they change less often than the listings do.
    priority:
      p === "" ? 1 : p === "/properties" ? 0.9 : p === "/selling" || p === "/valuation" ? 0.8 : 0.6,
  }));

  const feed = await getListings();
  if (!feed.ok) {
    // Deliberately NOT a throw: that would fail the build outright if the CRM
    // happened to be down at deploy time. A sitemap is a hint, so a property
    // temporarily absent from it is not deindexed — the next revalidation puts
    // it back. The 404 in the page route was the dangerous half, and that is
    // fixed there.
    console.error("[sitemap] feed unavailable — publishing static pages only");
    return staticEntries;
  }
  const listingEntries: MetadataRoute.Sitemap = feed.listings.map((l) => ({
    url: SITE_URL + "/properties/" + l.reference,
    lastModified: l.updated_at ? new Date(l.updated_at) : undefined,
    changeFrequency: "weekly",
    priority: 0.8,
  }));

  return [...staticEntries, ...listingEntries];
}
