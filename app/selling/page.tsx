import type { Metadata } from "next";
import Link from "next/link";
import { EnquiryForm } from "@/components/enquiry-form";

export const metadata: Metadata = {
  title: "Selling your property",
  description:
    "What instructing us involves, what we do before anything is marketed, and what we will need from you. For owners in Paphos and across Cyprus.",
};

/**
 * The seller route, which did not exist: there was no word for an owner
 * anywhere in the navigation, so a Paphos owner deciding who to instruct had no
 * way in beyond a valuation form. Mandates are where the revenue is.
 *
 * DELIBERATELY SILENT ON COMMERCIAL TERMS. The CRM holds the desk's internal
 * default (a commission percentage, a mandate length, exclusivity) and none of
 * it is published here, because it has not been confirmed in writing as a
 * seller-facing offer. The /valuation page previously carried an unconfirmed
 * fee promise for exactly this reason and it had to be withdrawn. "We tell you
 * the fee before you start" commits the firm to nothing it cannot honour; a
 * number would.
 *
 * Also deliberately silent on the firm's regulatory position under Cyprus Law
 * 71(I)/2010. That paragraph is worth writing and belongs here — an unlicensed
 * status is a weakness when discovered and a credential when declared — but it
 * is a legal statement and needs the firm's lawyer, not a copywriter.
 */
export default function SellingPage() {
  const steps: [string, string][] = [
    [
      "We look before we quote",
      "The property, the deed, the planning position and what has actually sold near it. No number until then — a price offered before the evidence is a price designed to win the instruction.",
    ],
    [
      "You get the view in writing",
      "A defensible range with the comparables behind it, and the reasoning you can argue with. If we think the property is worth less than you hoped, that is what it will say.",
    ],
    [
      "You decide whether to instruct us",
      "The view is yours either way. We will tell you the fee before any of this starts, so nothing about the cost arrives as a surprise later.",
    ],
    [
      "We prepare it properly",
      "Photography, the written particulars, the deed and permit position established up front rather than discovered by a buyer's lawyer three weeks in.",
    ],
    [
      "We handle the offers and the negotiation",
      "Including the ones we advise you to refuse, and why. You will speak to the person who valued it, not to whoever picks up.",
    ],
  ];

  const needed: [string, string][] = [
    ["Title deed", "Or the application, if it has not been issued yet. This is the first thing a serious buyer's lawyer asks for."],
    ["Planning permit and building permit", "Along with the certificate of final approval where one exists."],
    ["Floor plans", "Even an architect's originals from the build."],
    ["Energy performance certificate", "Required before a property is marketed."],
    ["Anything unusual", "A shared deed, an ongoing dispute, an unapproved extension, a right of way. Tell us early — none of these stop a sale, and all of them stop one when a buyer finds them first."],
  ];

  return (
    <div className="mx-auto max-w-7xl px-5 py-14 sm:px-8">
      <div className="grid gap-12 lg:grid-cols-[1.1fr_1fr] lg:items-start">
        <div>
          <p className="eyebrow">For owners</p>
          <h1 className="mt-2 text-4xl">Selling, without being told what you want to hear.</h1>
          <p className="mt-5 text-lg text-ink-2">
            Most agents win an instruction by quoting the highest number. The property then
            sits, the price comes down twice, and it sells for less than a realistic figure
            would have achieved in half the time. We would rather have the difficult
            conversation at the start.
          </p>

          <section className="mt-10">
            <h2 className="text-2xl">What happens, in order</h2>
            <ol className="mt-4 space-y-4">
              {steps.map(([h, d], i) => (
                <li key={h} className="flex gap-4">
                  <span
                    aria-hidden="true"
                    className="mt-0.5 shrink-0 font-display text-lg text-accent tabular-nums"
                  >
                    {i + 1}
                  </span>
                  <span>
                    <span className="block font-medium text-ink">{h}</span>
                    <span className="mt-0.5 block text-sm text-ink-2">{d}</span>
                  </span>
                </li>
              ))}
            </ol>
          </section>

          <section className="mt-10">
            <h2 className="text-2xl">What we will need from you</h2>
            <p className="mt-2 text-ink-2">
              Not all at once, and not before we talk. But a sale moves at the speed of its
              paperwork, so it is worth knowing what is coming.
            </p>
            <ul className="mt-4 space-y-3">
              {needed.map(([h, d]) => (
                <li key={h} className="border-l-2 border-accent pl-4">
                  <p className="font-medium text-ink">{h}</p>
                  <p className="text-sm text-ink-2">{d}</p>
                </li>
              ))}
            </ul>
          </section>

          <section className="mt-10 border border-line bg-surface p-6">
            <h2 className="text-xl">What it costs</h2>
            <p className="mt-2 text-ink-2">
              The first conversation costs nothing. We will tell you the fee in writing before
              any work begins, and you will know what it covers. If you would rather start
              with the number than the fee,{" "}
              <Link href="/valuation" className="text-accent underline">
                ask for a valuation
              </Link>{" "}
              and decide afterwards.
            </p>
          </section>
        </div>

        <div className="lg:sticky lg:top-8">
          <EnquiryForm
            seller
            heading="Tell us about your property"
            intro="However much or little you know. One of us will come back to you personally — you will not be handed to an account manager."
            cta="Send"
          />
        </div>
      </div>
    </div>
  );
}
