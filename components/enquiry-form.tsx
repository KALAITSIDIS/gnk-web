"use client";

import { useState } from "react";
import Link from "next/link";
import { site } from "@/lib/site";

/**
 * One form, used on the property page, the valuation page and contact.
 *
 * `reference` pre-fills what the enquiry is about, so a buyer looking at
 * PAF0001 never has to describe which property they mean — and the lead
 * arrives in the CRM already attached to it.
 */
export function EnquiryForm({
  reference,
  heading = "Ask about this property",
  intro,
  cta = "Send enquiry",
}: {
  reference?: string;
  heading?: string;
  intro?: string;
  cta?: string;
}) {
  const [state, setState] = useState<"idle" | "sending" | "sent">("idle");
  const [error, setError] = useState<string | null>(null);

  async function onSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setError(null);
    setState("sending");
    const form = new FormData(e.currentTarget);
    const res = await fetch("/api/enquiry", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        name: form.get("name"),
        email: form.get("email"),
        phone: form.get("phone"),
        message: form.get("message"),
        property_reference: reference,
        consent: form.get("consent") === "on",
        website: form.get("website"),
      }),
    });
    if (res.ok) {
      setState("sent");
      return;
    }
    const body = (await res.json().catch(() => ({}))) as { error?: string };
    setError(body.error ?? "That did not send. Please call or WhatsApp us instead.");
    setState("idle");
  }

  if (state === "sent") {
    return (
      <div className="border border-accent bg-accent-soft p-6">
        <p className="font-display text-xl text-ink">Thank you — that has reached us.</p>
        <p className="mt-2 text-sm text-ink-2">
          One of us will reply personally. If it is urgent, call{" "}
          <a href={site.contact.phoneHref} className="text-accent underline">
            {site.contact.phone}
          </a>{" "}
          or message us on{" "}
          <a href={site.contact.whatsappHref} className="text-accent underline" rel="noopener noreferrer" target="_blank">
            WhatsApp
          </a>
          .
        </p>
      </div>
    );
  }

  const field =
    "h-11 w-full border border-line bg-surface px-3 text-sm text-ink placeholder:text-ink-3 focus:border-accent focus:outline-none";

  return (
    <form onSubmit={onSubmit} className="border border-line bg-surface p-6">
      <h2 className="font-display text-xl text-ink">{heading}</h2>
      {intro ? <p className="mt-2 text-sm text-ink-2">{intro}</p> : null}
      {reference ? (
        <p className="eyebrow mt-2">Regarding {reference}</p>
      ) : null}

      <div className="mt-5 grid gap-3 sm:grid-cols-2">
        <label className="sm:col-span-2">
          <span className="mb-1 block text-sm text-ink-2">Your name</span>
          <input name="name" required maxLength={200} className={field} autoComplete="name" />
        </label>
        <label>
          <span className="mb-1 block text-sm text-ink-2">Email</span>
          <input name="email" type="email" maxLength={320} className={field} autoComplete="email" />
        </label>
        <label>
          <span className="mb-1 block text-sm text-ink-2">Phone</span>
          <input name="phone" maxLength={40} className={field} autoComplete="tel" />
        </label>
        <label className="sm:col-span-2">
          <span className="mb-1 block text-sm text-ink-2">
            What can we help with?
          </span>
          <textarea
            name="message"
            rows={4}
            maxLength={5000}
            className="w-full border border-line bg-surface p-3 text-sm text-ink placeholder:text-ink-3 focus:border-accent focus:outline-none"
          />
        </label>
      </div>

      {/* Never shown, never focusable, never announced — a bot fills every
          input it finds, a person never sees this one. */}
      <div aria-hidden="true" className="absolute -left-[9999px] h-0 w-0 overflow-hidden">
        <label>
          Website
          <input name="website" tabIndex={-1} autoComplete="off" />
        </label>
      </div>

      <label className="mt-4 flex gap-3 text-sm text-ink-2">
        <input type="checkbox" name="consent" required className="mt-1 accent-accent" />
        <span>
          I am happy for {site.shortName} to hold these details and contact me about this
          enquiry. See our{" "}
          <Link href="/legal" className="text-accent underline">
            privacy notice
          </Link>
          .
        </span>
      </label>

      {error ? (
        <p role="alert" className="mt-4 border-l-2 border-red-700 pl-3 text-sm text-red-800">
          {error}
        </p>
      ) : null}

      <button
        type="submit"
        disabled={state === "sending"}
        className="mt-5 bg-accent px-6 py-3 text-sm font-medium text-white transition-colors hover:bg-accent-hover disabled:opacity-60"
      >
        {state === "sending" ? "Sending…" : cta}
      </button>

      <p className="mt-3 text-xs text-ink-3">
        Or call {site.contact.phone} — you will speak to one of us, not a call centre.
      </p>
    </form>
  );
}
