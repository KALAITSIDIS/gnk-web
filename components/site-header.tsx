import Link from "next/link";
import { nav, site } from "@/lib/site";

/**
 * One row, stuck to the top, with the phone number always in reach.
 *
 * On a phone the six items sit behind a native <details> disclosure. It is
 * not a hamburger that needs a script: <details> opens and closes before
 * hydration and with JavaScript off, which is the property the previous
 * design (six items allowed to wrap onto a second row) was chosen for. What
 * that design cost was measured on an iPhone 13 viewport on 2026-09-13: a
 * 143 px header — a fifth of a 664 px screen — with 17 px links, above a
 * hero and a filter block, so the first property on the home page began at
 * 819 px. components/site-header.test.ts pins the disclosure, the sticky
 * position and the 44 px targets.
 *
 * Sticky, so the number does not leave the screen on the first scroll: the
 * listing page has its own bottom bar for that, the other pages had nothing.
 * globals.css sets scroll-padding-top to match, so an in-page anchor is not
 * hidden beneath this bar; the listing page's pinned enquiry column starts
 * at lg:top-20 for the same reason.
 */
export function SiteHeader() {
  return (
    <header className="sticky top-0 z-30 border-b border-line bg-surface">
      {/* One row at 390 px: wordmark, number and menu total ~330 px with
          these gaps and sizes. At text-lg the wordmark wrapped and the
          header measured 89 px, under which a 5rem scroll padding left the
          top of an anchored form hidden (measured 2026-09-13). */}
      <div className="mx-auto flex max-w-7xl items-center gap-3 px-5 py-2 sm:gap-5 sm:px-8">
        <Link href="/" className="flex min-h-11 flex-col items-start justify-center leading-none">
          <span className="font-display text-base font-semibold tracking-tight whitespace-nowrap text-ink sm:text-lg">
            {site.shortName}
          </span>
          <span className="eyebrow mt-1">Paphos, Cyprus</span>
        </Link>

        <nav aria-label="Main" className="ml-auto hidden items-center gap-5 md:flex">
          {nav.map((item) => (
            <Link
              key={item.href}
              href={item.href}
              className="inline-flex min-h-11 items-center px-1 text-sm text-ink-2 transition-colors hover:text-accent"
            >
              {item.label}
            </Link>
          ))}
        </nav>

        <a
          href={site.contact.phoneHref}
          className="ml-auto inline-flex min-h-11 shrink-0 items-center text-sm font-medium text-accent md:ml-0 md:border-l md:border-line md:pl-5"
        >
          {site.contact.phone}
        </a>

        {/* The panel is absolutely positioned against the header (sticky
            elements are positioned), so opening it overlays the page rather
            than pushing it down. group-open swaps the label and the icon. */}
        <details className="group md:hidden">
          <summary className="flex min-h-11 cursor-pointer list-none items-center gap-2 text-sm text-ink-2 [&::-webkit-details-marker]:hidden">
            <svg
              aria-hidden="true"
              width="20"
              height="20"
              viewBox="0 0 20 20"
              fill="none"
              stroke="currentColor"
              strokeWidth="1.5"
              strokeLinecap="round"
            >
              <path className="group-open:hidden" d="M3 5h14M3 10h14M3 15h14" />
              <path className="hidden group-open:block" d="M5 5l10 10M15 5L5 15" />
            </svg>
            <span className="group-open:hidden">Menu</span>
            <span className="hidden group-open:inline">Close</span>
          </summary>
          <nav
            aria-label="Main, mobile"
            className="absolute inset-x-0 top-full border-b border-line bg-surface shadow-lg"
          >
            <ul className="mx-auto max-w-7xl px-5 py-2 sm:px-8">
              {nav.map((item) => (
                <li key={item.href}>
                  <Link
                    href={item.href}
                    className="flex min-h-11 items-center text-base text-ink-2 hover:text-accent"
                  >
                    {item.label}
                  </Link>
                </li>
              ))}
            </ul>
          </nav>
        </details>
      </div>
    </header>
  );
}
