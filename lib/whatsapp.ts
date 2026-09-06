import { site } from "@/lib/site";

/**
 * The WhatsApp link, prefilled so a buyer never has to describe which
 * property they mean — the reference AND the page's address, so the firm
 * can open the listing from the message in one tap. Two components render
 * it (the enquiry form and the mobile contact bar); this is the one place
 * the text is composed, so they cannot drift.
 */
export function whatsappHref(reference?: string | null, listingUrl?: string | null): string {
  if (!reference) return site.contact.whatsappHref;
  const text = `Hello — I am interested in ${reference}.` + (listingUrl ? ` ${listingUrl}` : "");
  return `${site.contact.whatsappHref}?text=${encodeURIComponent(text)}`;
}
