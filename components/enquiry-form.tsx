"use client";

import { useEffect, useRef, useState } from "react";
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
  /* Prefilled, because the point of the reference is that the buyer never has
     to describe which property they mean. */
  const waHref = reference
    ? `${site.contact.whatsappHref}?text=${encodeURIComponent(`Hello — I am interested in ${reference}.`)}`
    : site.contact.whatsappHref;

  const [state, setState] = useState<"idle" | "sending" | "sent">("idle");
  const [error, setError] = useState<string | null>(null);
  const sentRef = useRef<HTMLDivElement | null>(null);

  /* Submitting blurs the button the browser was focused on, and the form it
     belonged to is then replaced outright — so without this a screen-reader
     user is left on a page that silently changed under them and hears nothing
     at all. role="status" announces it; the focus move gives them somewhere to
     be. */
  useEffect(() => {
    if (state === "sent") sentRef.current?.focus();
  }, [state]);

  async function onSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setError(null);
    const form = new FormData(e.currentTarget);
    /* The route refuses this with a 400, which the visitor currently discovers
       only after pressing Send and waiting. The server keeps its check — this
       one is about not wasting their time. */
    const hasEmail = String(form.get("email") ?? "").trim() !== "";
    const hasPhone = String(form.get("phone") ?? "").trim() !== "";
    if (!hasEmail && !hasPhone) {
      setError("Please leave an email address or a phone number so we can reply.");
      return;
    }
    setState("sending");
    /* EVERY exit from here must leave the button usable again. Without the
       try/catch a dropped connection rejected the promise, the state stayed
       "sending" forever, and the visitor watched a disabled "Sending…" that
       would never resolve — told the opposite of the truth while the enquiry
       was lost. The timeout matters for the same reason: a CRM that accepts
       the connection and stalls would otherwise hang until the platform kills
       the function. */
    try {
      const res = await fetch("/api/enquiry", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        signal: AbortSignal.timeout(15000),
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
    } catch {
      setError("That did not send. Please call or WhatsApp us instead.");
      setState("idle");
    }
  }

  if (state === "sent") {
    return (
      <div
        ref={sentRef}
        role="status"
        aria-live="polite"
        tabIndex={-1}
        className="border border-accent bg-accent-soft p-6"
      >
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
    "h-11 w-full border border-line bg-surface px-3 text-sm text-ink placeholder:text-ink-3 focus:border-accent";

  return (
        /* action and method are the no-JavaScript path, and they are not
       decoration: a form without them falls back to GET against the current
       document, which would put the visitor's name, email, phone and message
       into the URL, their browser history and the platform's request logs, and
       lose the enquiry. The route accepts this encoding and answers with a
       plain page. */
    <form
      action="/api/enquiry"
      method="post"
      onSubmit={onSubmit}
      className="border border-line bg-surface p-6"
    >
      {reference ? <input type="hidden" name="property_reference" value={reference} /> : null}
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
            className="w-full border border-line bg-surface p-3 text-sm text-ink placeholder:text-ink-3 focus:border-accent"
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

      {/* These were plain text. On the device most people read this on, an
          un-linked phone number is a number nobody rings. */}
      <p className="mt-3 text-xs text-ink-3">
        Or call{" "}
        <a href={site.contact.phoneHref} className="text-accent underline">
          {site.contact.phone}
        </a>{" "}
        or message us on{" "}
        <a
          href={waHref}
          className="text-accent underline"
          rel="noopener noreferrer"
          target="_blank"
        >
          WhatsApp
        </a>{" "}
        — you will speak to one of us, not a call centre.
      </p>
    </form>
  );
}
