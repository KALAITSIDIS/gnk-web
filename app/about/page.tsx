import type { Metadata } from "next";
import Link from "next/link";
import { site } from "@/lib/site";

export const metadata: Metadata = {
  title: "About",
  description:
    "An independent real estate advisory practice in Paphos. Two principals, named, on every mandate.",
};

/**
 * The most valuable page on this site, and the one that cannot be written for
 * them. Across 35 Cyprus property sites researched, almost none names a single
 * human being — Sotheby's About page names nobody, the Paphos agencies name
 * nobody, the developers have no team page. Two named people with real
 * histories is an unoccupied position.
 *
 * Everything not yet supplied renders as a visible gap. Nothing here invents a
 * biography, a year, or a credential.
 */
export default function AboutPage() {
  const bioMissing = site.principals.some((p) => !p.bio);

  return (
    <div className="mx-auto max-w-7xl px-5 py-14 sm:px-8">
      <p className="eyebrow">About</p>
      <h1 className="mt-2 max-w-3xl text-4xl">
        An independent practice, in a market that mostly is not.
      </h1>
      <p className="mt-4 max-w-2xl text-lg text-ink-2">
        Developers sell the buildings they built. Portals are paid by whoever advertises. We
        are paid by one client, on one side of one transaction, to say what we actually
        think.
      </p>

      <section className="mt-14">
        <h2 className="text-3xl">The principals</h2>
        <p className="mt-2 max-w-2xl text-ink-2">
          You will deal with one of these two people from first conversation to completion.
        </p>

        <div className="mt-8 grid gap-8 md:grid-cols-2">
          {site.principals.map((p, i) => (
            <div key={i} className="border border-line bg-surface p-7">
              {p.photo ? null : (
                <div className="placeholder flex h-56 items-center justify-center text-sm">
                  Photograph to follow
                </div>
              )}
              <h3 className="mt-5 font-display text-2xl text-ink">
                {p.name ?? <span className="italic text-ink-3">Name to follow</span>}
              </h3>
              {p.role ? <p className="text-sm text-ink-3">{p.role}</p> : null}
              <p className="mt-4 text-ink-2">
                {p.bio ?? (
                  <span className="italic text-ink-3">
                    Background, prior experience and qualifications to follow.
                  </span>
                )}
              </p>
              {p.phone || p.email ? (
                <p className="mt-4 text-sm">
                  {p.phone ? (
                    <a href={`tel:${p.phone}`} className="text-accent hover:underline">
                      {p.phone}
                    </a>
                  ) : null}
                  {p.phone && p.email ? <span className="text-ink-3"> · </span> : null}
                  {p.email ? (
                    <a href={`mailto:${p.email}`} className="text-accent hover:underline">
                      {p.email}
                    </a>
                  ) : null}
                </p>
              ) : null}
            </div>
          ))}
        </div>

        {bioMissing ? (
          <p className="mt-5 text-xs text-ink-3">
            This page is being completed. Until then, reach either of us on{" "}
            <a href={site.contact.phoneHref} className="text-accent hover:underline">
              {site.contact.phone}
            </a>
            .
          </p>
        ) : null}
      </section>

      <section className="mt-16 grid gap-10 border-t border-line pt-12 md:grid-cols-2">
        <div>
          <h2 className="text-2xl">How we are paid</h2>
          <p className="mt-3 text-ink-2">
            By the client who engaged us, and disclosed before we start. We do not take a fee
            from both sides of a transaction, and we will tell you when our interest and
            yours diverge.
          </p>
        </div>
        <div>
          <h2 className="text-2xl">Where we work</h2>
          <p className="mt-3 text-ink-2">
            Paphos and the surrounding coast, where we know the streets well enough to argue
            about a price. We advise across Cyprus, but we say so when a market is one we
            follow rather than one we live in.
          </p>
        </div>
      </section>

      <div className="mt-14">
        <Link
          href="/contact"
          className="inline-block bg-accent px-6 py-3 text-sm font-medium text-white hover:bg-accent-hover"
        >
          Talk to us
        </Link>
      </div>
    </div>
  );
}
