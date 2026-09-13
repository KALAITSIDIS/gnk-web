import Link from "next/link";
import { site } from "@/lib/site";
import { MenuAutoClose } from "@/components/menu-auto-close";
import { SiteNavLinks } from "@/components/site-nav-links";

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
 * position and the 44 px targets. MenuAutoClose adds, with JavaScript, the
 * three closings a native <details> lacks: Escape, a tap outside, and a
 * navigation from inside it.
 *
 * Sticky, so the number does not leave the screen on the first scroll: the
 * listing page has its own bottom bar for that, the other pages had nothing.
 * globals.css sets scroll-padding-top to match, so an in-page anchor is not
 * hidden beneath this bar; the listing page's pinned enquiry column starts
 * at lg:top-20 for the same reason.
 *
 * The items themselves are rendered by SiteNavLinks, in both places, so the
 * current page is marked once from one read of the path.
 */
export function SiteHeader() {
  return (
    <header className="sticky top-0 z-30 border-b border-line bg-surface">
      {/* One row at 360 px: wordmark, number and menu total ~330 px with
          these gaps and sizes. At text-lg the wordmark wrapped and the
          header measured 89 px, under which a 5rem scroll padding left the
          top of an anchored form hidden (measured 2026-09-13).

          Below 360 px the row would need 347 px and the browser zoomed the
          whole page to 92% (second pass, same day). So under 360 the number
          becomes its icon — still a tel: link, still named — and the menu
          control becomes its icon; both stay 44 px wide. */}
      <div className="mx-auto flex max-w-7xl items-center gap-3 px-5 py-2 sm:gap-5 sm:px-8">
        <Link href="/" className="flex min-h-11 flex-col items-start justify-center leading-none">
          <span className="font-display text-base font-semibold tracking-tight whitespace-nowrap text-ink sm:text-lg">
            {site.shortName}
          </span>
          <span className="eyebrow mt-1">Paphos, Cyprus</span>
        </Link>

        {/* The two conversions (lib/site.ts `primary`) are set in the full
            ink at medium weight; the four reading items stay lighter. */}
        <nav aria-label="Main" className="ml-auto hidden items-center gap-5 md:flex">
          <SiteNavLinks variant="desktop" />
        </nav>

        <a
          href={site.contact.phoneHref}
          aria-label={`Call ${site.contact.phone}`}
          className="ml-auto inline-flex min-h-11 min-w-11 shrink-0 items-center justify-center text-sm font-medium text-accent md:ml-0 md:border-l md:border-line md:pl-5"
        >
          <svg
            aria-hidden="true"
            className="min-[360px]:hidden"
            width="20"
            height="20"
            viewBox="0 0 20 20"
            fill="none"
            stroke="currentColor"
            strokeWidth="1.5"
            strokeLinecap="round"
            strokeLinejoin="round"
          >
            <path d="M4 3h3l1.5 4-2 1.2a11 11 0 0 0 5.3 5.3L13 11.5l4 1.5v3a1 1 0 0 1-1 1A13 13 0 0 1 3 4a1 1 0 0 1 1-1z" />
          </svg>
          <span className="hidden min-[360px]:inline">{site.contact.phone}</span>
        </a>

        {/* The panel is absolutely positioned against the header (sticky
            elements are positioned), so opening it overlays the page rather
            than pushing it down. group-open swaps the label and the icon. */}
        <details className="group md:hidden">
          <summary
            aria-label="Menu"
            className="flex min-h-11 min-w-11 cursor-pointer list-none items-center justify-center gap-2 text-sm text-ink-2 [&::-webkit-details-marker]:hidden"
          >
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
            <span className="hidden min-[360px]:inline group-open:hidden">Menu</span>
            <span className="hidden min-[360px]:group-open:inline">Close</span>
          </summary>
          <nav
            aria-label="Main, mobile"
            className="absolute inset-x-0 top-full border-b border-line bg-surface shadow-lg"
          >
            <ul className="mx-auto max-w-7xl px-5 py-2 sm:px-8">
              <SiteNavLinks variant="menu" />
            </ul>
          </nav>
        </details>
        <MenuAutoClose />
      </div>
    </header>
  );
}
