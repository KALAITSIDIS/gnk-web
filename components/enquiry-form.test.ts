import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it, vi } from "vitest";
import { INTENTS } from "@/lib/enquiry-fields";

/**
 * The enquiry form on the device most people fill it in on.
 *
 * Three things measured on an iPhone 13 viewport, 2026-09-13. Every field
 * was 14 px, which is below the 16 px at which Safari stops zooming the page
 * on focus — so every tap into the form zoomed it. The phone field was a
 * plain text input, so it raised the full keyboard. And on a listing page
 * the form began 2,161 px down: the sticky bar's "Enquire" jumped to it but
 * left focus on the body, and the three things the intro invites ("arrange
 * a viewing, ask for the full cost model, or get our written view on the
 * price") still had to be typed out.
 */
vi.mock("next/link", () => ({
  default: (props: { href: string; className?: string; children: unknown }) =>
    createElement("a", { href: props.href, className: props.className }, props.children as never),
}));

const { EnquiryForm } = await import("./enquiry-form");

const listingForm = renderToStaticMarkup(
  createElement(EnquiryForm, { reference: "PAF0001", focusOnHash: "#enquire" }),
);
const contactForm = renderToStaticMarkup(createElement(EnquiryForm, {}));

describe("the enquiry form on a phone", () => {
  it("asks for a phone number with the telephone keyboard", () => {
    const phone = /<input[^>]*name="phone"[^>]*>/.exec(listingForm);
    expect(phone).not.toBeNull();
    expect(phone![0]).toMatch(/type="tel"/);
    // react-dom/server emits the prop's own casing; HTML attributes are case-insensitive.
    expect(phone![0]).toMatch(/inputmode="tel"/i);
  });

  it("sets every field at 16 px on a phone, so Safari does not zoom on focus", () => {
    const fields = [...listingForm.matchAll(/<(?:input|select|textarea) [^>]*class="([^"]*)"/g)]
      .map((m) => m[1]!)
      .filter((cls) => cls.includes("placeholder:text-ink-3"));
    expect(fields.length).toBeGreaterThan(0);
    for (const cls of fields) expect(cls, cls).toMatch(/\btext-base\b/);
  });
});

describe("the three common requests", () => {
  it("each names the reference, so the desk never has to ask which property", () => {
    expect(INTENTS).toHaveLength(3);
    for (const intent of INTENTS) {
      expect(intent.message("PAF0001")).toContain("PAF0001");
      expect(intent.label.length).toBeLessThan(32);
    }
  });

  it("are offered on a listing's form as buttons that submit nothing", () => {
    for (const intent of INTENTS) {
      const button = new RegExp(`<button[^>]*>${intent.label}</button>`).exec(listingForm);
      expect(button, intent.label).not.toBeNull();
      expect(button![0]).toMatch(/type="button"/);
      expect(button![0]).toMatch(/\bmin-h-11\b/);
    }
  });

  it("are not offered on the contact form, which is about nothing in particular", () => {
    for (const intent of INTENTS) expect(contactForm).not.toContain(intent.label);
  });
});
