import type { Metadata } from "next";
import { pageMeta } from "@/lib/site-url";
import { getListings } from "@/lib/crm";
import Link from "next/link";
import { EnquiryForm } from "@/components/enquiry-form";
import { PropertySearch } from "@/components/property-search";

// A literal, not the imported constant: Next analyses segment config
// statically and silently drops anything it cannot read at build time.
// Keep this in step with FEED_REVALIDATE in lib/crm.ts.
export const revalidate = 60;

export const metadata: Metadata = {
  ...pageMeta("/properties"),
  title: "Properties",
  // NOT "every property carries a written view from the adviser who holds it".
  // lib/views.ts is empty, so that was true of zero of the published listings —
  // and unlike the on-page copy it went out in search results and every shared
  // link, where nobody could see it was false. It may only come back when
  // adviserViews covers every published reference: metadata must never lead the
  // state of that file.
  description:
    "Current mandates in Paphos and across Cyprus. We will tell you what we think a property is worth and why, in writing.",
};

/**
 * The full search. No result count and no pagination furniture: Aristo's
 * "All Properties (273)" is honest at 273 and brutal at four, and a heading
 * that frames a short list as selection reads as curation instead.
 */
export default async function PropertiesPage() {
  const feed = await getListings();

  return (
    <div className="mx-auto max-w-7xl px-5 py-14 sm:px-8">
      <p className="eyebrow">Current mandates</p>
      <h1 className="mt-2 text-4xl">Properties we are prepared to stand behind.</h1>
      <p className="mt-4 max-w-2xl text-ink-2">
        We take on a small number of mandates at a time, and a good deal of what we place
        never appears publicly. If nothing here fits, tell us what does — the useful
        conversation usually starts off-list.
      </p>

      <div className="mt-10">
        <PropertySearch listings={feed.ok ? feed.listings : []} feedDown={!feed.ok} />
      </div>

      {/* Below the results, not only inside the empty state. With a deliberately
          short book the commonest thing a visitor thinks is "neither of these is
          mine" — and the paragraph at the top of this page already promises that
          the useful conversation starts off-list. This is where that promise is
          kept, and it has to be reachable by someone who DID find a result and
          still wants something else. */}
      <div className="mt-16 border-t border-line pt-12">
        <div className="grid gap-10 lg:grid-cols-[1fr_1.1fr] lg:items-start">
          <div>
            <p className="eyebrow">Off-list</p>
            <h2 className="mt-2 text-3xl">Tell us what you are actually looking for.</h2>
            <p className="mt-4 text-ink-2">
              We take on a small number of mandates at a time, so what is on this page is
              never the whole market — and a good deal of what we place never appears
              publicly at all. Tell us the brief and we will come back on what fits,
              including properties you will not find listed.
            </p>
            {/* THIS SENTENCE MUST NOT OUTRUN /legal. It sits directly above a consent
                checkbox whose label links to the privacy notice, so an absolute here is a
                representation made at the point of collection. "Nobody else gets your
                details" was one, and it was false: every enquiry is also emailed to the
                desk through Resend, which app/legal/page.tsx's "Where your enquiry goes"
                section discloses by name. What follows is the promise /legal actually
                stands behind, in the same three terms — no sale, no developers or portals,
                no mailing list. Change these two places together or not at all. */}
            <p className="mt-3 text-sm text-ink-3">
              We will not add you to a mailing list, sell your details, or pass them to
              developers or portals. One of us reads your brief and replies. What we do with
              it is set out in our{" "}
              <Link href="/legal" className="text-accent underline">
                privacy notice
              </Link>
              .
            </p>
          </div>
          <EnquiryForm
            variant="buyer"
            heading="What are you looking for?"
            intro="Rough answers are fine — this is a starting point for a conversation, not a search filter."
            cta="Send brief"
          />
        </div>
      </div>
    </div>
  );
}
