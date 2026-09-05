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

/**
 * The site's display face, fetched so the card is set in the same type as the
 * pages it represents.
 *
 * GUARDED, because a share card that fails to render is worse than one in the
 * wrong face: crawlers would get a 500 and show nothing at all. If the fetch
 * fails the card still renders in the runtime's default, which is exactly what
 * shipped before this — legible, just not ours.
 *
 * The previous version declared fontFamily: "Georgia, serif" and got neither.
 * Georgia is not present in this runtime, so it fell back silently to a sans
 * face while the code claimed otherwise.
 */
async function displayFont(): Promise<ArrayBuffer | null> {
  try {
    const css = await fetch(
      "https://fonts.googleapis.com/css2?family=Newsreader:wght@500&display=swap",
      { headers: { "User-Agent": "Mozilla/5.0" }, next: { revalidate: 86400 } },
    ).then((r) => (r.ok ? r.text() : ""));
    const url = css.match(/src:\s*url\((https:[^)]+)\)/)?.[1];
    if (!url) return null;
    const res = await fetch(url, { next: { revalidate: 86400 } });
    return res.ok ? await res.arrayBuffer() : null;
  } catch {
    return null;
  }
}

export async function GET() {
  const font = await displayFont();
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
          fontFamily: font ? "Newsreader" : "serif",
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
    {
      width: 1200,
      height: 630,
      ...(font
        ? { fonts: [{ name: "Newsreader", data: font, weight: 500 as const, style: "normal" as const }] }
        : {}),
    },
  );
}
