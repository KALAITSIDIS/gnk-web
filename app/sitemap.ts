import type { MetadataRoute } from "next";
import { getListings } from "@/lib/crm";

const SITE_URL = process.env.SITE_URL ?? "https://gnk-web.vercel.app";

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
