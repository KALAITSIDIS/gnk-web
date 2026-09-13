import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it, vi } from "vitest";
import { contactDetailError, INTENTS } from "@/lib/enquiry-fields";

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

describe("what the form says is required, before anyone presses Send", () => {
  /* Second pass 2026-09-13: the name was required and nothing said so; the
     email-or-phone rule surfaced only after a failed submit, as a message two
     fields below the ones it was about, with focus left on the button. */
  it("marks the name as required in its label", () => {
    const label = /<label[^>]*>[\s\S]*?<\/label>/.exec(contactForm.slice(contactForm.indexOf('name="name"') - 400));
    expect(label, "the name field has a label").not.toBeNull();
    expect(label![0]).toMatch(/required/i);
  });

  it("says that one of email or phone is needed, next to those two fields", () => {
    const note = /<p[^>]*id="contact-note"[^>]*>([\s\S]*?)<\/p>/.exec(contactForm);
    expect(note, "a note beside email and phone").not.toBeNull();
    expect(note![1]).toMatch(/one is required/i);
    expect(contactForm.indexOf('id="contact-note"')).toBeGreaterThan(contactForm.indexOf('name="phone"'));
    expect(contactForm.indexOf('id="contact-note"')).toBeLessThan(contactForm.indexOf('name="message"'));
  });

  it("wires email and phone to the note and to the error that will appear there", () => {
    for (const name of ["email", "phone"]) {
      const input = new RegExp(`<input[^>]*name="${name}"[^>]*>`).exec(contactForm);
      expect(input![0], name).toMatch(/aria-describedby="[^"]*contact-note[^"]*"/);
      expect(input![0], name).toMatch(/aria-describedby="[^"]*contact-error[^"]*"/);
    }
  });

  it("is one rule, tested on its own: blank email and blank phone is the only failing case", () => {
    expect(contactDetailError({ email: "", phone: "" })).toMatch(/email address or a phone number/);
    expect(contactDetailError({ email: "  ", phone: null })).not.toBeNull();
    expect(contactDetailError({ email: "a@b.cy", phone: "" })).toBeNull();
    expect(contactDetailError({ email: "", phone: "+357 99 000000" })).toBeNull();
  });
});

describe("the valuation variant asks what the valuation page promises", () => {
  /* /valuation said "tell us where the property is and roughly what it is"
     above a form with only name, email, phone and a message. */
  const valuationForm = renderToStaticMarkup(createElement(EnquiryForm, { variant: "valuation" }));

  it("offers district, area and property type", () => {
    for (const name of ["district", "area", "property_type"]) {
      expect(valuationForm, name).toMatch(new RegExp(`<select[^>]*name="${name}"`));
    }
  });

  it("does not ask the seller's nine further questions", () => {
    for (const name of ["bedrooms", "covered_area_sqm", "plot_area_sqm", "year_built", "title_deed_status", "listed_elsewhere", "timing"]) {
      expect(valuationForm, name).not.toMatch(new RegExp(`name="${name}"`));
    }
  });

  it("says those three are optional", () => {
    expect(valuationForm).toMatch(/optional/i);
  });
});
