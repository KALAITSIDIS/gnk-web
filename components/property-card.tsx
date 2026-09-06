import Image from "next/image";
import Link from "next/link";
import type { Listing } from "@/lib/crm";
import {
  area,
  bedroomsOf,
  coverImage,
  deedLabel,
  isContainer,
  label,
  placeLine,
  priceLabel,
  text,
  titleOf,
} from "@/lib/format";

/**
 * The card, in the anatomy this market has converged on: photograph, price
 * first, then the measurements, then where it is. JamesEdition, Bazaraki and
 * BuySell all read in that order, so a buyer arriving from any of them can
 * scan this one without relearning it.
 *
 * The line under the specification is the part none of them has — but only
 * when it is genuinely the adviser's, which is why it takes the feed's
 * adviser_view first and falls back to the summary. The accent rule marks a
 * judgement, so
 * it is reserved for one: the same styling on a portal-register line ("prime
 * residential land... excellent development potential") claims something the
 * sentence does not deliver, and a seller judges how this firm would market
 * their property by looking at how it markets other people's.
 *
 * Sized large on purpose: four cards at this scale fill a screen properly,
 * where four thin MLS rows would advertise how few there are.
 */
export function PropertyCard({ listing, priority = false }: { listing: Listing; priority?: boolean }) {
  const cover = coverImage(listing);
  const photos = listing.images?.length ?? 0;
  const view = text(listing.adviser_view);
  const summary = text(listing.short_description);
  const deed = deedLabel(listing.title_deed_status);
  /* Imported, not re-typed. This predicate decides what the whole site
     withholds; a second copy of it here is a second thing to remember to
     change, and the one class of bug this project keeps producing is one fact
     living in two places. */
  const isProject = isContainer(listing);

  /* A development's own beds/baths/area describe no dwelling for sale — the
     units carry those. Showing them puts one villa's shape on a project that
     contains six of a different shape. */
  /* bedroomsOf is the one bedrooms rule (it already withholds a container's);
     a studio's zero is kept and said as a word, where `if (bedrooms)` dropped
     the one fact that defines a studio. */
  const beds = bedroomsOf(listing);
  const specs = isProject
    ? []
    : [
        beds === null ? null : beds === 0 ? "Studio" : `${beds} bed`,
        listing.bathrooms ? `${listing.bathrooms} bath` : null,
        area(listing.covered_area_sqm),
      ].filter(Boolean);

  return (
    <article className="group flex flex-col overflow-hidden border border-line bg-surface transition-colors hover:border-line-2">
      <Link href={`/properties/${listing.reference}`} className="relative block aspect-[4/3] overflow-hidden bg-surface-2">
        {cover?.card ? (
          <Image
            src={cover.card}
            alt={text(cover.alt) || titleOf(listing)}
            fill
            priority={priority}
            sizes="(max-width: 768px) 100vw, (max-width: 1280px) 50vw, 33vw"
            className="object-cover transition-transform duration-500 group-hover:scale-[1.03]"
          />
        ) : (
          <span className="placeholder absolute inset-0 flex items-center justify-center text-xs">
            Photography to follow
          </span>
        )}

        {isProject ? (
          <span className="absolute top-3 left-3 bg-ink/85 px-2.5 py-1 text-[11px] font-medium tracking-wide text-white uppercase">
            Development
          </span>
        ) : null}

        {photos > 1 ? (
          <span className="absolute right-3 bottom-3 bg-ink/70 px-2 py-0.5 text-[11px] text-white tabular-nums">
            {photos} photos
          </span>
        ) : null}
      </Link>

      <div className="flex flex-1 flex-col gap-2.5 p-5">
        <p className="font-display text-xl font-semibold text-ink tabular-nums">
          {priceLabel(listing)}
        </p>

        {specs.length > 0 ? (
          <p className="text-sm text-ink-2 tabular-nums">{specs.join(" · ")}</p>
        ) : null}

        <p className="text-sm text-ink-2">{placeLine(listing)}</p>

        {view ? (
          <p className="mt-1 border-l-2 border-accent pl-3 text-sm text-ink-2 italic">
            {view}
          </p>
        ) : summary ? (
          <p className="mt-1 text-sm text-ink-2">{summary}</p>
        ) : null}

        <div className="mt-auto flex flex-wrap gap-1.5 pt-3">
          {deed ? (
            <span className="border border-accent/30 bg-accent-soft px-2 py-0.5 text-[11px] text-accent">
              {deed}
            </span>
          ) : null}
          {(listing.features ?? []).slice(0, 3).map((f) => (
            <span key={f} className="border border-line bg-surface-2 px-2 py-0.5 text-[11px] text-ink-2">
              {label(f)}
            </span>
          ))}
        </div>

        <Link
          href={`/properties/${listing.reference}`}
          className="mt-3 text-sm font-medium text-accent hover:text-accent-hover"
        >
          {listing.reference} — full detail →
        </Link>
      </div>
    </article>
  );
}
