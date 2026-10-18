"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { nav } from "@/lib/site";

/**
 * The navigation items, with the current one marked.
 *
 * A client component for one reason: the current path. The header lives in
 * the root layout, which never learns the path on the server, so the read
 * happens here with usePathname — which, unlike useSearchParams, does not
 * push a prerendered page into a Suspense fallback (the trap recorded in
 * components/property-search.tsx). Both the desktop nav and the phone menu
 * render this, so "where you are" is decided once.
 *
 * Two signals, kept distinct: weight says "this is a conversion" (lib/site.ts
 * `primary`), the underline or bar says "this is where you are". A listing
 * page counts as being under Properties.
 *
 * On the desktop row the item with a `cta` label is drawn last, as an
 * outlined button with that label: the reading items first, then the one
 * thing a seller came to do. Outlined, not filled — the filled accent is
 * kept for the page's own primary action, so the header never competes with
 * the form or the search beneath it. The phone menu keeps the plain order.
 */
export function SiteNavLinks({ variant }: { variant: "desktop" | "menu" }) {
  const pathname = usePathname() ?? "/";
  const items =
    variant === "desktop" ? [...nav.filter((i) => !i.cta), ...nav.filter((i) => i.cta)] : nav;
  return (
    <>
      {items.map((item) => {
        const current = pathname === item.href || pathname.startsWith(`${item.href}/`);
        const weight = item.primary ? "font-medium text-ink" : "text-ink-2";
        const button = variant === "desktop" && item.cta;
        const className = button
          ? `ml-1 inline-flex min-h-11 items-center border border-accent px-4 text-sm font-medium whitespace-nowrap text-accent transition-colors hover:bg-accent-soft ${
              current ? "bg-accent-soft" : ""
            }`
          : variant === "desktop"
            ? `inline-flex min-h-11 items-center px-1 text-sm whitespace-nowrap transition-colors hover:text-accent ${weight} ${
                current ? "text-ink underline decoration-accent decoration-2 underline-offset-8" : ""
              }`
            : `flex min-h-11 items-center text-base hover:text-accent ${weight} ${
                current ? "-ml-3 border-l-2 border-accent pl-3 text-ink" : ""
              }`;
        const link = (
          <Link
            key={item.href}
            href={item.href}
            className={className.trim()}
            aria-current={current ? "page" : undefined}
          >
            {button ? item.cta : item.label}
          </Link>
        );
        // The phone menu is a list; each item is its own row.
        return variant === "menu" ? <li key={item.href}>{link}</li> : link;
      })}
    </>
  );
}
