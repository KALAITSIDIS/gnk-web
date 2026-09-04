import type { NextConfig } from "next";

/**
 * The site holds no database credentials — it reads the CRM's public API over
 * HTTPS and nothing else. The one thing it needs from outside is permission to
 * optimise the listing photographs, which the CRM serves from Supabase's public
 * media bucket as absolute URLs.
 */
const CRM_MEDIA_HOST = "yjgirvzgoiywdojnpkpd.supabase.co";

const nextConfig: NextConfig = {
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
