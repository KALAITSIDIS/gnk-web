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
 */
export function SiteNavLinks({ variant }: { variant: "desktop" | "menu" }) {
  const pathname = usePathname() ?? "/";
  return (
    <>
      {nav.map((item) => {
        const current = pathname === item.href || pathname.startsWith(`${item.href}/`);
        const weight = item.primary ? "font-medium text-ink" : "text-ink-2";
        const className =
          variant === "desktop"
            ? `inline-flex min-h-11 items-center px-1 text-sm transition-colors hover:text-accent ${weight} ${
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
            {item.label}
          </Link>
        );
        // The phone menu is a list; each item is its own row.
        return variant === "menu" ? <li key={item.href}>{link}</li> : link;
      })}
    </>
  );
}
