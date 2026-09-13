import Link from "next/link";
import { nav, site } from "@/lib/site";

export function SiteHeader() {
  return (
    <header className="border-b border-line bg-surface">
      <div className="mx-auto flex max-w-7xl items-center gap-6 px-5 py-4 sm:px-8">
        <Link href="/" className="flex flex-col leading-none">
          <span className="font-display text-lg font-semibold tracking-tight text-ink">
            {site.shortName}
          </span>
          <span className="eyebrow mt-1">Paphos, Cyprus</span>
        </Link>

        <nav aria-label="Main" className="ml-auto hidden items-center gap-7 md:flex">
          {nav.map((item) => (
            <Link
              key={item.href}
              href={item.href}
              className="text-sm text-ink-2 transition-colors hover:text-accent"
            >
              {item.label}
            </Link>
          ))}
        </nav>

        <a
          href={site.contact.phoneHref}
          className="ml-auto shrink-0 text-sm font-medium text-accent md:ml-0 md:border-l md:border-line md:pl-6"
        >
          {site.contact.phone}
        </a>
      </div>

      {/* The nav has to survive a phone without JavaScript: a hamburger that
          needs a script to open is not worth the risk on a six-item menu.

          It used to scroll sideways. At 375 px the row was 462 px wide, so
          87 px hung off the right and "Contact" — a primary call to action —
          started out of sight behind a gradient that only hinted at it
          (measured 2026-09-13). Six short words are allowed to wrap onto a
          second line instead: nothing hidden, nothing scrolling, no fade
          pretending to be a control. components/site-header.test.ts says so. */}
      <nav aria-label="Main, mobile" className="border-t border-line md:hidden">
        <ul className="mx-auto flex max-w-7xl flex-wrap gap-x-5 gap-y-1.5 px-5 py-2.5 text-sm text-ink-2">
          {nav.map((item) => (
            <li key={item.href}>
              <Link href={item.href} className="hover:text-accent">
                {item.label}
              </Link>
            </li>
          ))}
        </ul>
      </nav>
    </header>
  );
}
