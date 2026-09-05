import type { Metadata } from "next";
import { pageMeta } from "@/lib/site-url";
import { EnquiryForm } from "@/components/enquiry-form";
import { site } from "@/lib/site";

export const metadata: Metadata = {
  ...pageMeta("/contact"),
  title: "Contact",
  description:
    "Talk to GN Kalaitsidis Capital in Paphos, Cyprus. Two named advisers, direct — by phone, WhatsApp or email.",
};

/**
 * Every credible firm in the research shows a street address and a real phone
 * number; Ask Wire shows neither and it is the one thing in that otherwise
 * excellent site not to copy. For a firm whose proposition is access to
 * judgement, a named human with a mobile beats a form — so the form is here,
 * but it is not first.
 */
export default function ContactPage() {
  return (
    <div className="mx-auto max-w-7xl px-5 py-14 sm:px-8">
      <p className="eyebrow">Contact</p>
      <h1 className="mt-2 text-4xl">You will speak to one of us.</h1>
      <p className="mt-4 max-w-2xl text-lg text-ink-2">
        There is no call centre and no junior to be passed to. Call, message, or write —
        whichever suits.
      </p>

      <div className="mt-12 grid gap-12 lg:grid-cols-[1fr_1.1fr] lg:items-start">
        <div>
          <dl className="border-t border-line">
            <div className="flex justify-between gap-6 border-b border-line py-4">
              <dt className="text-sm text-ink-3">Phone</dt>
              <dd>
                <a href={site.contact.phoneHref} className="font-display text-xl text-accent hover:underline">
                  {site.contact.phone}
                </a>
              </dd>
            </div>
            <div className="flex justify-between gap-6 border-b border-line py-4">
              <dt className="text-sm text-ink-3">WhatsApp</dt>
              <dd>
                <a
                  href={site.contact.whatsappHref}
                  rel="noopener noreferrer"
                  target="_blank"
                  className="text-accent hover:underline"
                >
                  Message us
                </a>
              </dd>
            </div>
            <div className="flex justify-between gap-6 border-b border-line py-4">
              <dt className="text-sm text-ink-3">Email</dt>
              <dd>
                <a href={`mailto:${site.contact.email}`} className="text-accent hover:underline">
                  {site.contact.email}
                </a>
              </dd>
            </div>
            <div className="flex justify-between gap-6 border-b border-line py-4">
              <dt className="text-sm text-ink-3">Office</dt>
              <dd className="text-right text-ink-2">
                {site.contact.street ? (
                  <>
                    {site.contact.street}
                    <br />
                  </>
                ) : null}
                {site.contact.city}
              </dd>
            </div>
            <div className="flex justify-between gap-6 border-b border-line py-4">
              <dt className="text-sm text-ink-3">Hours</dt>
              <dd className="text-right text-ink-2">{site.contact.hours}</dd>
            </div>
          </dl>

          {!site.contact.street ? (
            <p className="mt-4 text-xs text-ink-3">
              {/* TODO: street address, once confirmed — every credible firm in this
                  market publishes one, and its absence is noticed. */}
              Full office address to follow.
            </p>
          ) : null}
        </div>

        <EnquiryForm
          heading="Send us a message"
          intro="Tell us what you are trying to do. If we are not the right people for it, we will say so and point you at who is."
          cta="Send message"
        />
      </div>
    </div>
  );
}
