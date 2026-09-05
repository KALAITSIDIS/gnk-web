import { ImageResponse } from "next/og";
import { site } from "@/lib/site";

/**
 * The picture a shared link shows when the page is not a property.
 *
 * WHY A ROUTE AND NOT app/opengraph-image.tsx. The file convention applies to a
 * segment and is inherited by its children, and this version's docs do not
 * settle whether it beats an `openGraph.images` set in a child's
 * generateMetadata. Getting that wrong would replace the photograph on every
 * shared LISTING — the one page where the image is the whole point — with a
 * generic card. Referencing a generated image from the root layout uses plain
 * metadata merging instead, which IS documented: a page that sets its own
 * images wins, and the listing pages do.
 *
 * Typography only. No logo, no photograph of a property the firm does not have
 * rights to use out of context, and nothing stated that lib/site.ts does not
 * already hold.
 */
export const runtime = "nodejs";

export function GET() {
  return new ImageResponse(
    (
      <div
        style={{
          width: "100%",
          height: "100%",
          display: "flex",
          flexDirection: "column",
          justifyContent: "space-between",
          background: "#14524c",
          padding: "72px 80px",
          fontFamily: "Georgia, serif",
       }}
      >
        <div style={{ display: "flex", flexDirection: "column" }}>
          <div style={{ fontSize: 30, letterSpacing: 6, color: "#9dc3bc", textTransform: "uppercase" }}>
            {site.contact.city}
          </div>
          <div style={{ fontSize: 82, color: "#f7f7f5", marginTop: 26, lineHeight: 1.1 }}>
            {site.name}
          </div>
        </div>
        <div style={{ display: "flex", flexDirection: "column" }}>
          <div style={{ fontSize: 34, color: "#cfe0dc", lineHeight: 1.35, maxWidth: 900 }}>
            {site.tagline}
          </div>
          <div style={{ fontSize: 26, color: "#9dc3bc", marginTop: 26 }}>
            {site.contact.email}
          </div>
        </div>
      </div>
    ),
    { width: 1200, height: 630 },
  );
}
