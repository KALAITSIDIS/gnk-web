import type { Metadata } from "next";
import { getListings } from "@/lib/crm";
import { PropertySearch } from "@/components/property-search";

// A literal, not the imported constant: Next analyses segment config
// statically and silently drops anything it cannot read at build time.
// Keep this in step with FEED_REVALIDATE in lib/crm.ts.
export const revalidate = 60;

export const metadata: Metadata = {
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
    </div>
  );
}
