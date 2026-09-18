/**
 * What must never leave this site in an error report.
 *
 * `instrumentation.ts` wires Next's `onRequestError` straight to Sentry, and an
 * error event carries the request's headers. Three kinds of ours must not
 * travel:
 *
 *   x-forwarded-for        the visitor's RAW address, set by Vercel on every
 *   x-real-ip              request and read by the enquiry route to meter the
 *   x-vercel-forwarded-for sender. `/legal` tells that visitor "We never store
 *                          the address itself — only a scrambled, one-way
 *                          fingerprint of it". An unscrubbed event on that
 *                          route would put the address itself in a third
 *                          party's store, which is that promise being false.
 *   x-gnk-revalidate-key   SITE_REVALIDATE_KEY, which the CRM presents to
 *                          /api/revalidate to prove it is the CRM. It grants
 *                          only a cache purge, but a secret in someone else's
 *                          log is a secret you no longer control.
 *   cookie, authorization  belt and braces. `sendDefaultPii` is off, which
 *                          strips what the SDK knows about; these are listed so
 *                          the guarantee does not depend on a default staying
 *                          put.
 *
 * Redacted rather than deleted: an event that shows the header was PRESENT and
 * unreadable tells the person debugging what they need (was the CRM the
 * caller?) without telling them the value.
 *
 * Pure, and tested, because the alternative is finding out from a Sentry event
 * that it did not work.
 *
 * The CRM keeps the mirror image of this file at lib/services/scrub-event.ts —
 * it scrubs what this site SENDS (x-gnk-visitor-ip, x-gnk-forward-key); this
 * one scrubs what this site RECEIVES. Neither is the other's copy.
 */
export const REDACTED = "[redacted]";

/** Header names, lower-case, that are redacted from every outbound event. */
export const SENSITIVE_HEADERS = [
  "x-forwarded-for",
  "x-real-ip",
  "x-vercel-forwarded-for",
  "x-gnk-revalidate-key",
  "cookie",
  "authorization",
] as const;

interface EventLike {
  request?: { headers?: Record<string, string> } | undefined;
}

export function scrubSensitiveHeaders<T extends EventLike>(event: T): T {
  const headers = event.request?.headers;
  if (!headers) return event;
  for (const name of Object.keys(headers)) {
    if ((SENSITIVE_HEADERS as readonly string[]).includes(name.toLowerCase())) {
      headers[name] = REDACTED;
    }
  }
  return event;
}
