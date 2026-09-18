/**
 * A failure that must not pass silently — said once, in one place.
 *
 * WHY THIS EXISTS AT ALL. Almost nothing in this codebase throws. Every failure
 * path is caught and degraded on purpose: `getListings` returns `{ ok: false }`
 * and the page says "briefly unavailable", `submitEnquiry` returns an error
 * string and the visitor is asked to call. That is the right behaviour for a
 * shop window — and it means a Sentry install that only captures UNHANDLED
 * exceptions would capture nothing at all here. The thirteen places that log a
 * swallowed failure ARE the signal; this is how they reach somebody.
 *
 * THE CONSOLE LINE IS UNCHANGED. Every call passes `log` straight through to
 * the console call it replaced, argument for argument, so the Vercel log keeps
 * reading as it did and the existing tests that assert on that output still
 * pass without being touched. Those tests passing IS the evidence that adding
 * Sentry changed no behaviour.
 *
 * NEVER INTERPOLATE INTO `event`. It is both the Sentry title and the
 * fingerprint: `crm.feed.bad-status` must stay one issue whatever offset it
 * failed at. The varying parts belong in `extra`, where they are searchable and
 * cannot fragment the group.
 */

/**
 * Reporting is on when the platform has given us somewhere to report TO.
 *
 * The ONE definition of that condition — instrumentation.ts decides whether to
 * init from this same function, so "is Sentry on?" cannot come to mean two
 * different things in two files.
 */
export const sentryDsn = (): string | undefined => process.env.SENTRY_DSN;

export type ReportLevel = "error" | "warning";

export interface Report {
  /** Stable, dotted, hand-written. The Sentry title and the fingerprint. */
  event: string;
  /**
   * Also picks the console channel, so it is whatever the call it replaced
   * used: `warning` → console.warn, `error` → console.error. That is why
   * `crm.enquiry.retried` is an error despite being a recovery — the author of
   * that line chose console.error, and the log must keep reading as it did.
   */
  level: ReportLevel;
  /** Passed to console verbatim: the exact arguments the old call had. */
  log: unknown[];
  /** The caught value, when there is one, so the real stack survives. */
  cause?: unknown;
  /** The parts that vary between occurrences, kept out of the title. */
  extra?: Record<string, unknown>;
}

export function report({ event, level, log, cause, extra }: Report): void {
  // Read off `console` at call time, not captured at module load, so a test's
  // spy is the thing that gets called.
  if (level === "warning") console.warn(...log);
  else console.error(...log);

  // No DSN — dev, CI, a deploy that has not set it — and the console line above
  // is the whole of it. The SDK is not even loaded.
  if (!sentryDsn()) return;

  const context = { level, fingerprint: [event], extra };

  /* IMPORTED ON DEMAND, and measured before it was written this way. lib/crm.ts
     is reached by nearly every page and nearly every test, so a static
     `import * as Sentry` here loads the SDK into all of them: the suite went
     from 30s to 126s and timed a test out. On a server that has a DSN the
     module is ALREADY resident — instrumentation.ts imported it at startup to
     call init — so this resolves from the module cache in a single microtask,
     which runs before the route's own continuation. Nothing is lost to a
     serverless freeze that a static import would have kept. */
  void import("@sentry/nextjs")
    .then((Sentry) => {
      if (cause === undefined) {
        Sentry.captureMessage(event, context);
        return;
      }
      /* A named wrapper so the issue TITLE is the event name.
         "crm.feed.unreachable" says what broke; "TypeError: fetch failed" does
         not say WHICH fetch, and the title is all an alert email carries. The
         original travels as `cause`, which the SDK's linkedErrors integration
         follows, so the real stack is still on the event rather than lost to
         make the subject line readable. */
      Sentry.captureException(new Error(event, { cause }), context);
    })
    .catch(() => {
      /* Monitoring must never be the reason a request fails. The console line
         has already happened, and it is the fallback. */
    });
}
