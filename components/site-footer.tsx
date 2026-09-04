import Link from "next/link";
import { nav, site } from "@/lib/site";

export function SiteFooter() {
  const { registrationNo, licenceNo } = site.registration;
  const registered = registrationNo && licenceNo;

  return (
    <footer className="mt-24 border-t border-line bg-surface">
      <div className="mx-auto grid max-w-7xl gap-10 px-5 py-14 sm:px-8 md:grid-cols-3">
        <div>
          <p className="font-display text-lg font-semibold text-ink">{site.name}</p>
          <p className="mt-2 max-w-xs text-sm text-ink-2">{site.positioning}</p>
        </div>

        <div>
          <p className="eyebrow">Contact</p>
          <ul className="mt-3 space-y-1.5 text-sm text-ink-2">
            <li>
              <a href={site.contact.phoneHref} className="hover:text-accent">
                {site.contact.phone}
              </a>
            </li>
            <li>
              <a href={`mailto:${site.contact.email}`} className="hover:text-accent">
                {site.contact.email}
              </a>
            </li>
            <li>
              <a
                href={site.contact.whatsappHref}
                className="hover:text-accent"
                rel="noopener noreferrer"
                target="_blank"
              >
                WhatsApp
              </a>
            </li>
            <li className="pt-1 text-ink-3">
              {site.contact.street ? `${site.contact.street}, ` : ""}
              {site.contact.city}
            </li>
            <li className="text-ink-3">{site.contact.hours}</li>
          </ul>
        </div>

        <div>
          <p className="eyebrow">Pages</p>
          <ul className="mt-3 space-y-1.5 text-sm text-ink-2">
            {nav.map((item) => (
              <li key={item.href}>
                <Link href={item.href} className="hover:text-accent">
                  {item.label}
                </Link>
              </li>
            ))}
            <li>
              <Link href="/legal" className="hover:text-accent">
                Privacy &amp; legal
              </Link>
            </li>
          </ul>
        </div>
      </div>

      <div className="border-t border-line">
        <div className="mx-auto flex max-w-7xl flex-col gap-2 px-5 py-5 text-xs text-ink-3 sm:flex-row sm:items-center sm:justify-between sm:px-8">
          <p>
            © {new Date().getFullYear()} {site.name}
          </p>
          {/*
            The regulated line, and only when it is true. Cyprus law 71(I)/2010
            requires a registered agent to state the phrase with both numbers in
            every advertisement — so it appears the moment the numbers exist in
            lib/site.ts, and until then the site claims nothing it cannot back.
          */}
          {registered ? (
            <p>
              Registered and licensed real estate agent — Reg. No. {registrationNo}, License No.{" "}
              {licenceNo}
            </p>
          ) : null}
        </div>
      </div>
    </footer>
  );
}
