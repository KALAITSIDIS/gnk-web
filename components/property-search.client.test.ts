// @vitest-environment jsdom
import { act, createElement } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { Listing } from "@/lib/crm";

/**
 * The search bar as a person uses it: in a DOM, one change after another,
 * with the URL write landing in between.
 *
 * components/property-search.test.ts pins the SERVER output. This file pins
 * the client behaviour the 2026-09-15 audit found broken: the state is
 * written to the URL 250 ms after a change (history.replaceState, debounced),
 * and the component reads window.location.search on every render. The
 * "state follows the URL" block saw that write for the first time on the
 * render triggered by the NEXT change, when the state already held that
 * newer change, and treated it as a navigation — so the newer change was
 * replaced by the older URL. Measured on production: "kato" typed at 400 ms
 * per key became "kt" with a false "Nothing here matches that yet"; Villa
 * then Peyia / Coral Bay lost the area; on desktop a typed place then Villa
 * lost the type. Only two changes inside one debounce window survived.
 *
 * Every test in the first group therefore makes two changes with a pause
 * between them longer than the debounce, which is how a person uses a
 * filter bar. The second group pins that the URL still leads when it is NOT
 * the component's own write: a deep link, and back/forward.
 */
vi.mock("next/link", () => ({
  default: (props: { href: string; className?: string; children: unknown }) =>
    createElement("a", { href: props.href, className: props.className }, props.children as never),
}));
vi.mock("next/image", () => ({
  default: (props: { src: string; alt: string }) => createElement("img", { src: props.src, alt: props.alt }),
}));

(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

const { PropertySearch } = await import("./property-search");

/* The same three listings as the server test: two areas, two bedroom
   counts and three sale prices, so every control has more than one answer
   and renders. */
const listing = (over: Partial<Listing>): Listing =>
  ({
    kind: "standalone",
    transaction_type: "sale",
    title: { en: "T" },
    district: { en: "Paphos" },
    area: { en: "Peyia / Coral Bay" },
    currency: "EUR",
    images: [],
    features: [],
    ...over,
  }) as unknown as Listing;

const BOOK = [
  listing({ reference: "PAF0004", property_type: "apartment", area: { en: "Kato Paphos" }, asking_price: 285_000, bedrooms: 2, bathrooms: 1, covered_area_sqm: 92 }),
  listing({ reference: "PAF0003", property_type: "land", asking_price: 780_000, plot_area_sqm: 980 }),
  listing({ reference: "PAF0001", property_type: "villa", asking_price: 450_000, bedrooms: 3, bathrooms: 3, covered_area_sqm: 185 }),
];

/** The component's debounce is 250 ms; a pause here is a person's pause, longer than that. */
const PAUSE_MS = 300;

let root: Root;
let container: HTMLDivElement;

function mount(
  search = "",
  props: { briefOnPage?: boolean; offList?: boolean; feedDown?: boolean; listings?: Listing[] } = {},
  hash = "",
) {
  window.history.replaceState(null, "", (search ? `/properties?${search}` : "/properties") + hash);
  container = document.createElement("div");
  document.body.appendChild(container);
  root = createRoot(container);
  act(() => {
    root.render(createElement(PropertySearch, { listings: BOOK, ...props }));
  });
}

const select = (name: string) => container.querySelector<HTMLSelectElement>(`select[name="${name}"]`)!;
const searchBox = () => container.querySelector<HTMLInputElement>('input[type="search"]')!;
/** The cards on the page, by reference, in order. */
const cards = () =>
  [...container.querySelectorAll<HTMLAnchorElement>('article a[href^="/properties/"]')].map((a) =>
    a.getAttribute("href")!.replace("/properties/", ""),
  );

/** A person picks an option: the native change event React listens for. */
function choose(name: string, value: string) {
  act(() => {
    const el = select(name);
    el.value = value;
    el.dispatchEvent(new Event("change", { bubbles: true }));
  });
}

/** A person's keystrokes have brought the box to `value`. The prototype
    setter bypasses React's value tracker, so React sees the input as new. */
function typeInto(value: string) {
  act(() => {
    const el = searchBox();
    Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, "value")!.set!.call(el, value);
    el.dispatchEvent(new Event("input", { bubbles: true }));
  });
}

/** Let the debounced URL write land, as a pause between two actions does. */
function pause() {
  act(() => {
    vi.advanceTimersByTime(PAUSE_MS);
  });
}

beforeEach(() => {
  vi.useFakeTimers();
});

afterEach(() => {
  act(() => {
    root.unmount();
  });
  container.remove();
  vi.useRealTimers();
  window.history.replaceState(null, "", "/");
});

describe("two changes with the URL write landing between them", () => {
  it("keeps the area chosen after the type's URL write has landed", () => {
    mount();
    choose("type", "villa");
    pause();
    expect(window.location.search, "the first change reached the URL").toBe("?type=villa");

    choose("area", "Peyia / Coral Bay");
    pause();

    expect(select("type").value).toBe("villa");
    expect(select("area").value).toBe("Peyia / Coral Bay");
    expect(window.location.search).toBe("?type=villa&area=Peyia+%2F+Coral+Bay");
    expect(cards()).toEqual(["PAF0001"]);
  });

  it("keeps every letter of a word typed slower than the URL write", () => {
    mount();
    for (const soFar of ["k", "ka", "kat", "kato"]) {
      typeInto(soFar);
      pause();
    }
    expect(searchBox().value).toBe("kato");
    expect(window.location.search).toBe("?q=kato");
    expect(cards()).toEqual(["PAF0004"]);
  });

  it("keeps a type chosen after a typed word's URL write has landed", () => {
    mount();
    typeInto("pey");
    pause();
    choose("type", "villa");
    pause();

    expect(searchBox().value).toBe("pey");
    expect(select("type").value).toBe("villa");
    expect(cards()).toEqual(["PAF0001"]);
  });
});

describe("the URL still leads when it is not the component's own write", () => {
  it("applies a filtered deep link when mounted on the client at that URL", () => {
    /* A client-side navigation to /properties?type=land mounts the component
       at that URL without a hydration pass. The filter must apply then too,
       not only after a full page load. */
    mount("type=land");
    expect(select("type").value).toBe("land");
    expect(cards()).toEqual(["PAF0003"]);
  });

  it("follows back and forward to a different URL", () => {
    mount();
    choose("type", "villa");
    pause();

    act(() => {
      window.history.replaceState(null, "", "/properties?type=land");
      window.dispatchEvent(new PopStateEvent("popstate"));
    });

    expect(select("type").value).toBe("land");
    expect(cards()).toEqual(["PAF0003"]);
  });
});

/* ------------------------------------------------------------------------ *
 * When nothing matches (2026-10-18).
 *
 * The empty state offered one way on — a link to /contact, a page with no
 * brief on it — and said nothing about which choice had emptied the page.
 * It now offers the filters whose removal alone would find something, as
 * buttons the visitor presses; nothing is loosened for them. The count is
 * announced from one live region that is always in the page. And the brief
 * link carries the search with it.
 * ------------------------------------------------------------------------ */
const suggestionButtons = () =>
  [...container.querySelectorAll<HTMLButtonElement>("div.text-center button")].map((b) => b.textContent!.replace("×", "").trim());
const liveRegion = () => container.querySelector<HTMLElement>('[aria-live="polite"]')!;
const briefLink = () =>
  [...container.querySelectorAll<HTMLAnchorElement>("a")].find((a) => a.getAttribute("href")!.endsWith("#brief"))!;

describe("when nothing matches", () => {
  it("offers the one filter whose removal finds something, and nothing else", () => {
    // Villa + up to €250k: without the ceiling the villa is back; without
    // the type, nothing in the book is that cheap either.
    mount("type=villa&max=250000");
    expect(cards()).toEqual([]);
    expect(suggestionButtons()).toEqual(["Up to €250k"]);
  });

  it("removes that filter only when the visitor presses it, and keeps the other", () => {
    mount("type=villa&max=250000");
    act(() => {
      container.querySelector<HTMLButtonElement>("div.text-center button")!.click();
    });
    expect(cards()).toEqual(["PAF0001"]);
    expect(select("type").value).toBe("villa");
    expect(select("max").value).toBe("");
  });

  it("offers clearing when no single change would help", () => {
    mount("q=zzz&beds=9");
    expect(cards()).toEqual([]);
    expect(suggestionButtons()).toEqual(["Clear all filters"]);
  });

  it("shows a ceiling the bar does not offer in the select, instead of 'Any price' over an active filter", () => {
    // The book's ladder is €500k and €750k; a shared link said €250k.
    mount("max=250000");
    expect(select("max").value).toBe("250000");
    expect(select("max").selectedOptions[0]!.textContent).toBe("Up to €250k");
  });
});

describe("the count is announced from one region that is always there", () => {
  it("is present, and silent, before anything is filtered", () => {
    mount();
    expect(container.querySelectorAll('[aria-live="polite"]')).toHaveLength(1);
    expect(liveRegion().textContent).toBe("");
  });

  it("says how many match, and says so when none do", () => {
    mount();
    const region = liveRegion();
    choose("type", "villa");
    expect(liveRegion()).toBe(region);
    expect(region.textContent).toBe("1 listing matches");
    choose("max", "500000");
    choose("type", "land");
    expect(region.textContent).toBe("No listings match these filters");
  });
});

describe("the brief link carries the search", () => {
  it("from another page, as the query of /properties#brief", () => {
    mount("type=villa&max=250000");
    expect(briefLink().getAttribute("href")).toBe("/properties?type=villa&max=250000#brief");
    expect(briefLink().textContent).toBe("Send us this brief");
  });

  it("on /properties, as an in-page jump that writes the search to the URL first, even mid-debounce", () => {
    mount("", { briefOnPage: true });
    choose("type", "villa");
    choose("max", "500000");
    choose("area", "Kato Paphos");
    // No pause: the debounced write has not landed yet.
    expect(window.location.search).toBe("");
    expect(briefLink().getAttribute("href")).toBe("#brief");
    act(() => {
      briefLink().dispatchEvent(new MouseEvent("click", { bubbles: true, cancelable: true }));
    });
    expect(window.location.search).toBe("?type=villa&area=Kato+Paphos&max=500000");
  });
});

describe("focus after a button that removes itself (review 2026-10-18)", () => {
  /* Each of these buttons disappears with the filter it removes. Focus used
     to fall to <body>, returning a keyboard user to the top of the page. */
  const chipButtons = () =>
    [...container.querySelectorAll<HTMLButtonElement>('[aria-label="Active filters"] button')];

  it("moves to the next chip, and to the search box when the last one goes", () => {
    mount("type=villa&area=Peyia+%2F+Coral+Bay");
    act(() => chipButtons()[0]!.click());
    expect(document.activeElement).toBe(chipButtons()[0]);
    expect(document.activeElement!.textContent).toContain("Peyia / Coral Bay");
    act(() => chipButtons()[0]!.click());
    expect(document.activeElement).toBe(searchBox());
  });

  it("moves to the first result after a suggestion in the empty state", () => {
    mount("type=villa&max=250000");
    act(() => container.querySelector<HTMLButtonElement>("div.text-center button")!.click());
    expect(document.activeElement?.getAttribute("href")).toBe("/properties/PAF0001");
  });
});

describe("what the review of 2026-10-18 found untested", () => {
  it("announces nothing about filters during a feed outage", () => {
    // The page says the listings are unavailable; "no listings match" would
    // blame the visitor's search for the firm's outage.
    mount("beds=3", { feedDown: true, listings: [] });
    expect(liveRegion().textContent).toBe("");
    expect(container.textContent).toContain("Our listings are briefly unavailable.");
  });

  it("shows a bedroom count the bar does not offer in its select, as it does a ceiling", () => {
    mount("q=zzz&beds=9");
    expect(select("beds").value).toBe("9");
  });

  it("keeps the fragment when the debounced write lands, so a visitor at #brief stays there", () => {
    mount("", {}, "#brief");
    choose("type", "villa");
    pause();
    expect(window.location.search).toBe("?type=villa");
    expect(window.location.hash).toBe("#brief");
  });

  it("from #brief itself, clears the fragment before the jump, so the jump is a real fragment change the form hears", () => {
    /* jsdom does not follow a link, so this pins the half that is code: the
       click writes the NEW search with NO fragment and lets the link's own
       "#brief" proceed — which a browser then performs as a fragment change,
       firing the hashchange the brief form listens for even when the visitor
       was already at #brief. The browser half was measured in Chrome
       (Playwright, 2026-10-18): the form filled and took focus. */
    mount("type=land", { briefOnPage: true }, "#brief");
    choose("max", "500000"); // the plot is €780,000: nothing matches; no pause, the write is pending
    const click = new MouseEvent("click", { bubbles: true, cancelable: true });
    act(() => {
      briefLink().dispatchEvent(click);
    });
    expect(click.defaultPrevented, "the link's own navigation goes ahead").toBe(false);
    expect(briefLink().getAttribute("href")).toBe("#brief");
    expect(window.location.search).toBe("?type=land&max=500000");
    expect(window.location.hash).toBe("");
  });

  it("carries the search the page applied, not a type the book does not hold", () => {
    mount("type=penthouse&max=500000", { offList: true });
    expect(select("type").value).toBe("");
    expect(briefLink().getAttribute("href")).toBe("/properties?max=500000#brief");
  });

  it("closes a filtered list on the home page with a brief that carries the search", () => {
    mount("type=villa", { offList: true });
    const link = [...container.querySelectorAll<HTMLAnchorElement>("a")].find((a) =>
      a.textContent!.includes("Send us this brief"),
    )!;
    expect(cards()).toEqual(["PAF0001"]);
    expect(link.getAttribute("href")).toBe("/properties?type=villa#brief");
    expect(container.textContent).toContain("Not on the list?");
  });

  it("sizes the search box to leave no select alone on a row: the whole first row for four selects", () => {
    // BOOK offers type, area, beds and price: four selects, an even number.
    mount();
    expect(searchBox().closest("label")!.className).toMatch(/\bsm:col-span-2\b/);
  });
});
