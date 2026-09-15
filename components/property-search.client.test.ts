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

function mount(search = "") {
  window.history.replaceState(null, "", search ? `/properties?${search}` : "/properties");
  container = document.createElement("div");
  document.body.appendChild(container);
  root = createRoot(container);
  act(() => {
    root.render(createElement(PropertySearch, { listings: BOOK }));
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
