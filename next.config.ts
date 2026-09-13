import type { NextConfig } from "next";

/**
 * The site holds no database credentials — it reads the CRM's public API over
 * HTTPS and nothing else. The one thing it needs from outside is permission to
 * optimise the listing photographs, which the CRM serves from Supabase's public
 * media bucket as absolute URLs.
 */
const CRM_MEDIA_HOST = "yjgirvzgoiywdojnpkpd.supabase.co";

const nextConfig: NextConfig = {
  /**
   * How long a stale render may be served while a fresh one is built.
   *
   * Next's default is a year. Every page here is ISR with `revalidate = 60`,
   * which only says when a render becomes stale, not for how long a stale one
   * may still be handed out — and on a quiet site that is "until the next
   * visitor", however far away. Measured 2026-09-13: the home page answered
   * with a render dated the 8th and /properties with one dated the 7th, both
   * `X-Vercel-Cache: STALE`. A withdrawn or sold property must not stay
   * visible for days, so the ceiling is an hour; after that the visitor waits
   * for a fresh render instead. README § How fresh the site is states the
   * same number, and lib/freshness.test.ts reads it from THIS line.
   *
   * Functions also run in fra1 now (vercel.json), beside the CRM and the
   * database, so that fresh render is no longer a transatlantic round trip.
   */
  expireTime: 3600,
  images: {
    remotePatterns: [
      { protocol: "https", hostname: CRM_MEDIA_HOST, pathname: "/storage/v1/object/public/**" },
    ],
  },
  async headers() {
    return [
      {
        source: "/:path*",
        headers: [
          { key: "X-Content-Type-Options", value: "nosniff" },
          { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
          { key: "X-Frame-Options", value: "DENY" },
        ],
      },
    ];
  },
};

export default nextConfig;
