"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { usePathname, useSearchParams } from "next/navigation";
import type { Listing } from "@/lib/crm";
import { label, moneyShort, placeLine, text, titleOf } from "@/lib/format";
import {
  activeFilters,
  bedroomOptionsFor,
  DEFAULT_SEARCH,
  matchesBedrooms,
  matchesMaxPrice,
  parseSearchState,
  priceStepsFor,
  salePrice,
  serializeSearchState,
  sortListings,
  SORTS,
  type SearchState,
  type Sort,
} from "@/lib/search";
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
 * so there is no result count here either. The sort control follows the same
 * rule: it appears once two listings carry a sale price.
 *
 * THE STATE LIVES IN THE URL (2026-09-13, audit WEB-04). `?q&type&beds&max&
 * sort` is read on arrival — so a shared or bookmarked link, a reload and the
 * back button all restore the view — and written back with the native
 * history.replaceState as the controls change, debounced so typing does not
 * write a URL per keystroke. lib/search.ts owns the reading and writing; this file only wires
 * the controls to it. A chip row names what is filtering and lets each filter
 * be removed alone, or all at once.
 */
const SORT_LABELS: Record<Sort, string> = {
  newest: "Newest first",
  "price-asc": "Price: low to high",
  "price-desc": "Price: high to low",
};

/** Long enough to type a word, short enough that the address bar keeps up. */
const URL_WRITE_DELAY_MS = 250;

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
  const params = useSearchParams();
  const pathname = usePathname();

  const [s, setS] = useState<SearchState>(() => parseSearchState(params));

  /* Write the state to the URL after the controls change — never on mount,
     and never when the URL already says the same thing. The native
     history.replaceState, which Next keeps in step with useSearchParams: no
     history entry per keystroke, no server round trip per filter (a
     router.replace would fetch the page's payload again), and nothing to
     wait for offline. */
  const mounted = useRef(false);
  useEffect(() => {
    if (!mounted.current) {
      mounted.current = true;
      return;
    }
    const next = serializeSearchState(s);
    if (next === serializeSearchState(parseSearchState(params))) return;
    const t = setTimeout(
      () => window.history.replaceState(null, "", next ? `${pathname}?${next}` : pathname),
      URL_WRITE_DELAY_MS,
    );
    return () => clearTimeout(t);
  }, [s, params, pathname]);

  /* Follow the URL when it moves without us — the back and forward buttons.
     Done during render, React's pattern for state that follows a prop, not
     in an effect: an effect would run a render late and, keyed on the state
     as well, would reset the input to the not-yet-written URL on every
     keystroke. Our own replace() lands as a URL equal to the state, so only
     the URL memory moves; a URL that differs from the state is a navigation
     the person made, and the state follows it. */
  const urlKey = serializeSearchState(parseSearchState(params));
  const [seenUrl, setSeenUrl] = useState(urlKey);
  if (urlKey !== seenUrl) {
    setSeenUrl(urlKey);
    if (urlKey !== serializeSearchState(s)) setS(parseSearchState(params));
  }

  const types = useMemo(
    () => [...new Set(listings.map((l) => l.property_type).filter(Boolean))].sort(),
    [listings],
  );
  // lib/search.ts — a development contributes no bedroom count: its own is
  // the one figure every other surface withholds.
  const bedOptions = useMemo(() => bedroomOptionsFor(listings), [listings]);
  // lib/search.ts — sale prices only: a rental's month is not a rung on this
  // ladder, and would have dragged it down to a step no sale can match.
  const prices = useMemo(
    () => listings.map(salePrice).filter((p): p is number => !!p),
    [listings],
  );
  // lib/search.ts — a step must be able to include something and exclude
  // something, or it is a filter that can only return an empty page.
  const priceSteps = useMemo(() => priceStepsFor(prices), [prices]);

  /* A type the book does not hold filters nothing and shows no chip: a stale
     link to a type that has since sold should show the book, not a blank. */
  const effective: SearchState = useMemo(
    () => ({ ...s, type: types.includes(s.type) ? s.type : "" }),
    [s, types],
  );

  const results = useMemo(() => {
    const needle = effective.q.trim().toLowerCase();
    const filtered = listings.filter((l) => {
      if (effective.type && l.property_type !== effective.type) return false;
      if (!matchesBedrooms(l, effective.beds)) return false;
      if (!matchesMaxPrice(l, effective.max)) return false;
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
    return sortListings(filtered, effective.sort);
  }, [listings, effective]);

  const chips = activeFilters(effective);
  const filtering = chips.length > 0;
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
  const showSort = prices.length > 1;
  const controls =
    1 +
    (types.length > 1 ? 1 : 0) +
    (bedOptions.length > 1 ? 1 : 0) +
    (priceSteps.length > 0 ? 1 : 0) +
    (showSort ? 1 : 0);
  /* The text input spans two tracks; every other control takes one. Five
     controls therefore need six tracks, four need five (live-ui-3, measured
     2026-09-06: on a four-track grid the fourth control wrapped alone). */
  const barCols =
    controls >= 5
      ? "sm:grid-cols-2 lg:grid-cols-6"
      : controls === 4
        ? "sm:grid-cols-2 lg:grid-cols-5"
        : controls === 3
          ? "sm:grid-cols-3"
          : controls === 2
            ? "sm:grid-cols-2"
            : "";
  const field =
    "h-11 w-full border border-line-strong bg-surface px-3 text-sm text-ink placeholder:text-ink-3 focus:border-accent";

  const set = <K extends keyof SearchState>(key: K, value: SearchState[K]) =>
    setS((current) => ({ ...current, [key]: value }));

  return (
    <div>
      <div className={`grid gap-3 border border-line bg-surface p-4 ${barCols}`}>
        <label className={controls >= 4 ? "lg:col-span-2" : ""}>
          <span className="sr-only">Search by area, town or reference</span>
          <input
            type="search"
            name="q"
            value={s.q}
            maxLength={120}
            onChange={(e) => set("q", e.target.value)}
            placeholder="Peyia, Coral Bay, Paphos, PAF0001…"
            className={field}
          />
        </label>

        {types.length > 1 ? (
          <label>
            <span className="sr-only">Property type</span>
            <select name="type" value={effective.type} onChange={(e) => set("type", e.target.value)} className={field}>
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
            <select name="beds" value={s.beds} onChange={(e) => set("beds", e.target.value)} className={field}>
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
            <select name="max" value={s.max} onChange={(e) => set("max", e.target.value)} className={field}>
              <option value="">Any price</option>
              {priceSteps.map((step) => (
                <option key={step} value={step}>
                  Up to {moneyShort(step)}
                </option>
              ))}
            </select>
          </label>
        ) : null}

        {showSort ? (
          <label>
            <span className="sr-only">Sort by</span>
            <select name="sort" value={s.sort} onChange={(e) => set("sort", e.target.value as Sort)} className={field}>
              {SORTS.map((o) => (
                <option key={o} value={o}>
                  {SORT_LABELS[o]}
                </option>
              ))}
            </select>
          </label>
        ) : null}
      </div>

      {filtering ? (
        <div className="mt-3 flex flex-wrap items-center gap-2 text-sm" aria-label="Active filters">
          {chips.map((chip) => (
            <button
              key={chip.key}
              type="button"
              onClick={() => set(chip.key, "" as never)}
              aria-label={`Remove filter: ${chip.label}`}
              className="inline-flex items-center gap-1.5 border border-line-strong bg-surface px-2.5 py-1 text-ink-2 hover:border-accent hover:text-accent"
            >
              {chip.label}
              <span aria-hidden="true">×</span>
            </button>
          ))}
          <button
            type="button"
            onClick={() => setS({ ...DEFAULT_SEARCH, sort: s.sort })}
            className="px-1 text-accent underline underline-offset-2 hover:text-accent-hover"
          >
            Clear all
          </button>
        </div>
      ) : null}

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
