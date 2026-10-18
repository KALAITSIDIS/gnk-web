import type { Metadata } from "next";
import { pageMeta } from "@/lib/site-url";
import Link from "next/link";
import { EnquiryForm } from "@/components/enquiry-form";
import { site } from "@/lib/site";

export const metadata: Metadata = {
  ...pageMeta("/valuation"),
  title: "What is your property worth",
  // Not "from a named adviser" (2026-10-18): no adviser is named anywhere on
  // the site yet, and this sentence goes out in search results and every
  // shared link, where nobody can see that it is ahead of the page.
  description:
    "A written pricing view on your Cyprus property, with real comparables and a defensible range, from the person who would negotiate the sale.",
};

/**
 * The highest-leverage page for winning sellers, and the research is blunt
 * about it: Cyprus Resales routes its "Sell" nav item straight to a valuation
 * form, and BuySell puts two valuation funnels ABOVE its own 21,798 listings.
 *
 * One route only — a real valuation by the person who would negotiate the
 * sale. Deliberately NOT an
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
          {/* Said as what the owner gets, not as what others do wrong
              (2026-10-18: this opened by criticising portals' algorithms and
              agents). Every clause is one of the four items listed below. */}
          <p className="mt-5 text-lg text-ink-2">
            A written view of what your property should sell for, the comparables behind it,
            and the person who wrote it to talk it through. Something you can act on, or
            argue with.
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
            <p className="mt-2 text-ink-2">{site.valuationTerms}</p>
            <p className="mt-3 text-sm text-ink-2">
              If you are past the number and weighing up who to instruct,{" "}
              <Link href="/selling" className="text-accent underline">
                what that involves is set out here
              </Link>
              .
            </p>
            {/* The offer to credit the valuation fee against commission was removed on
                2026-09-04: it was live on the page while the TODO beside it recorded that
                the principals had never confirmed the fee position, so the firm was
                publicly offering a commercial term it might not honour. Restore it only
                once that is agreed in writing. */}
          </section>
        </div>

        {/* lg:top-20 clears the 61 px sticky header, as the listing page's
            enquiry column does. top-8 (32 px) would have slid the form's
            first 29 px beneath it. Measured 2026-10-18 the column never
            actually stuck — the form is the taller of the two columns, so it
            has no room to travel — but the day the left column grows, it
            would; components/site-header.test.ts holds both pages to this. */}
        <div className="lg:sticky lg:top-20">
          <EnquiryForm
            variant="valuation"
            heading="Request a valuation"
            intro="Tell us where the property is and roughly what it is. We will come back with what we need to give you a proper view."
            cta="Request valuation"
          />
        </div>
      </div>
    </div>
  );
}
