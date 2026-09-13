import type { Metadata } from "next";
import { Inter_Tight, Literata } from "next/font/google";
import Link from "next/link";
import "./globals.css";
import { SiteHeader } from "@/components/site-header";
import { SiteFooter } from "@/components/site-footer";
import { SITE_URL } from "@/lib/site-url";
import { site } from "@/lib/site";

/**
 * Two families, chosen because both carry Latin, Greek and Cyrillic in ONE
 * face. The CRM feed sends `el` and `ru` for every title, and CSS falls back
 * per character: with Newsreader and Public Sans (latin, latin-ext and
 * vietnamese only, and requested as `latin` alone) a Greek word inside an
 * English heading rendered in whatever serif the visitor's machine had, at
 * Newsreader's spacing. Nobody files a bug for that; it just looks slightly
 * wrong everywhere.
 *
 * Naming a capable family is not enough — the subsets have to be asked for,
 * or the build ships Latin only. lib/type.test.ts pins this list, and
 * scripts/check-fonts.mjs checks the CSS the build actually emitted
 * (`postbuild`). Literata is variable with an optical-size axis, so display
 * sizes get the display cut without a second file.
 *
 * The subset list is written out twice because next/font reads these options
 * at build time and accepts only literals — a shared constant is rejected.
 * lib/type.test.ts is the one place that asserts both lists are the same four.
 */
const literata = Literata({
  subsets: ["latin", "latin-ext", "greek", "cyrillic"],
  variable: "--font-literata",
  display: "swap",
  axes: ["opsz"],
});

const interTight = Inter_Tight({
  subsets: ["latin", "latin-ext", "greek", "cyrillic"],
  variable: "--font-inter-tight",
  display: "swap",
});


export const metadata: Metadata = {
  metadataBase: new URL(SITE_URL),
  title: {
    default: "GN Kalaitsidis Capital — Real estate advisory in Paphos, Cyprus",
    template: "%s — GN Kalaitsidis Capital",
  },
  description:
    "Independent real estate advisory in Paphos: buyer and seller advisory, investment analysis, pricing, development support, deal structuring and due diligence.",
  openGraph: {
    type: "website",
    locale: "en",
    siteName: "GN Kalaitsidis Capital",
    // NO `url` here. It is inherited by every route, so setting it once made
    // /selling, /properties and every listing tell a share dialog they were the
    // home page. Each page states its own through pageMeta().
    //
    // The image IS inherited on purpose: without it a shared link to anything
    // other than a listing showed no picture at all, which on WhatsApp — where
    // Cyprus property actually spreads — is the difference between a card and a
    // line of grey text. A listing sets its own photograph in generateMetadata
    // and overrides this by normal metadata merging.
    images: [{ url: "/api/og", width: 1200, height: 630, alt: site.name }],
  },
  twitter: { card: "summary_large_image" },
  robots: { index: true, follow: true },
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" className={`${literata.variable} ${interTight.variable}`}>
      <body className="min-h-screen flex flex-col">
        <a
          href="#main"
          className="sr-only focus:not-sr-only focus:absolute focus:top-3 focus:left-3 focus:z-50 focus:bg-surface focus:px-4 focus:py-2 focus:text-ink"
        >
          Skip to content
        </a>
        <SiteHeader />
        <main id="main" className="flex-1">
          {children}
        </main>
        <SiteFooter />
      </body>
    </html>
  );
}

export { Link };
