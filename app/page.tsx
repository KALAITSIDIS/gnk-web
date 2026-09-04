import Link from "next/link";
import { getListings } from "@/lib/crm";
import { OrganizationJsonLd } from "@/components/org-json-ld";
import { site } from "@/lib/site";
import { PropertySearch } from "@/components/property-search";

// A literal, not the imported constant: Next analyses segment config
// statically and silently drops anything it cannot read at build time.
// Keep this in step with FEED_REVALIDATE in lib/crm.ts.
export const revalidate = 60;

/**
 * Search-led, as the firm chose: the search and the mandates come first.
 *
 * What sits directly beneath them is what stops a short list reading as an
 * empty shop — the two people, the six disciplines, the valuation invitation.
 * Even BuySell, with 21,798 Paphos properties, puts its valuation funnels
 * above its own listings.
 */
export default async function HomePage() {
  const feed = await getListings();

  return (
    <>
      <OrganizationJsonLd />
      <section className="border-b border-line bg-surface">
        <div className="mx-auto max-w-7xl px-5 pt-14 pb-10 sm:px-8">
          <p className="eyebrow">{site.tagline}</p>
          <h1 className="mt-3 max-w-3xl text-4xl sm:text-5xl">
            Property in Paphos, chosen on the numbers.
          </h1>
          <p className="mt-4 max-w-2xl text-lg text-ink-2">{site.positioning}</p>

          <div className="mt-9">
            <PropertySearch listings={feed.ok ? feed.listings : []} feedDown={!feed.ok} />
          </div>
        </div>
      </section>

      <section className="mx-auto max-w-7xl px-5 py-16 sm:px-8">
        <div className="grid gap-10 md:grid-cols-2">
          <div>
            <p className="eyebrow">Why us</p>
            <h2 className="mt-2 text-3xl">We are paid for judgement, not for listings.</h2>
            <p className="mt-4 text-ink-2">
              A portal is paid by whoever advertises. A developer sells what it built. We are
              paid to tell a buyer or a seller what a property is actually worth and whether
              the deal in front of them is a good one — including when the answer is no.
            </p>
            <p className="mt-3 text-ink-2">
              We will tell you what we think a property is worth and why, in writing, with
              the comparables behind it. If you cannot see the reasoning, do not act on the
              number.
            </p>
            <Link
              href="/services"
              className="mt-6 inline-block border border-accent px-5 py-2.5 text-sm font-medium text-accent hover:bg-accent-soft"
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
              Not an automated estimate. A written pricing view with real comparables, a
              defensible range, and a named person who will talk you through how it was
              reached.
            </p>
          </div>
          <div className="md:justify-self-end">
            <Link
              href="/valuation"
              className="inline-block bg-accent px-6 py-3 text-sm font-medium text-white hover:bg-accent-hover"
            >
              Request a valuation
            </Link>
          </div>
        </div>
      </section>

      <section className="mx-auto max-w-7xl px-5 py-16 sm:px-8">
        <p className="eyebrow">The people you deal with</p>
        <h2 className="mt-2 text-3xl">Two names, on every mandate.</h2>
        <p className="mt-3 max-w-2xl text-ink-2">
          You will not be handed to an account manager. The person who values your property
          is the person who negotiates it.
        </p>
        <div className="mt-8 grid gap-6 sm:grid-cols-2">
          {site.principals.map((p, i) => (
            <div key={i} className="border border-line bg-surface p-6">
              <div className="placeholder flex h-40 items-center justify-center text-xs">
                Photograph to follow
              </div>
              <p className="mt-4 font-display text-lg text-ink">
                {p.name ?? <span className="text-ink-3">Name to follow</span>}
              </p>
              {p.role ? <p className="text-sm text-ink-3">{p.role}</p> : null}
              <p className="mt-3 text-sm text-ink-2">
                {p.bio ?? "Biography to follow."}
              </p>
            </div>
          ))}
        </div>
        <Link href="/about" className="mt-6 inline-block text-sm font-medium text-accent hover:text-accent-hover">
          More about the firm →
        </Link>
      </section>
    </>
  );
}
