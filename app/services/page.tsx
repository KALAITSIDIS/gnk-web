import type { Metadata } from "next";
import Link from "next/link";
import { site } from "@/lib/site";

export const metadata: Metadata = {
  title: "Advisory",
  description:
    "Buyer and seller advisory, investment advisory, pricing analytics, development support, deal structuring and due diligence — in Paphos, Cyprus.",
};

/**
 * One page, six disciplines — not six pages. Two people cannot maintain six
 * service pages, and Danos's ten named disciplines with concrete deliverable
 * lists prove the register works on a single page.
 *
 * Every entry says what the client actually receives at the end, because
 * "investment advisory" means nothing until someone names the deliverable.
 */
export default function ServicesPage() {
  return (
    <div className="mx-auto max-w-7xl px-5 py-14 sm:px-8">
      <p className="eyebrow">Advisory</p>
      <h1 className="mt-2 max-w-3xl text-4xl">
        Six things we do, and what you get at the end of each.
      </h1>
      <p className="mt-4 max-w-2xl text-ink-2">
        We are engaged on one side of a transaction at a time. That is the point: an adviser
        paid by both sides is not advising either of them.
      </p>

      <div className="mt-12 grid gap-px bg-line md:grid-cols-2">
        {site.services.map((s) => (
          <section key={s.slug} className="bg-paper p-7">
            <h2 className="text-2xl">{s.name}</h2>
            <p className="mt-2 text-ink-2">{s.summary}</p>
            <p className="eyebrow mt-5">What you receive</p>
            <ul className="mt-2 space-y-1.5">
              {s.deliverables.map((d) => (
                <li key={d} className="flex gap-2.5 text-sm text-ink-2">
                  <span aria-hidden="true" className="mt-2 h-px w-3 shrink-0 bg-accent" />
                  {d}
                </li>
              ))}
            </ul>
          </section>
        ))}
      </div>

      <section className="mt-14 border border-line bg-surface p-8">
        <h2 className="text-2xl">How an engagement usually starts</h2>
        <ol className="mt-5 grid gap-6 sm:grid-cols-3">
          <li>
            <p className="eyebrow">First</p>
            <p className="mt-1.5 font-display text-lg text-ink">A conversation</p>
            <p className="mt-1.5 text-sm text-ink-2">
              What you are trying to do, your timing, and whether we are the right people for
              it. No charge, and sometimes the answer is that you do not need us.
            </p>
          </li>
          <li>
            <p className="eyebrow">Then</p>
            <p className="mt-1.5 font-display text-lg text-ink">A written view</p>
            <p className="mt-1.5 text-sm text-ink-2">
              A price, a range, or a risk memo — with the evidence attached, so you can check
              the reasoning rather than trust the conclusion.
            </p>
          </li>
          <li>
            <p className="eyebrow">Then</p>
            <p className="mt-1.5 font-display text-lg text-ink">Execution</p>
            <p className="mt-1.5 text-sm text-ink-2">
              Negotiation, structuring and coordination through to completion, with the same
              person who did the analysis.
            </p>
          </li>
        </ol>
        <Link
          href="/contact"
          className="mt-7 inline-block bg-accent px-6 py-3 text-sm font-medium text-white hover:bg-accent-hover"
        >
          Start a conversation
        </Link>
      </section>
    </div>
  );
}
