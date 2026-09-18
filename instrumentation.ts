import * as Sentry from "@sentry/nextjs";
import { sentryDsn } from "@/lib/report";
import { scrubSensitiveHeaders } from "@/lib/scrub-event";

/**
 * Server and edge Sentry init — the whole of this site's error reporting.
 *
 * THERE IS NO BROWSER HALF, ON PURPOSE. `/legal` says "This site sets no
 * cookies. It runs no analytics, no advertising pixels and no third-party
 * trackers... Your visit is not profiled", and app/legal/page.test.ts holds
 * that page to it. A browser SDK would put a third party's code in every
 * visitor's page and make the sentence arguable at best; tracing would sample
 * their navigation timing and make it false. Nothing here reaches a visitor's
 * browser, so the page needs no change and no cookie banner follows.
 * lib/sentry-not-in-client.test.ts keeps it that way as the code grows.
 *
 * Strictly env-gated: with no DSN — dev, CI, or a deploy that has not set it —
 * this is a complete no-op, so nothing can throw at startup and `report()`
 * degrades to a console wrapper. Set SENTRY_DSN in the Vercel project to
 * activate; Vercel binds env at BUILD time, so it takes a redeploy.
 *
 * No `withSentryConfig` in next.config.ts and so no source-map upload, because
 * that needs SENTRY_AUTH_TOKEN at build time and .github/workflows/ci.yml says
 * "Deliberately NO env and NO secrets... this site holds no secrets by design".
 * The cost is real and accepted: some server frames arrive minified.
 */
export async function register() {
  // The same condition report() gates on, read from the same function: if this
  // init is skipped, nothing may still try to send.
  const dsn = sentryDsn();
  if (!dsn) return;
  Sentry.init({
    dsn,
    environment: process.env.VERCEL_ENV ?? "production",
    /* Off, not sampled. A span per request is what "your visit is not profiled"
       is about; this site reports failures and measures nothing. */
    tracesSampleRate: 0,
    /* Off by default, named anyway: it is what stops the SDK attaching the
       address it infers for the visitor. The header carrying the same address
       is scrubbed below — both halves, or neither is worth anything. */
    sendDefaultPii: false,
    beforeSend: (event) => scrubSensitiveHeaders(event),
  });
}

// Next's server-error hook (App Router). A no-op until register() ran with a DSN.
export const onRequestError = Sentry.captureRequestError;
