import type { Metadata } from "next";
import Image from "next/image";
import Link from "next/link";
import { notFound, permanentRedirect } from "next/navigation";
import { getListing, getListings } from "@/lib/crm";
import {
  area,
  constructionLabel,
  deedLabel,
  deliveryLabel,
  floorLabel,
  label,
  placeLine,
  priceLabel,
  pricePerSqm,
  storeysLabel,
  text,
  titleOf,
  vatLabel,
} from "@/lib/format";
import { EnquiryForm } from "@/components/enquiry-form";
import { adviserView } from "@/lib/views";
import { absolute } from "@/lib/site-url";
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
  const cover = (l.images ?? []).find((i) => i.is_cover) ?? (l.images ?? [])[0];
  /* A listing is the most-shared page on the site, and it had neither a
     canonical nor an og:url — so a shared link carried the layout's root value
     and a share dialog treated a EUR 450,000 villa as the home page. It also
     makes the case-variant URL (/properties/paf0001, which answers 200) point
     at the canonical spelling. */
  const path = `/properties/${l.reference}`;
  return {
    title: titleOf(l),
    description,
    alternates: { canonical: path },
    openGraph: {
      title: titleOf(l),
      description,
      url: path,
      images: cover?.card ? [cover.card] : undefined,
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
  const cover = images.find((i) => i.is_cover) ?? images[0];
  /* Every photograph, not the first few: the card badge counts them all, so
     showing four under a badge reading "6 photos" makes the card lie. The
     hero composition keeps three beside the cover; the remainder follow in
     their own row rather than being dropped. */
  const rest = images.filter((i) => i !== cover);
  const beside = rest.slice(0, 3);
  const below = rest.slice(3);
  /* Two different things that were being conflated. `summary` is the feed's
     one-line description — useful, but written to describe, not to judge. The
     adviser's view is a judgement, and only exists where a principal has
     written one. */
  const summary = text(l.short_description);
  const view = adviserView(l.reference);
  const body = text(l.public_description);

  /* The measurements a buyer compares on, and the ones a Cyprus buyer asks
     about specifically — deed status, VAT treatment, €/m². Only rows with a
     real value are rendered; an empty table row is worse than a shorter table. */
  const facts: [string, string | null][] = [
    ["Price", priceLabel(l)],
    ["Per m²", pricePerSqm(l)],
    ["Covered area", area(l.covered_area_sqm)],
    ["Plot", area(l.plot_area_sqm)],
    ["Veranda", area(l.veranda_sqm)],
    ["Bedrooms", l.bedrooms ? String(l.bedrooms) : null],
    ["Bathrooms", l.bathrooms ? String(l.bathrooms) : null],
    ["Parking", l.parking_spaces ? String(l.parking_spaces) : null],
    // "N of M" is a position inside a building; a villa has storeys instead.
    ["Floor", floorLabel(l)],
    ["Storeys", storeysLabel(l)],
    ["Year built", l.year_built ? String(l.year_built) : null],
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

  const jsonLd = {
    "@context": "https://schema.org",
    "@type": "RealEstateListing",
    name: titleOf(l),
    description: summary || body.slice(0, 300) || placeLine(l),
    // Absolute: a relative url in structured data is undefined behaviour for
    // every consumer that reads it away from this page.
    url: absolute(`/properties/${l.reference}`),
    image: images.map((i) => i.card).filter(Boolean),
    ...(l.asking_price
      ? {
          offers: {
            "@type": "Offer",
            price: l.asking_price,
            priceCurrency: l.currency ?? "EUR",
            availability: "https://schema.org/InStock",
          },
        }
      : {}),
    address: {
      "@type": "PostalAddress",
      addressLocality: text(l.area) || text(l.district),
      addressRegion: text(l.district),
      addressCountry: "CY",
    },
    ...(l.covered_area_sqm
      ? { floorSize: { "@type": "QuantitativeValue", value: l.covered_area_sqm, unitCode: "MTK" } }
      : {}),
    ...(l.bedrooms ? { numberOfBedrooms: l.bedrooms } : {}),
  };

  /* Where this page sits, so a search result can show the path rather than a
     bare URL. Absolute throughout for the same reason the listing url is. */
  const breadcrumbs = {
    "@context": "https://schema.org",
    "@type": "BreadcrumbList",
    itemListElement: [
      { "@type": "ListItem", position: 1, name: "Home", item: absolute("/") },
      { "@type": "ListItem", position: 2, name: "Properties", item: absolute("/properties") },
      {
        "@type": "ListItem",
        position: 3,
        name: titleOf(l),
        item: absolute(`/properties/${l.reference}`),
      },
    ],
  };

  return (
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

        <div className="lg:sticky lg:top-8">
          <EnquiryForm
            reference={l.reference}
            heading="Ask about this property"
            intro={`Arrange a viewing, ask for the full cost model, or get our written view on the price. You will hear back from one of us at ${site.shortName}.`}
            cta="Send enquiry"
          />
        </div>
      </div>
    </article>
  );
}
