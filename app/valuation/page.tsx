import type { Metadata } from "next";
import { EnquiryForm } from "@/components/enquiry-form";

export const metadata: Metadata = {
  title: "What is your property worth",
  description:
    "A written pricing view on your Cyprus property, with real comparables and a defensible range — from a named adviser, not an automated estimate.",
};

/**
 * The highest-leverage page for winning sellers, and the research is blunt
 * about it: Cyprus Resales routes its "Sell" nav item straight to a valuation
 * form, and BuySell puts two valuation funnels ABOVE its own 21,798 listings.
 *
 * One route only — a real valuation by a named person. Deliberately NOT an
 * instant automated estimate: that needs a transaction database this firm does
 * not have, and it invites precisely the comparison it would lose.
 */
export default function ValuationPage() {
  return (
    <div className="mx-auto max-w-7xl px-5 py-14 sm:px-8">
      <div className="grid gap-12 lg:grid-cols-[1.1fr_1fr] lg:items-start">
        <div>
          <p className="eyebrow">Valuation</p>
          <h1 className="mt-2 text-4xl">What is your property actually worth?</h1>
          <p className="mt-5 text-lg text-ink-2">
            Not what a portal&apos;s algorithm guesses, and not what an agent tells you to win
            the instruction. A written view you can act on, or argue with.
          </p>

          <section className="mt-10">
            <h2 className="text-2xl">What you get</h2>
            <ul className="mt-4 space-y-3">
              {[
                ["A defensible range", "Not a single flattering number — the range, and what moves a buyer to the top or bottom of it."],
                ["Real comparables", "What actually sold nearby, what it sold for, and why yours differs."],
                ["Asking versus achieved", "The gap between what your neighbours are asking and what they are getting."],
                ["A conversation", "Fifteen minutes with the person who wrote it, to take it apart."],
              ].map(([h, d]) => (
                <li key={h} className="border-l-2 border-accent pl-4">
                  <p className="font-medium text-ink">{h}</p>
                  <p className="text-sm text-ink-2">{d}</p>
                </li>
              ))}
            </ul>
          </section>

          <section className="mt-10 border border-line bg-surface p-6">
            <h2 className="text-xl">What it costs, and what it commits you to</h2>
            <p className="mt-2 text-ink-2">
              The first conversation and an indicative view cost nothing and commit you to
              nothing. If you want the full written valuation with comparables, we will tell
              you the fee before we start.
            </p>
            {/* The offer to credit the valuation fee against commission was removed on
                2026-09-04: it was live on the page while the TODO beside it recorded that
                the principals had never confirmed the fee position, so the firm was
                publicly offering a commercial term it might not honour. Restore it only
                once that is agreed in writing. */}
          </section>
        </div>

        <div className="lg:sticky lg:top-8">
          <EnquiryForm
            heading="Request a valuation"
            intro="Tell us where the property is and roughly what it is. We will come back with what we need to give you a proper view."
            cta="Request valuation"
          />
        </div>
      </div>
    </div>
  );
}
