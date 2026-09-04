"use client";

import { useMemo, useState } from "react";
import type { Listing } from "@/lib/crm";
import { label, placeLine, text, titleOf } from "@/lib/format";
import { PropertyCard } from "@/components/property-card";

/**
 * Search over the whole published portfolio, held in memory.
 *
 * Filtering client-side is a deliberate choice at this size: the feed arrives
 * in one request, so every filter is instant and no interaction costs a round
 * trip. The moment the portfolio outgrows one page this moves server-side —
 * the component's props do not change.
 *
 * THE RULE THAT MATTERS: a control only renders when it has more than one
 * answer to give. A district dropdown listing one district, or a price slider
 * over a single price, tells a visitor exactly how little there is. Aristo
 * prints "All Properties (273)", which is honest at 273 and brutal at four —
 * so there is no result count here either.
 */
export function PropertySearch({
  listings,
  /** The feed could not be reached. Distinct from an empty book: saying
   *  "our mandates are being prepared" during a CRM outage is a false
   *  public statement about the state of the firm. */
  feedDown = false,
}: {
  listings: Listing[];
  feedDown?: boolean;
}) {
  const [q, setQ] = useState("");
  const [type, setType] = useState("");
  const [beds, setBeds] = useState("");
  const [maxPrice, setMaxPrice] = useState("");

  const types = useMemo(
    () => [...new Set(listings.map((l) => l.property_type).filter(Boolean))].sort(),
    [listings],
  );
  const bedOptions = useMemo(
    () =>
      [...new Set(listings.map((l) => l.bedrooms).filter((b): b is number => !!b))].sort(
        (a, b) => a - b,
      ),
    [listings],
  );
  const prices = useMemo(
    () =>
      listings
        .map((l) => (l.transaction_type === "rent" ? l.rent_price_month : l.asking_price))
        .filter((p): p is number => !!p),
    [listings],
  );
  const priceSteps = useMemo(() => {
    if (prices.length < 2) return [];
    const max = Math.max(...prices);
    const steps = [250_000, 500_000, 750_000, 1_000_000, 2_000_000, 5_000_000];
    return steps.filter((s) => s < max);
  }, [prices]);

  const results = useMemo(() => {
    const needle = q.trim().toLowerCase();
    return listings.filter((l) => {
      if (type && l.property_type !== type) return false;
      if (beds && (l.bedrooms ?? 0) < Number(beds)) return false;
      if (maxPrice) {
        const p = l.transaction_type === "rent" ? l.rent_price_month : l.asking_price;
        if (p && p > Number(maxPrice)) return false;
      }
      if (needle) {
        const hay = [
          titleOf(l),
          placeLine(l),
          text(l.district),
          text(l.area),
          l.reference,
          text(l.short_description),
        ]
          .join(" ")
          .toLowerCase();
        if (!hay.includes(needle)) return false;
      }
      return true;
    });
  }, [listings, q, type, beds, maxPrice]);

  const filtering = Boolean(q || type || beds || maxPrice);
  /* One card in a three-column grid floats in dead space. A small portfolio
     gets a layout built for its size instead — which reads as deliberate,
     where a mostly-empty grid reads as a business with nothing to sell. */
  const resultCols =
    results.length === 1
      ? "md:grid-cols-[minmax(0,32rem)]"
      : results.length === 2
        ? "sm:grid-cols-2"
        : "sm:grid-cols-2 xl:grid-cols-3";
  /* How many controls will actually render. A four-column bar holding one
     input leaves three empty columns, which says "we have nothing" as loudly
     as a result count would. The bar sizes itself to what it contains. */
  const controls =
    1 + (types.length > 1 ? 1 : 0) + (bedOptions.length > 1 ? 1 : 0) + (priceSteps.length > 0 ? 1 : 0);
  const barCols =
    controls >= 4
      ? "sm:grid-cols-2 lg:grid-cols-4"
      : controls === 3
        ? "sm:grid-cols-3"
        : controls === 2
          ? "sm:grid-cols-2"
          : "";
  const field =
    "h-11 w-full border border-line bg-surface px-3 text-sm text-ink placeholder:text-ink-3 focus:border-accent focus:outline-none";

  return (
    <div>
      <div className={`grid gap-3 border border-line bg-surface p-4 ${barCols}`}>
        <label className={controls >= 4 ? "lg:col-span-2" : ""}>
          <span className="sr-only">Search by area, town or reference</span>
          <input
            type="search"
            value={q}
            onChange={(e) => setQ(e.target.value)}
            placeholder="Peyia, Coral Bay, Paphos, PAF0001…"
            className={field}
          />
        </label>

        {types.length > 1 ? (
          <label>
            <span className="sr-only">Property type</span>
            <select value={type} onChange={(e) => setType(e.target.value)} className={field}>
              <option value="">Any type</option>
              {types.map((t) => (
                <option key={t} value={t}>
                  {label(t)}
                </option>
              ))}
            </select>
          </label>
        ) : null}

        {bedOptions.length > 1 ? (
          <label>
            <span className="sr-only">Minimum bedrooms</span>
            <select value={beds} onChange={(e) => setBeds(e.target.value)} className={field}>
              <option value="">Any bedrooms</option>
              {bedOptions.map((b) => (
                <option key={b} value={b}>
                  {b}+ bedrooms
                </option>
              ))}
            </select>
          </label>
        ) : null}

        {priceSteps.length > 0 ? (
          <label>
            <span className="sr-only">Maximum price</span>
            <select value={maxPrice} onChange={(e) => setMaxPrice(e.target.value)} className={field}>
              <option value="">Any price</option>
              {priceSteps.map((s) => (
                <option key={s} value={s}>
                  Up to €{(s / 1000).toLocaleString("en-IE")}k
                </option>
              ))}
            </select>
          </label>
        ) : null}
      </div>

      {results.length > 0 ? (
        <div className={`mt-8 grid gap-6 ${resultCols}`}>
          {results.map((l, i) => (
            <PropertyCard key={l.reference} listing={l} priority={i < 3} />
          ))}
        </div>
      ) : (
        <div className="mt-8 border border-line bg-surface p-10 text-center">
          <p className="font-display text-xl text-ink">
            {feedDown
              ? "Our listings are briefly unavailable."
              : filtering
                ? "Nothing here matches that yet."
                : "Our current mandates are being prepared."}
          </p>
          <p className="mx-auto mt-2 max-w-md text-sm text-ink-2">
            {feedDown
              ? "This is a problem at our end, not a reflection of what we have. Please try again shortly, or tell us what you are looking for and we will come back to you."
              : filtering
                ? "We place a great deal off-market. Tell us what you are looking for and we will come back with what fits — including properties never listed publicly."
                : "Tell us what you are looking for and we will come back with what fits."}
          </p>
          <a
            href="/contact"
            className="mt-5 inline-block bg-accent px-5 py-2.5 text-sm font-medium text-white hover:bg-accent-hover"
          >
            Tell us what you need
          </a>
        </div>
      )}
    </div>
  );
}
