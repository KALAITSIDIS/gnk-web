"use client";

import { useEffect, useMemo, useRef, useState, useSyncExternalStore } from "react";
import type { Listing } from "@/lib/crm";
import { label, moneyShort, placeLine, text, titleOf } from "@/lib/format";
import {
  activeFilters,
  areaOptionsFor,
  bedroomOptionsFor,
  DEFAULT_SEARCH,
  matchesArea,
  matchesBedrooms,
  matchesMaxPrice,
  parseSearchState,
  priceStepsFor,
  resultCols,
  resultCountLabel,
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
 * so the unfiltered book carries no result count. While a filter is on, the
 * chip row says how many match: that counts what the filter did, not what
 * the firm holds, and a person who has just watched the grid change under
 * them needs to be told what happened (lib/search.ts resultCountLabel). The
 * sort control follows the one-answer rule too: it appears once two listings
 * carry a sale price.
 *
 * THE STATE LIVES IN THE URL (2026-09-13, audit WEB-04). `?q&type&area&beds&
 * max&sort` is read after hydration — so a shared or bookmarked link, a
 * reload and the back button all restore the view — and written back with
 * the native history.replaceState as the controls change, debounced so typing
 * does not write a URL per keystroke. The server render is always the whole
 * book. lib/search.ts owns the reading and writing; this file only wires the
 * controls to it. A chip row names what is filtering and lets each filter be
 * removed alone, or all at once.
 *
 * ON A PHONE the search box stays and every filter folds behind one
 * "Filters" row. Measured on an iPhone 13 viewport (2026-09-13): five
 * stacked controls made a 302 px block, and with the header and the hero
 * above it the first property card began at 819 px on a 664 px screen. The
 * fold is a JavaScript toggle, which is honest about what this component is:
 * the filtering itself needs JavaScript, and without it the page is the
 * whole book either way.
 *
 * THE SORT IS NOT A FILTER. It sat in the bar as a sixth control and read as
 * one (audit 2026-09-13). A filter changes what is shown; a sort changes the
 * order of what is shown, so it sits with the results, in its own row above
 * the grid, with a visible label.
 */
const SORT_LABELS: Record<Sort, string> = {
  newest: "Newest first",
  "price-asc": "Price: low to high",
  "price-desc": "Price: high to low",
};

/** Long enough to type a word, short enough that the address bar keeps up. */
const URL_WRITE_DELAY_MS = 250;

/* The browser's URL as an external store: back and forward are the one way
   it moves without us. On the server there is no window and the snapshot is
   empty — so the server render is always the whole book. */
const subscribeToUrl = (onChange: () => void) => {
  window.addEventListener("popstate", onChange);
  return () => window.removeEventListener("popstate", onChange);
};
const readUrlSearch = () => window.location.search;
const readServerUrlSearch = () => "";

/* The text input spans two tracks; every other control takes one. Five
   controls therefore need six tracks, four need five (live-ui-3, measured
   2026-09-06: on a four-track grid the fourth control wrapped alone). Written
   out because Tailwind only ships the class names it can read. */
const BAR_COLS: Record<number, string> = {
  2: "sm:grid-cols-2",
  3: "sm:grid-cols-3",
  5: "sm:grid-cols-2 lg:grid-cols-5",
  6: "sm:grid-cols-2 lg:grid-cols-6",
};

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
  /* NOT useSearchParams. On a prerendered page that hook makes Next render
     the nearest Suspense fallback into the HTML and the search on the client
     only — the live home and list pages shipped with no listing cards at all
     for forty minutes on 2026-09-13. The URL is read here after hydration
     instead: the server snapshot is empty, so the HTML always carries the
     whole book, and a filtered deep link is applied the moment the page is
     interactive. components/property-search.test.ts holds this. */
  const urlSearch = useSyncExternalStore(subscribeToUrl, readUrlSearch, readServerUrlSearch);
  const [s, setS] = useState<SearchState>(DEFAULT_SEARCH);
  const [showFilters, setShowFilters] = useState(false);

  /* Follow the URL when it moves — on hydration (from empty to the real
     query) and on back and forward. Done during render, React's pattern for
     state that follows external input, not in an effect: an effect would run
     a render late and, keyed on the state as well, would reset the input to
     the not-yet-written URL on every keystroke. Our own writes land as a URL
     equal to the state, so only the memory moves; a URL that differs from
     the state is a navigation the person made, and the state follows it. */
  const urlKey = serializeSearchState(parseSearchState(new URLSearchParams(urlSearch)));
  const [seenUrl, setSeenUrl] = useState(urlKey);
  if (urlKey !== seenUrl) {
    setSeenUrl(urlKey);
    if (urlKey !== serializeSearchState(s)) setS(parseSearchState(new URLSearchParams(urlSearch)));
  }

  /* Write the state to the URL after the controls change — never on mount,
     and never when the URL already says the same thing. The native
     history.replaceState: no history entry per keystroke, no server round
     trip per filter (a router.replace would fetch the page's payload again),
     and nothing to wait for offline. */
  const mounted = useRef(false);
  useEffect(() => {
    if (!mounted.current) {
      mounted.current = true;
      return;
    }
    const next = serializeSearchState(s);
    if (next === serializeSearchState(parseSearchState(new URLSearchParams(window.location.search)))) {
      return;
    }
    const t = setTimeout(() => {
      const path = window.location.pathname;
      window.history.replaceState(null, "", next ? `${path}?${next}` : path);
    }, URL_WRITE_DELAY_MS);
    return () => clearTimeout(t);
  }, [s]);

  const types = useMemo(
    () => [...new Set(listings.map((l) => l.property_type).filter(Boolean))].sort(),
    [listings],
  );
  // lib/search.ts — the areas the book is actually filed under.
  const areas = useMemo(() => areaOptionsFor(listings), [listings]);
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

  /* A type or an area the book does not hold filters nothing and shows no
     chip: a stale link to a type that has since sold should show the book,
     not a blank. The area is matched without case, since a URL is typed. */
  const effective: SearchState = useMemo(
    () => ({
      ...s,
      type: types.includes(s.type) ? s.type : "",
      area: areas.find((a) => a.toLowerCase() === s.area.toLowerCase()) ?? "",
    }),
    [s, types, areas],
  );

  const results = useMemo(() => {
    const needle = effective.q.trim().toLowerCase();
    const filtered = listings.filter((l) => {
      if (effective.type && l.property_type !== effective.type) return false;
      if (!matchesArea(l, effective.area)) return false;
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
  /* What the folded controls are doing right now, for the toggle's label —
     the search box is always visible, so its chip does not count here. */
  const foldedActive = chips.filter((c) => c.key !== "q").length;
  /* How many controls will actually render in the bar. A four-column bar
     holding one input leaves three empty columns, which says "we have
     nothing" as loudly as a result count would. The bar sizes itself to what
     it contains. The sort is not counted: it lives with the results. */
  const showSort = prices.length > 1;
  const controls =
    1 +
    (types.length > 1 ? 1 : 0) +
    (areas.length > 1 ? 1 : 0) +
    (bedOptions.length > 1 ? 1 : 0) +
    (priceSteps.length > 0 ? 1 : 0);
  const barCols = BAR_COLS[controls >= 4 ? controls + 1 : controls] ?? "";
  /* 16 px on a phone: Safari zooms the page into any field set smaller when
     it is focused, and every field here was 14 (measured 2026-09-13). The
     width is added separately: a filter fills its grid track, the sort is
     as wide as its words. */
  const fieldBase =
    "h-11 border border-line-strong bg-surface px-3 text-base text-ink placeholder:text-ink-3 focus:border-accent sm:text-sm";
  const field = `${fieldBase} w-full`;

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

        {controls > 1 ? (
          <button
            type="button"
            onClick={() => setShowFilters((open) => !open)}
            aria-expanded={showFilters}
            aria-controls="search-filters"
            className="flex min-h-11 items-center justify-between gap-3 border border-line-strong bg-surface px-3 text-base text-ink sm:hidden"
          >
            <span>{showFilters ? "Hide filters" : "Filters"}</span>
            {foldedActive > 0 ? (
              <span className="text-sm text-accent tabular-nums">{foldedActive} active</span>
            ) : (
              <span aria-hidden="true" className="text-ink-3">
                {showFilters ? "−" : "+"}
              </span>
            )}
          </button>
        ) : null}

        {/* sm:contents dissolves this wrapper above the fold breakpoint, so
            the controls are the bar's own grid items there; below it the
            wrapper is what the button above shows and hides. */}
        <div id="search-filters" className={`${showFilters ? "grid" : "hidden"} gap-3 sm:contents`}>
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

          {areas.length > 1 ? (
            <label>
              <span className="sr-only">Area</span>
              <select name="area" value={effective.area} onChange={(e) => set("area", e.target.value)} className={field}>
                <option value="">Any area</option>
                {areas.map((a) => (
                  <option key={a} value={a}>
                    {a}
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
        </div>
      </div>

      {filtering ? (
        <div className="mt-3 flex flex-wrap items-center gap-2 text-sm" aria-label="Active filters">
          {results.length > 0 ? (
            <p className="mr-1 text-ink-3 tabular-nums" aria-live="polite">
              {resultCountLabel(results.length)}
            </p>
          ) : null}
          {chips.map((chip) => (
            <button
              key={chip.key}
              type="button"
              onClick={() => set(chip.key, "" as never)}
              aria-label={`Remove filter: ${chip.label}`}
              className="inline-flex min-h-9 items-center gap-1.5 border border-line-strong bg-surface px-2.5 py-1 text-ink-2 hover:border-accent hover:text-accent"
            >
              {chip.label}
              <span aria-hidden="true">×</span>
            </button>
          ))}
          <button
            type="button"
            onClick={() => setS({ ...DEFAULT_SEARCH, sort: s.sort })}
            className="inline-flex min-h-9 items-center px-1 text-accent underline underline-offset-2 hover:text-accent-hover"
          >
            Clear all
          </button>
        </div>
      ) : null}

      {showSort ? (
        <div className="mt-8 flex items-center justify-end gap-3 text-sm">
          <label htmlFor="sort" className="whitespace-nowrap text-ink-3">
            Sort by
          </label>
          <select
            id="sort"
            name="sort"
            value={s.sort}
            onChange={(e) => set("sort", e.target.value as Sort)}
            className={`${fieldBase} w-auto`}
          >
            {SORTS.map((o) => (
              <option key={o} value={o}>
                {SORT_LABELS[o]}
              </option>
            ))}
          </select>
        </div>
      ) : null}

      {results.length > 0 ? (
        <div className={`${showSort ? "mt-4" : "mt-8"} grid gap-6 ${resultCols(results.length)}`}>
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
            className="mt-5 inline-block bg-accent px-5 py-3 text-sm font-medium text-white hover:bg-accent-hover"
          >
            Tell us what you need
          </a>
        </div>
      )}
    </div>
  );
}
