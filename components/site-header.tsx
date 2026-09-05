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

      {/* The nav has to survive a phone; a hamburger that needs JavaScript to
          open is not worth the risk on a six-item menu.
 
          It no longer fits: at 375px the row is 462px wide, so 87px hang off the
          right and "Contact" — a primary call to action — starts out of sight.
          It has always scrolled, but the only hint was a clipped word. The fade
          below says so. pointer-events-none, so it cannot swallow a tap on the
          item it sits over. */}
      <nav aria-label="Main, mobile" className="relative border-t border-line md:hidden">
        <div
          aria-hidden="true"
          className="pointer-events-none absolute inset-y-0 right-0 z-10 w-10 bg-gradient-to-l from-surface to-transparent"
        />
        <ul className="mx-auto flex max-w-7xl gap-5 overflow-x-auto px-5 py-2.5 text-sm text-ink-2">
          {nav.map((item) => (
            <li key={item.href} className="shrink-0">
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
