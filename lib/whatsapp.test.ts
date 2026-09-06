import { describe, expect, it } from "vitest";
import { site } from "@/lib/site";
import { whatsappHref } from "./whatsapp";

describe("the WhatsApp prefill", () => {
  it("is the bare number with no reference", () => {
    expect(whatsappHref()).toBe(site.contact.whatsappHref);
    expect(whatsappHref(null)).toBe(site.contact.whatsappHref);
  });

  it("names the reference and carries the listing's address, so the firm can open it from the message", () => {
    const href = whatsappHref("PAF0001", "https://gnk-web.vercel.app/properties/PAF0001");
    expect(href.startsWith(site.contact.whatsappHref + "?text=")).toBe(true);
    const text = decodeURIComponent(href.split("?text=")[1]!);
    expect(text).toBe("Hello — I am interested in PAF0001. https://gnk-web.vercel.app/properties/PAF0001");
  });

  it("still works with a reference and no address", () => {
    const text = decodeURIComponent(whatsappHref("PAF0001").split("?text=")[1]!);
    expect(text).toBe("Hello — I am interested in PAF0001.");
  });
});
