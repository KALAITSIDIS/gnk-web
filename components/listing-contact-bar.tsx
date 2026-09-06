import { site } from "@/lib/site";

/**
 * A way to act, on the page where someone decides to.
 *
 * WHY IT EXISTS. The site header is not sticky, so on a listing page the only
 * contact affordances were the phone number in the header and the enquiry form
 * far below it — measured on the live PAF0001 page, a gap of some 27,000
 * characters of document covering the whole gallery, the description, the
 * features and the numbers table. On a phone that is most of the page, and it
 * is the page where a buyer is closest to acting.
 *
 * NO JAVASCRIPT. Two of the three are ordinary links, and "Enquire" is an
 * in-page anchor — so the bar works before hydration and without it, like every
 * other contact route on this site. The reference travels in the WhatsApp text
 * so a buyer never has to describe which property they mean.
 *
 * MOBILE ONLY (hidden from lg). Above that width the enquiry form is already
 * pinned beside the content with lg:sticky, so a second one would be clutter.
 *
 * STICKY, NOT FIXED, and rendered as a sibling AFTER the article inside
 * <main>. Its containing block ends where the listing ends, so it rides the
 * viewport bottom while the listing is on screen and scrolls away with it
 * before the footer. That is what keeps the footer's last line readable on a
 * phone — the copyright today, the Law 71(I)/2010 licence statement once
 * lib/site.ts has the numbers — without any other element knowing this bar's
 * height. (As position: fixed it needed a hand-copied bottom padding on the
 * article, which guarded the enquiry form and not the footer, and the footer's
 * last line was hidden on every phone.) listing-contact-bar.test.ts pins both.
 */
export function ListingContactBar({ reference }: { reference: string }) {
  const wa = `${site.contact.whatsappHref}?text=${encodeURIComponent(
    `Hello — I am interested in ${reference}.`,
  )}`;
  const cell =
    "flex flex-1 items-center justify-center gap-2 py-3.5 text-sm font-medium";

  return (
    <div
      className="sticky bottom-0 z-40 border-t border-line bg-surface lg:hidden"
      // clears the home indicator on a notched phone
      style={{ paddingBottom: "env(safe-area-inset-bottom)" }}
    >
      <div className="mx-auto flex max-w-2xl divide-x divide-line">
        <a href={site.contact.phoneHref} className={`${cell} text-ink`}>
          Call
        </a>
        <a
          href={wa}
          className={`${cell} text-ink`}
          rel="noopener noreferrer"
          target="_blank"
        >
          WhatsApp
        </a>
        <a href="#enquire" className={`${cell} bg-accent text-white`}>
          Enquire
        </a>
      </div>
    </div>
  );
}
