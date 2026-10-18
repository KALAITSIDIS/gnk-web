import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { afterEach, describe, expect, it, vi } from "vitest";
import { feedRow } from "@/lib/feed-fixtures";

/**
 * A listing page with no photograph draws no picture frame.
 *
 * Measured on production 2026-10-18: every listing page opened with the 4:3
 * box drawn for a missing photograph — 803 x 602 px of grey at 1280, the
 * largest thing on the page, reading "Photography to follow" — and the facts
 * began 1,506 px down. With no photograph the page now says so in one line
 * and offers the next step; with one, the gallery is exactly as it was.
 * Rendered as the server renders it, against a faked feed.
 */
vi.mock("next/navigation", () => ({
  notFound: () => {
    throw new Error("notFound");
  },
  permanentRedirect: (to: string) => {
    throw new Error(`redirect ${to}`);
  },
}));
vi.mock("next/link", () => ({
  default: (props: { href: string; className?: string; children: unknown }) =>
    createElement("a", { href: props.href, className: props.className }, props.children as never),
}));
vi.mock("next/image", () => ({
  default: (props: { src: string; alt: string }) => createElement("img", { src: props.src, alt: props.alt }),
}));

function fakeFeed(listing: Record<string, unknown>) {
  vi.spyOn(globalThis, "fetch").mockImplementation((() =>
    Promise.resolve(
      new Response(JSON.stringify({ org: "gnk", count: 1, limit: 50, offset: 0, listings: [listing] }), {
        status: 200,
        headers: { "content-type": "application/json" },
      }),
    )) as never);
}

afterEach(() => vi.restoreAllMocks());

const render = async () => {
  const { default: PropertyPage } = await import("./page");
  return renderToStaticMarkup(await PropertyPage({ params: Promise.resolve({ reference: "PAF0001" }) }));
};

describe("the listing page's photographs", () => {
  it("with none, says so in one line, offers the next step, and draws no 4:3 frame", async () => {
    fakeFeed({ ...feedRow({ reference: "PAF0001" }), images: [] });
    const html = await render();
    expect(html).toContain("No photographs yet.");
    expect(html).toMatch(/<a href="#enquire"[^>]*>Ask about it, or arrange a viewing/);
    expect(html).not.toMatch(/to follow/i);
    expect(html).not.toMatch(/aspect-\[4\/3\]/);
    expect(html).not.toMatch(/<img/);
  }, 20_000);

  it("with photographs whose cover has no rendition, still draws the gallery and never says 'no photographs'", async () => {
    // The feed contract allows null renditions (lib/feed-schema.ts). That
    // listing HAS photographs: the gallery stays, its cover box plain, and
    // the rest are drawn (review 2026-10-18).
    const real = (feedRow().images as Record<string, unknown>[])[0]!;
    fakeFeed({
      ...feedRow({ reference: "PAF0001" }),
      images: [{ ...real, thumb: null, card: null, full: null }, real, real, real, real],
    });
    const html = await render();
    expect(html).not.toContain("No photographs yet");
    expect(html).toMatch(/aspect-\[4\/3\]/);
    expect(html).toMatch(/<img/);
  }, 20_000);

  it("with photographs, draws the gallery as before and no 'no photographs' line", async () => {
    fakeFeed(feedRow({ reference: "PAF0001" }));
    const html = await render();
    expect(html).toMatch(/<img/);
    expect(html).toMatch(/aspect-\[4\/3\]/);
    expect(html).not.toContain("No photographs yet");
  }, 20_000);
});
