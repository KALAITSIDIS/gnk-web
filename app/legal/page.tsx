import type { Metadata } from "next";
import { pageMeta } from "@/lib/site-url";
import { site } from "@/lib/site";

export const metadata: Metadata = {
  ...pageMeta("/legal"),
  title: "Privacy & legal",
  description: "How GN Kalaitsidis Capital handles your data, and the terms this site is offered on.",
};

/**
 * A launch requirement, not a nice-to-have: the enquiry form collects a name,
 * an email and a phone number — and, since the seller intake shipped, answers
 * about a property somebody owns — and Cyprus is an EU member state, so GDPR
 * applies at the point of collection.
 *
 * Written to be true of what this site ACTUALLY does — no cookies, no
 * analytics, no third-party trackers — which is why there is no cookie banner
 * anywhere. If analytics are ever added, this page and that claim change
 * together.
 *
 * TODO: have a Cyprus lawyer review before the domain cutover. The accuracy
 * disclaimer in particular is deliberately narrow — this firm sells standing
 * behind its numbers, so it must not borrow the portals' blanket "no warranty
 * as to accuracy" language.
 */
export default function LegalPage() {
  const updated = "September 2026";

  return (
    <div className="mx-auto max-w-3xl px-5 py-14 sm:px-8">
      <p className="eyebrow">Legal</p>
      <h1 className="mt-2 text-4xl">Privacy &amp; legal</h1>
      <p className="mt-3 text-sm text-ink-3">Last updated {updated}</p>

      <section className="mt-12">
        <h2 className="text-2xl">Who we are</h2>
        <p className="mt-3 text-ink-2">
          {site.name}, {site.contact.city}. For anything on this page, write to{" "}
          <a href={`mailto:${site.contact.email}`} className="text-accent hover:underline">
            {site.contact.email}
          </a>{" "}
          or call {site.contact.phone}.
        </p>
      </section>

      <section className="mt-10">
        <h2 className="text-2xl">What we collect, and why</h2>
        <p className="mt-3 text-ink-2">
          What you type into an enquiry form: your name, an email address or a phone number
          so we can reply, and whatever you choose to tell us — what you are looking for, or,
          if you are selling, about the property itself.
        </p>
        {/* The word "Only" used to stand at the head of that sentence and it was not true.
            Sending an enquiry also passes the address it came from to our own system, where
            it is salted and hashed into a short-lived counter. A visitor can already SEE
            that metering — refuse too many and the form answers "Too many enquiries from
            this address" — so the notice has to account for it. If the rate limiting ever
            changes, this paragraph changes with it.

            2026-09-06: "It identifies nobody" went. The fingerprint was salted with the
            CRM's public project URL, so anyone holding a fingerprint could sweep IPv4 and
            name the address in minutes — the sentence was true only of people who could
            not be bothered. The salt is now a secret held by our own system (gnk-crm
            lib/services/ip-hash.ts, IP_HASH_SALT), which is what the paragraph now says,
            and it claims no more than that. */}
        <p className="mt-3 text-ink-2">
          Sending the form also tells us the internet address it came from. We never store
          the address itself — only a scrambled, one-way fingerprint of it, made with a key
          that nobody outside our own system holds and kept briefly so that one person
          cannot flood the form and block everyone else&apos;s enquiries. It is not used for
          anything else.
        </p>
        <p className="mt-3 text-ink-2">
          {/* The off-list brief on /properties repeats these three promises verbatim.
              Neither wording may be narrowed without the other, and neither may be
              broadened into an absolute — an earlier version on /properties said "nobody
              else gets your details", which the Resend leg described below made false. */}
          We use it for one thing — to answer your enquiry and to advise you if you engage
          us. We do not sell it, we do not share it with developers or portals, and we do not
          add you to a mailing list.
        </p>
        <p className="mt-3 text-ink-2">
          The lawful basis is your consent, which you give with the checkbox on the form, and
          our legitimate interest in responding to someone who has contacted us.
        </p>
      </section>

      <section className="mt-10">
        <h2 className="text-2xl">Cookies and tracking</h2>
        <p className="mt-3 text-ink-2">
          This site sets no cookies. It runs no analytics, no advertising pixels and no
          third-party trackers, which is why you have not been asked to accept anything. Your
          visit is not profiled.
        </p>
      </section>

      <section className="mt-10">
        <h2 className="text-2xl">Where your enquiry goes</h2>
        <p className="mt-3 text-ink-2">
          Into our own client system, hosted in the European Union, where it is visible only
          to the two of us. We are also sent an email the moment it arrives, so that one of
          us replies quickly rather than whenever we next look; that notification contains
          what you wrote and is delivered by Resend, our email provider. Property
          photographs and listing information on this site are served from the same client
          system.
        </p>
      </section>

      <section className="mt-10">
        <h2 className="text-2xl">How long we keep it</h2>
        <p className="mt-3 text-ink-2">
          If your enquiry does not lead to us working together, we delete it within two
          years. If it does, we keep the file for as long as the law requires us to — anti
          money-laundering rules oblige us to retain client records for a period after a
          relationship ends.
        </p>
      </section>

      <section className="mt-10">
        <h2 className="text-2xl">Your rights</h2>
        <p className="mt-3 text-ink-2">
          You can ask us what we hold about you, ask us to correct it, or ask us to delete
          it, and we will do so unless the law requires us to keep it. Write to{" "}
          <a href={`mailto:${site.contact.email}`} className="text-accent hover:underline">
            {site.contact.email}
          </a>
          . If you are not satisfied, you may complain to the Office of the Commissioner for
          Personal Data Protection in Cyprus.
        </p>
      </section>

      <section className="mt-10">
        <h2 className="text-2xl">About the property information here</h2>
        <p className="mt-3 text-ink-2">
          Property details are supplied by owners and developers and checked by us so far as
          we reasonably can. Measurements, permits and title positions should be verified by
          your lawyer and surveyor before you commit to a purchase — and if you engage us,
          verifying them is part of what we do.
        </p>
        <p className="mt-3 text-ink-2">
          Availability and price change. Nothing on this site is an offer capable of
          acceptance, and any view we express on value is an opinion given on the information
          available at the time.
        </p>
      </section>

      <section className="mt-10 border-t border-line pt-8">
        <p className="text-sm text-ink-3">
          This page will be reviewed by a Cyprus lawyer before this site moves to its final
          domain.
        </p>
      </section>
    </div>
  );
}
