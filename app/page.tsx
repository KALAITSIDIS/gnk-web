import type { Metadata } from "next";
import Link from "next/link";
import { getListings } from "@/lib/crm";
import { OrganizationJsonLd } from "@/components/org-json-ld";
import { pageMeta } from "@/lib/site-url";
import { site } from "@/lib/site";
import { PropertySearch } from "@/components/property-search";

// A literal, not the imported constant: Next analyses segment config
// statically and silently drops anything it cannot read at build time.
// Keep this in step with FEED_REVALIDATE in lib/crm.ts.
export const revalidate = 60;

/* The home page inherits its title and description from the root layout, but
   still has to name itself: without this it had no canonical, and its og:url
   came from the layout value that every other page was wrongly inheriting. */
export const metadata: Metadata = {
  ...pageMeta("/"),
};

/**
 * The ways in, in the order a visitor asks for them. Each is ONE link; the
 * label says whose route it is and the detail what they get, every word of
 * it something the site already stands behind (/properties' brief, the
 * valuation page's range and comparables, the six services).
 *
 * Buying is drawn only from lg. Below it the search IS the buyer's way in and
 * sits directly beneath; a cell for it would push the book down to say what
 * the next thing on the screen already says.
 */
const WAYS = [
  {
    key: "buying",
    label: "Buying",
    action: "Send us a brief",
    href: "/properties#brief",
    detail: "If nothing below fits, tell us what would.",
    from: "lg",
  },
  {
    key: "selling",
    label: "Selling",
    action: "Request a valuation",
    href: "/valuation",
    detail: "A written range, with the comparables behind it.",
    from: null,
  },
  {
    key: "advice",
    label: "Advice",
    action: "What we advise on",
    href: "/services",
    detail: "Pricing, structuring and due diligence on a deal.",
    from: null,
  },
] as const;

/**
 * Search-led, as the firm chose — with the three journeys routed on the first
 * screen instead of 2,000 px below it.
 *
 * THE FIRST SCREEN (2026-10-18). Measured on production: the hero was a
 * headline and one sentence over the search, the right 40% of the desktop
 * row empty, and a seller's way in was a word in the menu or the band two
 * screens down. A design panel set three compositions against each other
 * (a compact search-led intro, an editorial split, a journey router) and
 * three lenses against them (conversion, accessibility and layout,
 * integrity). What shipped takes the router's ways in, the compact
 * intro's height budget and the split's sentence of what the firm does:
 *
 * - one <nav>, after the statement in the DOM and on the screen at every
 *   width: two cells under the sentence on a phone, a ruled list in the
 *   empty right-hand column from lg (where it adds no height beside the
 *   headline);
 * - the eyebrow stays on a phone, so the first screen says "advisory";
 * - the book keeps a heading (sr-only, so the outline does not skip from
 *   the h1 to the advisory section) and the search stays the first control
 *   inside it.
 *
 * WHOSE SIDE. Nothing on this screen says "on your side" or "answers to
 * you": the three cards beneath are the firm's SELLERS' mandates, and a
 * buyer reading such a line above them would be misled. The sentence says
 * whom the firm advises, which is true of every visitor.
 *
 * What sits beneath is what stops a short list reading as an empty shop —
 * the six disciplines, the valuation, the people.
 */
export default async function HomePage() {
  const feed = await getListings();
  /* A principal appears the day lib/site.ts carries a name. Until then the
     section draws no card and promises no name: two boxes reading "Name to
     follow" under "Two names, on every mandate" read as evasion to exactly
     the reader the copy is written for (measured live, 2026-09-13), and so
     did the heading alone over nothing (2026-10-18). app/placeholders.test.ts
     holds this for every page. */
  const principals = site.principals.filter((p) => p.name);

  return (
    <>
      <OrganizationJsonLd />
      <section className="border-b border-line bg-surface">
        <div className="mx-auto max-w-7xl px-5 pt-7 pb-10 sm:px-8 sm:pt-10 lg:pt-12">
          <div className="lg:grid lg:grid-cols-[minmax(0,1fr)_24rem] lg:items-start lg:gap-x-16 xl:grid-cols-[minmax(0,1fr)_26rem]">
            <div>
              <p className="eyebrow">{site.tagline}</p>
              {/* The LCP element at every width measured: plain text in a
                  face already loaded, nothing new painted before it. Sized
                  to set in two lines — 30 px at 390, and 36 px from 1024 to
                  1279, where the column beside the ways in is 512 px and the
                  48 px cut took three (measured 2026-10-18). */}
              <h1 className="mt-2 max-w-3xl text-3xl sm:mt-3 sm:text-4xl xl:text-5xl">
                Property in Paphos, chosen on the numbers.
              </h1>
              <p className="mt-3 max-w-2xl text-base text-ink-2 sm:mt-4 sm:text-lg">
                We advise buyers, sellers and investors, and put our view of price in writing.
              </p>
            </div>

            <nav aria-label="Where to start" className="mt-4 sm:mt-6 lg:mt-0">
              <ul className="grid grid-cols-2 gap-2 sm:gap-3 lg:grid-cols-1 lg:gap-0 lg:border-t lg:border-line">
                {WAYS.map((w) => (
                  /* One target per way: the action is the link, stretched
                     over its cell or row by a pseudo-element (the card's
                     own pattern), so the whole box is the hit area and the
                     accessible name is the action alone. */
                  <li
                    key={w.key}
                    className={`group relative border border-line bg-paper px-3 py-2 hover:border-accent lg:grid lg:grid-cols-[5.5rem_minmax(0,1fr)] lg:items-baseline lg:gap-x-4 lg:border-0 lg:border-b lg:bg-transparent lg:px-0 lg:py-3 ${
                      w.from === "lg" ? "hidden" : ""
                    }`}
                  >
                    <p className="eyebrow">{w.label}</p>
                    <p>
                      <Link
                        href={w.href}
                        className="text-sm font-medium text-accent after:absolute after:inset-0 group-hover:text-accent-hover sm:text-base lg:font-display lg:text-lg"
                      >
                        {w.action}
                        <span aria-hidden="true"> →</span>
                      </Link>
                    </p>
                    <p className="hidden text-sm text-ink-2 lg:col-start-2 lg:block">{w.detail}</p>
                  </li>
                ))}
              </ul>
            </nav>
          </div>

          {/* #properties: the book, with a heading the outline can find. No
              Suspense boundary and no useSearchParams here, on purpose: with
              them Next prerendered the fallback and the live pages shipped
              with no listing cards in their HTML (2026-09-13). The search
              reads the URL after hydration; the server render is the whole
              book. components/property-search.test.ts holds this. */}
          <section id="properties" aria-labelledby="current-properties" className="mt-6 lg:mt-10">
            <h2 id="current-properties" className="sr-only">
              Current properties
            </h2>
            <PropertySearch listings={feed.ok ? feed.listings : []} feedDown={!feed.ok} offList />
          </section>
        </div>
      </section>

      <section className="mx-auto max-w-7xl px-5 py-16 sm:px-8">
        <div className="grid gap-10 md:grid-cols-2">
          <div>
            <p className="eyebrow">Advisory</p>
            <h2 className="mt-2 text-3xl">A judgement you can check.</h2>
            {/* Said as what the client gets, not as what portals and
                developers do (2026-10-18: this opened "A portal is paid by
                whoever advertises. A developer sells what it built."). The
                scope is "when you engage us": on its own listings the firm
                acts for the seller. */}
            <p className="mt-4 text-ink-2">
              When you engage us to buy, to sell or to invest, what you get is a judgement: what
              the property is actually worth, and whether the deal in front of you is a good one
              — including when the answer is no.
            </p>
            <p className="mt-3 text-ink-2">
              We will tell you what we think a property is worth and why, in writing, with
              the comparables behind it. If you cannot see the reasoning, do not act on the
              number.
            </p>
            <Link
              href="/services"
              className="mt-6 inline-block border border-accent px-5 py-3 text-sm font-medium text-accent hover:bg-accent-soft"
            >
              How we work
            </Link>
          </div>

          <div className="grid gap-px bg-line sm:grid-cols-2">
            {site.services.map((s) => (
              <div key={s.slug} className="bg-paper p-5">
                <h3 className="text-base font-semibold text-ink">{s.name}</h3>
                <p className="mt-1.5 text-sm text-ink-2">{s.summary}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      <section className="border-y border-line bg-surface">
        <div className="mx-auto grid max-w-7xl gap-8 px-5 py-16 sm:px-8 md:grid-cols-[1.2fr_1fr] md:items-center">
          <div>
            <p className="eyebrow">Selling</p>
            <h2 className="mt-2 text-3xl">What is your property actually worth?</h2>
            <p className="mt-4 max-w-xl text-ink-2">
              A written pricing view with real comparables and a defensible range, and a
              conversation with the person who reached it.
            </p>
            {/* Both sentences, from the one place the valuation page reads
                them: "cost nothing" alone beside the button below would read
                as a free written valuation. */}
            <p className="mt-3 max-w-xl text-sm text-ink-2">{site.valuationTerms}</p>
          </div>
          <div className="flex flex-wrap items-center gap-x-6 gap-y-2 md:justify-self-end">
            <Link
              href="/valuation"
              className="inline-block bg-accent px-6 py-3 text-sm font-medium text-white hover:bg-accent-hover"
            >
              Request a valuation
            </Link>
            <Link
              href="/selling"
              className="inline-flex min-h-11 items-center text-sm font-medium text-accent hover:text-accent-hover"
            >
              What instructing us involves<span aria-hidden="true"> →</span>
            </Link>
          </div>
        </div>
      </section>

      <section className="mx-auto max-w-7xl px-5 py-16 sm:px-8">
        <p className="eyebrow">The people you deal with</p>
        <h2 className="mt-2 text-3xl">The person who values a property negotiates it.</h2>
        <p className="mt-3 max-w-2xl text-ink-2">
          Whatever you get in touch about, one of us will reply personally.
        </p>
        {principals.length > 0 ? (
          <div className="mt-8 grid gap-6 sm:grid-cols-2">
            {principals.map((p) => (
              <div key={p.name} className="border border-line bg-surface p-6">
                <p className="font-display text-lg text-ink">{p.name}</p>
                {p.role ? <p className="text-sm text-ink-3">{p.role}</p> : null}
                {p.bio ? <p className="mt-3 text-sm text-ink-2">{p.bio}</p> : null}
              </div>
            ))}
          </div>
        ) : null}
        {/* The channels themselves, after a promise of a personal reply: a
            sentence about replying with no way to start the conversation
            beside it read as a reply window, not an invitation. */}
        <div className="mt-6 flex flex-wrap items-center gap-x-6 gap-y-2">
          <a
            href={site.contact.phoneHref}
            className="inline-flex min-h-11 items-center border border-accent px-5 text-sm font-medium text-accent hover:bg-accent-soft"
          >
            Call {site.contact.phone}
          </a>
          <a
            href={site.contact.whatsappHref}
            rel="noopener noreferrer"
            target="_blank"
            className="inline-flex min-h-11 items-center text-sm font-medium text-accent hover:text-accent-hover"
          >
            Message us on WhatsApp
          </a>
          <Link
            href="/about"
            className="inline-flex min-h-11 items-center text-sm font-medium text-accent hover:text-accent-hover"
          >
            More about the firm<span aria-hidden="true"> →</span>
          </Link>
        </div>
        <p className="mt-2 text-sm text-ink-2">Office hours: {site.contact.hours}.</p>
      </section>
    </>
  );
}
