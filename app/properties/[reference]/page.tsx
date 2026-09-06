import type { Metadata } from "next";
import Image from "next/image";
import Link from "next/link";
import { notFound, permanentRedirect } from "next/navigation";
import { getListing, getListings } from "@/lib/crm";
import {
  area,
  constructionLabel,
  coverImage,
  deedLabel,
  deliveryLabel,
  isContainer,
  floorLabel,
  label,
  placeLine,
  priceLabel,
  pricePerSqm,
  storeysLabel,
  text,
  titleOf,
  vatLabel,
  yearBuiltLabel,
} from "@/lib/format";
import { EnquiryForm } from "@/components/enquiry-form";
import { ListingContactBar } from "@/components/listing-contact-bar";
import { listingBreadcrumbs, listingJsonLd } from "@/lib/jsonld";
import { OG_BASE } from "@/lib/site-url";
import { site } from "@/lib/site";

// A literal, not the imported constant: Next analyses segment config
// statically and silently drops anything it cannot read at build time.
// Keep this in step with FEED_REVALIDATE in lib/crm.ts.
export const revalidate = 60;

export async function generateStaticParams() {
  const feed = await getListings();
  return feed.ok ? feed.listings.map((l) => ({ reference: l.reference })) : [];
}

export async function generateMetadata({
  params,
}: {
  params: Promise<{ reference: string }>;
}): Promise<Metadata> {
  const { reference } = await params;
  const found = await getListing(reference);
  if (!found.ok || !found.listing) return { title: "Property not found" };
  const l = found.listing;
  const description = text(l.short_description) || text(l.public_description).slice(0, 200) || placeLine(l);
  const cover = coverImage(l);
  /* A listing is the most-shared page on the site, and it had neither a
     canonical nor an og:url — so a shared link carried the layout's root value
     and a share dialog treated a EUR 450,000 villa as the home page. The
     case-variant URL /properties/paf0001 now 308s to the canonical spelling
     (see the redirect below), so this is belt and braces for anything that
     reached the lower-case spelling before that shipped. */
  const path = `/properties/${l.reference}`;
  return {
    title: titleOf(l),
    description,
    alternates: { canonical: path },
    openGraph: {
      // Spread first for the same reason pageMeta does it: this object REPLACES
      // the layout's, so anything omitted here is simply not emitted.
      ...OG_BASE,
      title: titleOf(l),
      description,
      url: path,
      // The photograph beats the generated card — on a listing the image IS the
      // point. Falls back to the card when a listing has no photograph yet.
      images: cover?.card ? [cover.card] : OG_BASE.images,
    },
  };
}

export default async function PropertyPage({
  params,
}: {
  params: Promise<{ reference: string }>;
}) {
  const { reference } = await params;
  const found = await getListing(reference);
  /* THE ORDER HERE IS THE POINT. notFound() answers 404, which tells a search
     engine the property is gone — so it may only ever be reached when the feed
     ANSWERED and genuinely does not hold this reference. If the feed could not
     be reached we throw instead: Next then serves the last good copy of this
     page, or the error boundary, and a live client mandate is never given a
     404 because of a hiccup at our end. */
  if (!found.ok) throw new Error(`Feed unavailable; refusing to 404 ${reference}`);
  if (!found.listing) notFound();
  const l = found.listing;

  /* getListing matches case-insensitively, so /properties/paf0001 answered 200
     with the same content as /properties/PAF0001 — two live URLs for one
     property. The canonical tag added earlier tells a search engine which is
     which; this stops the duplicate existing at all, and sends anyone who typed
     it, or any link written that way, to the spelling the CRM actually uses. */
  if (reference !== l.reference) permanentRedirect(`/properties/${l.reference}`);

  const images = l.images ?? [];
  // The cover is [0] by the feed's contract — see coverImage. This page used to
  // hold two inline copies of that lookup, both reading a flag the feed never
  // sends.
  const cover = coverImage(l);
  /* Every photograph, not the first few: the card badge counts them all, so
     showing four under a badge reading "6 photos" makes the card lie. The
     hero composition keeps three beside the cover; the remainder follow in
     their own row rather than being dropped. */
  const rest = images.slice(1);
  const beside = rest.slice(0, 3);
  const below = rest.slice(3);
  /* Two different things that were being conflated. `summary` is the feed's
     one-line description — useful, but written to describe, not to judge. The
     adviser's view is a judgement, and only exists where a principal has
     written one. */
  /* False for a development: its unit-shaped fields belong to no dwelling. */
  const unitFacts = !isContainer(l);
  const summary = text(l.short_description);
  /* From the FEED now, not a code file. It used to live in lib/views.ts,
     which meant only a developer with a deploy could publish a view — for a
     two-person firm that is the same as impossible. gnk-crm 0085 made it a
     field in the Marketing tab. */
  const view = text(l.adviser_view);
  const body = text(l.public_description);

  /* The measurements a buyer compares on, and the ones a Cyprus buyer asks
     about specifically — deed status, VAT treatment, €/m². Only rows with a
     real value are rendered; an empty table row is worse than a shorter table. */
  const facts: [string, string | null][] = [
    ["Price", priceLabel(l)],
    ["Per m²", pricePerSqm(l)],
    // A development's own beds, baths and areas describe no dwelling anyone can
    // buy — its units carry those, and on PAF0002 the container said 5/5/300 m²
    // while its villas are 4/4/250. Withheld rather than published as fact.
    ["Covered area", unitFacts ? area(l.covered_area_sqm) : null],
    ["Plot", unitFacts ? area(l.plot_area_sqm) : null],
    ["Veranda", unitFacts ? area(l.veranda_sqm) : null],
    ["Bedrooms", unitFacts && l.bedrooms ? String(l.bedrooms) : null],
    ["Bathrooms", unitFacts && l.bathrooms ? String(l.bathrooms) : null],
    ["Parking", unitFacts && l.parking_spaces ? String(l.parking_spaces) : null],
    // "N of M" is a position inside a building; a villa has storeys instead.
    ["Floor", floorLabel(l)],
    ["Storeys", storeysLabel(l)],
    // Withheld on a development for the same reason as bedrooms: the CRM does
    // not connect a project's year to its units. Energy class stays — the CRM
    // inherits that one. See yearBuiltLabel.
    ["Year built", yearBuiltLabel(l)],
    ["Energy class", l.energy_class],
    ["Title deed", deedLabel(l.title_deed_status)],
    // These three are withheld unless the property itself settles them — see
    // constructionLabel / deliveryLabel / vatLabel. Rendering the raw CRM
    // declarations put a self-contradicting tax statement and an impossible
    // handover date on a live client mandate.
    ["Construction", constructionLabel(l)],
    ["Delivery", deliveryLabel(l)],
    ["VAT", vatLabel(l.vat_status)],
    ["Distance to sea", l.sea_distance_m ? `${l.sea_distance_m} m` : null],
    ["Reference", l.reference],
  ];

  /* Both blocks moved to lib/jsonld.ts, where they are tested.
     They were written here, inline, immediately below the facts table — and
     still published the container figures the table three lines above
     withholds, because a second copy of a rule is a second chance to forget
     it. Withholding a fact from a buyer and publishing it to a machine on the
     same page is worse than not withholding it at all. */
  const jsonLd = listingJsonLd(l);
  const breadcrumbs = listingBreadcrumbs(l);

  return (
    <>
    <article className="mx-auto max-w-7xl px-5 py-10 sm:px-8">
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }}
      />
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(breadcrumbs) }}
      />

      <Link href="/properties" className="text-sm text-ink-2 hover:text-accent">
        ← All properties
      </Link>

      <header className="mt-4">
        <p className="eyebrow">{placeLine(l)}</p>
        <h1 className="mt-2 text-4xl">{titleOf(l)}</h1>
        <p className="mt-3 font-display text-3xl text-accent tabular-nums">{priceLabel(l)}</p>
        {/* The card says "Development" on a badge over its photograph. This page
            is where a search result and a shared link land, and it said nothing
            — so a buyer read an unexplained "from" and a facts table with no
            bedrooms as one villa with missing data. Says what it is, and why
            the two things it is missing are missing. */}
        {isContainer(l) ? (
          <p className="mt-2 max-w-prose text-sm text-ink-2">
            A development: the price is the lowest of its units, and bedrooms,
            bathrooms and areas belong to those units rather than to the
            development as a whole.
          </p>
        ) : null}
      </header>

      <div className="mt-8 grid gap-3 md:grid-cols-[2fr_1fr]">
        <div className="relative aspect-[4/3] overflow-hidden bg-surface-2">
          {cover?.card ? (
            <Image
              src={cover.card}
              alt={text(cover.alt) || titleOf(l)}
              fill
              priority
              sizes="(max-width: 768px) 100vw, 66vw"
              className="object-cover"
            />
          ) : (
            <span className="placeholder absolute inset-0 flex items-center justify-center text-sm">
              Photography to follow
            </span>
          )}
        </div>
        {/* 3 columns on a phone, not 2: three tiles in a 2-column grid leave an
            empty half-cell, and with a further row drawn beneath it that hole
            sits in the MIDDLE of the gallery, where it reads as a photograph
            that failed to load. Above md these stack in the hero's narrow
            column as before. */}
        {beside.length > 0 ? (
          <div className="grid grid-cols-3 gap-3 md:grid-cols-1">
            {beside.map((img, i) => (
              <div key={i} className="relative aspect-[4/3] overflow-hidden bg-surface-2">
                {img.card ? (
                  <Image
                    src={img.card}
                    alt={text(img.alt) || `${titleOf(l)} — photograph ${i + 2}`}
                    fill
                    sizes="33vw"
                    className="object-cover"
                  />
                ) : null}
              </div>
            ))}
          </div>
        ) : null}
      </div>

      {/* Same column count as the row above it at every width below lg, so the
          trailing photographs are drawn at the same size as the ones beside the
          cover and any empty cell falls at the ragged END of the gallery. */}
      {below.length > 0 ? (
        <div className="mt-3 grid grid-cols-3 gap-3 lg:grid-cols-4">
          {below.map((img, i) => (
            <div key={i} className="relative aspect-[4/3] overflow-hidden bg-surface-2">
              {img.card ? (
                <Image
                  src={img.card}
                  alt={text(img.alt) || `${titleOf(l)} — photograph ${i + 5}`}
                  fill
                  sizes="(max-width: 640px) 33vw, (max-width: 1024px) 33vw, 25vw"
                  className="object-cover"
                />
              ) : null}
            </div>
          ))}
        </div>
      ) : null}

      <div className="mt-12 grid gap-12 lg:grid-cols-[1.4fr_1fr] lg:items-start">
        <div>
          {view ? (
            <section className="border-l-2 border-accent pl-5">
              <p className="eyebrow">Our view</p>
              <p className="mt-2 font-display text-xl text-ink">{view}</p>
              {/* TODO: byline of the principal who holds the mandate, once the
                  CRM's assigned agent is exposed on the public feed. */}
            </section>
          ) : summary && !body.toLowerCase().startsWith(summary.toLowerCase().slice(0, 60)) ? (
            /* No adviser note yet. The feed's line still earns its place as a
               summary — but in body type, under an honest heading, and without
               the accent rule that marks this firm's own judgement. The prefix
               guard stops it repeating the paragraph directly below it, which
               is exactly what PAF0003 did. */
            <section>
              <p className="eyebrow">Summary</p>
              <p className="mt-2 text-ink-2">{summary}</p>
            </section>
          ) : null}

          {body ? (
            <section className="mt-8">
              <h2 className="text-2xl">About this property</h2>
              {body.split(/\n{2,}/).map((para, i) => (
                <p key={i} className="mt-3 text-ink-2">
                  {para}
                </p>
              ))}
            </section>
          ) : null}

          {(l.features ?? []).length > 0 ? (
            <section className="mt-8">
              <h2 className="text-2xl">Features</h2>
              <ul className="mt-3 flex flex-wrap gap-2">
                {(l.features ?? []).map((f) => (
                  <li key={f} className="border border-line bg-surface px-3 py-1 text-sm text-ink-2">
                    {label(f)}
                  </li>
                ))}
              </ul>
            </section>
          ) : null}

          <section className="mt-8">
            <h2 className="text-2xl">The numbers</h2>
            <dl className="mt-3 grid grid-cols-1 border-t border-line sm:grid-cols-2">
              {facts
                .filter(([, v]) => Boolean(v))
                .map(([k, v]) => (
                  <div key={k} className="flex justify-between gap-4 border-b border-line py-2.5 sm:pr-6">
                    <dt className="text-sm text-ink-3">{k}</dt>
                    <dd className="text-sm text-ink tabular-nums">{v}</dd>
                  </div>
                ))}
            </dl>
            {/* Stamp duty was REMOVED from this sentence on 2026-09-04: the Stamp Duty
                Laws 1963-2024 are repealed for documents signed on or after 1 January 2026
                by Law 239(I)/2025 (gazette No. 5070, 31.12.2025). The site was naming a tax
                that no longer exists, on live client mandates. The CRM holds that repeal
                gazette-verified in cyprus_config.stamp_duty.abolished, dated 2026-08-29 —
                if this ever needs restating, read it from there rather than from memory. */}
            <p className="mt-4 text-xs text-ink-3">
              Transfer fees and VAT vary with the buyer&apos;s circumstances — and stamp duty no
              longer applies to documents signed since 1 January 2026. We model the full
              acquisition cost for you before you commit — ask and we will send it in writing.
            </p>
          </section>
        </div>

        <div id="enquire" className="scroll-mt-6 lg:sticky lg:top-8">
          <EnquiryForm
            reference={l.reference}
            heading="Ask about this property"
            intro={`Arrange a viewing, ask for the full cost model, or get our written view on the price. You will hear back from one of us at ${site.shortName}.`}
            cta="Send enquiry"
          />
        </div>
      </div>

    </article>
    {/* AFTER the article, as a sibling inside <main>: position: sticky then
        rides the viewport bottom only while the listing is on screen, and
        scrolls away with it before the footer arrives — no other element has
        to know this bar's height. It used to sit inside the article as
        position: fixed, with a hand-copied pb-24 guarding the wrong end of the
        page, and hid the footer's last line on every phone. */}
    <ListingContactBar reference={l.reference} />
    </>
  );
}
