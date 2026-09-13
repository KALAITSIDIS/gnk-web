import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it, vi } from "vitest";

/**
 * The valuation page's form asks what its intro promises.
 *
 * Second pass, 2026-09-13: the intro read "Tell us where the property is and
 * roughly what it is" over a form with only name, email, phone and a
 * message — a claim on the page that the form beneath it did not back,
 * which is the site's recurring failure in miniature. The form now carries
 * the district, area and type pickers the selling form already had.
 */
vi.mock("next/link", () => ({
  default: (props: { href: string; className?: string; children: unknown }) =>
    createElement("a", { href: props.href, className: props.className }, props.children as never),
}));

const { default: ValuationPage } = await import("./page");
const html = renderToStaticMarkup(ValuationPage());

describe("the valuation page", () => {
  it("still says what it wants to know", () => {
    expect(html).toContain("Tell us where the property is and roughly what it is.");
  });

  it("and asks it", () => {
    for (const name of ["district", "area", "property_type"]) {
      expect(html, name).toMatch(new RegExp(`<select[^>]*name="${name}"`));
    }
  });
});
