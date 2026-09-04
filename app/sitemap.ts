import type { MetadataRoute } from "next";
import { getListings } from "@/lib/crm";

const SITE_URL = process.env.SITE_URL ?? "https://gnk-web.vercel.app";

/**
 * WITHOUT THIS LINE the promise in the comment below is false.
 *
 * A sitemap route with no dynamic config option is prerendered once at build
 * time and served from cache forever ("sitemap.js is a special Route Handler
 * that is cached by default unless it uses a Request-time API or dynamic
 * config option" — Next 16 docs), so the document would stay frozen at whatever
 * happened to be published on deploy day: precisely the staleness it was
 * written to end.
 *
 * Measured on 2026-09-04: PAF0003 was published in the CRM and appeared in the
 * feed and on /properties within seconds, while sitemap.xml still listed one
 * property and returned `Age: 4829` on a cache HIT.
 *
 * 60 to match FEED_REVALIDATE deliberately. The effective cadence is the
 * MINIMUM of this and the feed fetch's own revalidate, so a larger number here
 * would be silently overridden and would read as a promise the build does not
 * keep — `next build` reports this route at 1m either way.
 *
 * Must stay a literal; and note it disappears entirely if Cache Components is
 * ever enabled (removed in v16.0.0 under that flag), which would silently
 * restore the bug.
 */
export const revalidate = 60;

/**
 * Generated from the feed, so publishing a property in the CRM puts it in the
 * sitemap without a deploy. The old site's sitemap was hand-written and went
 * stale in March.
 */
export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const pages = ["", "/properties", "/services", "/valuation", "/about", "/contact", "/legal"];
  const staticEntries: MetadataRoute.Sitemap = pages.map((p) => ({
    url: SITE_URL + p,
    changeFrequency: p === "" || p === "/properties" ? "weekly" : "monthly",
    priority: p === "" ? 1 : p === "/properties" ? 0.9 : 0.6,
  }));

  const listings = await getListings();
  const listingEntries: MetadataRoute.Sitemap = listings.map((l) => ({
    url: SITE_URL + "/properties/" + l.reference,
    lastModified: l.updated_at ? new Date(l.updated_at) : undefined,
    changeFrequency: "weekly",
    priority: 0.8,
  }));

  return [...staticEntries, ...listingEntries];
}
