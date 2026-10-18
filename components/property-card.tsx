import Image from "next/image";
import Link from "next/link";
import type { Listing } from "@/lib/crm";
import {
  cardSpecs,
  coverImage,
  deedLabel,
  isContainer,
  kindOf,
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
 *
 * ONE TARGET. Measured on the live site 2026-09-13: the price and the place
 * line — the two things a buyer's eye lands on — did nothing when clicked;
 * the links were the photograph and a 20 px "full detail" line at the
 * bottom. The price is now the card's one link, stretched over the whole
 * card by a pseudo-element, and it carries the place line in its accessible
 * name so a screen reader hears what the figure is for. The row at the
 * bottom is the visible affordance; the reference stays there for the
 * person who phones and reads it out. components/property-card.test.ts.
 *
 * WITH NO PHOTOGRAPH, A PLATE (2026-10-18). Every published listing has had
 * none since September, so three grey boxes reading "Photography to follow"
 * were the largest thing on the home page — and "to follow" is the promise
 * app/placeholders.test.ts forbids a page to make (it passed only because
 * that test feeds an empty book). The box is now set like the title page of
 * a set of particulars: what it is and where, in the display face, and then,
 * plainly, "No photographs yet". It is the same box the photograph will fill,
 * so nothing moves the day one arrives. Type and place are hidden from a
 * screen reader, which hears them in the price link; it hears the one fact
 * the plate adds. The frame is 3:2 — the shape of most property photography —
 * rather than 4:3: 29 px less on a phone, which is what puts the first price
 * on the first screen at 390 x 844.
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
  const where = text(listing.area) || text(listing.district);

  /* One function decides the line of measurements by what the thing IS: a
     plot shows its plot area (the card used to drop PAF0003's 980 m² and show
     a price alone), a dwelling its beds, baths and covered area, a
     development nothing — its figures belong to its units. lib/format.ts
     cardSpecs, pinned by lib/card-specs.test.ts. */
  const specs = cardSpecs(listing);

  return (
    <article className="group relative flex flex-col overflow-hidden border border-line bg-surface transition-colors hover:border-accent focus-within:border-accent">
      <div className="relative aspect-[3/2] overflow-hidden bg-surface-2">
        {cover?.card ? (
          <Image
            src={cover.card}
            alt={text(cover.alt) || titleOf(listing)}
            fill
            priority={priority}
            sizes="(max-width: 639px) 100vw, (max-width: 1023px) 50vw, 33vw"
            className="object-cover transition-transform duration-500 group-hover:scale-[1.03]"
          />
        ) : (
          <div className="placeholder absolute inset-0 flex flex-col justify-end p-5">
            <div aria-hidden="true">
              <p className="font-display text-3xl leading-none font-medium text-ink lg:text-2xl xl:text-3xl">
                {kindOf(listing)}
              </p>
              {where ? <p className="mt-2 text-sm text-ink-2">{where}</p> : null}
            </div>
            <p className="mt-4 border-t border-line-2 pt-3 text-sm text-ink-2">No photographs yet</p>
          </div>
        )}

        {/* With no photograph the plate already names a development
            ("Villa development"); the badge is for the photograph. */}
        {isProject && cover?.card ? (
          <span className="absolute top-3 left-3 bg-ink/85 px-2.5 py-1 text-xs font-medium tracking-wide text-white uppercase">
            Development
          </span>
        ) : null}

        {photos > 1 ? (
          <span className="absolute right-3 bottom-3 bg-ink/70 px-2 py-0.5 text-xs text-white tabular-nums">
            {photos} photos
          </span>
        ) : null}
      </div>

      <div className="flex flex-1 flex-col gap-2.5 p-5">
        <p className="font-display text-xl font-semibold text-ink tabular-nums">
          {/* The pseudo-element is positioned against the article (relative
              above), so this one anchor is the whole card's hit area. The
              chips beneath stay plain spans; nothing else in the card is
              interactive, so nothing is covered that a person would want. */}
          <Link
            href={`/properties/${listing.reference}`}
            className="after:absolute after:inset-0 hover:text-accent"
          >
            {priceLabel(listing)}
            <span className="sr-only">, {placeLine(listing)} — view property</span>
          </Link>
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
            <span className="border border-accent/30 bg-accent-soft px-2 py-0.5 text-xs text-accent">
              {deed}
            </span>
          ) : null}
          {(listing.features ?? []).slice(0, 3).map((f) => (
            <span key={f} className="border border-line bg-surface-2 px-2 py-0.5 text-xs text-ink-2">
              {label(f)}
            </span>
          ))}
        </div>

        <p className="mt-3 flex min-h-11 items-center justify-between gap-3 border-t border-line pt-3 text-sm">
          <span className="font-medium text-accent group-hover:text-accent-hover">View property →</span>
          <span className="text-sm text-ink-3 tabular-nums">{listing.reference}</span>
        </p>
      </div>
    </article>
  );
}
