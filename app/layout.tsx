import type { Metadata } from "next";
import { Newsreader, Public_Sans } from "next/font/google";
import Link from "next/link";
import "./globals.css";
import { SiteHeader } from "@/components/site-header";
import { SiteFooter } from "@/components/site-footer";
import { SITE_URL } from "@/lib/site-url";

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
    url: SITE_URL,
  },
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
