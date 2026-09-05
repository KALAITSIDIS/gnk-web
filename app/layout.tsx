import type { Metadata } from "next";
import { Newsreader, Public_Sans } from "next/font/google";
import Link from "next/link";
import "./globals.css";
import { SiteHeader } from "@/components/site-header";
import { SiteFooter } from "@/components/site-footer";
import { SITE_URL } from "@/lib/site-url";
import { site } from "@/lib/site";

const newsreader = Newsreader({
  subsets: ["latin"],
  variable: "--font-newsreader",
  display: "swap",
  weight: ["400", "500", "600"],
});

const publicSans = Public_Sans({
  subsets: ["latin"],
  variable: "--font-public-sans",
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
    <html lang="en" className={`${newsreader.variable} ${publicSans.variable}`}>
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
