# Sentry for gnk-web — server-side error reporting

**Date:** 2026-09-18
**Status:** approved, implementing
**Repo:** gnk-web (public marketing site)

## Why

A Sentry review on 2026-09-18 found the org holds exactly one project,
`javascript-nextjs`, which is the CRM. gnk-web — the site that takes enquiries
from real visitors — reports nothing. A 500 on the listing page, a CRM feed
outage, a refused enquiry: all invisible.

> Later the same day the CRM's project was renamed from `javascript-nextjs` to
> `gnk-crm`. Both mentions of the old slug in this document are left as they
> were written — this is a record of what was found, not a live reference — but
> anyone looking for that project today wants `gnk-crm`.

The CRM caught its own 400-after-a-saved-lead regression (2026-09-15) only
because something was watching. The public site has no such thing.

## The two findings that shaped this

### 1. Almost nothing here throws

Every failure path in this codebase is caught and degraded on purpose. Thirteen
`console.error`/`console.warn` sites, each marked as a failure that must not
pass silently:

| Site | Meaning |
| --- | --- |
| `app/api/enquiry/route.ts:249` | an enquiry was refused — a lost client |
| `lib/crm.ts:163` | feed moved twice; union served |
| `lib/crm.ts:191,196,216,219` | feed bad status / bad shape / partial book / unreachable |
| `lib/crm.ts:251,256,261` | listing lookup bad status / bad shape / failed |
| `lib/crm.ts:372,389,395` | enquiry answer lost (retried) / refused / failed |
| `lib/revalidate.ts:37` | revalidate failed |

A stock Sentry install captures *unhandled* exceptions, so on this codebase it
would capture essentially nothing. Installing the SDK and stopping there would
add a dependency and leave the site exactly as blind. **Reporting those thirteen
deliberately-swallowed failures is the work.**

`route.ts:249` already says so in its own comment: "without this line the firm
has no way of learning an enquiry was turned away." Today that line reaches
Vercel logs nobody reads.

### 2. The privacy notice forbids the browser half

`app/legal/page.tsx` states, and `app/legal/page.test.ts` asserts:

> This site sets no cookies. It runs no analytics, no advertising pixels and no
> third-party trackers, which is why you have not been asked to accept
> anything. Your visit is not profiled.

and its source comment adds: "If analytics are ever added, this page and that
claim change."

The CRM's browser config samples 10% of sessions for tracing. On a public
marketing site that is very hard to square with "your visit is not profiled".

**Decision: server-side only. No browser SDK.** Nothing runs in a visitor's
browser, so every sentence above stays literally true and `page.test.ts` is
untouched. This also sidesteps the consent and cookie-banner question entirely.

A third constraint pointed the same way: `ci.yml` says "Deliberately NO env and
NO secrets... this site holds no secrets by design." Source-map upload would
need `SENTRY_AUTH_TOKEN` at build time. We skip it — see Secrets below.

## Design

### Sentry project

A new project, `gnk-web`, in `gn-kalaitsidis-capital-ltd` (EU region,
`de.sentry.io` — the same jurisdiction as the legal page's "hosted in the
European Union"). Not shared with the CRM's `javascript-nextjs`:

- alerting appetite differs — this project notifies on every new issue, and the
  CRM's stream carries preview CSP warnings that would swamp it;
- "which app broke" should be answerable from the issue, not from a tag.

One alert rule: first-seen issue, plus regression, to the account email.

Creating the project also creates Sentry's own default rule, "Send a
notification for high priority issues", which filters through Sentry's priority
heuristic and is not the same thing. The MCP tooling can read alert rules but
not write them, so switching that rule to "a new issue is created" is an
operator action in the Sentry UI, recorded here so it is not quietly forgotten.

### Files

New:

- `instrumentation.ts` (root) — `register()` gated on `SENTRY_DSN`, a complete
  no-op without it (dev, CI, any deploy that has not set it).
  `onRequestError = Sentry.captureRequestError`. `tracesSampleRate: 0`,
  `sendDefaultPii: false`.
- `lib/report.ts` — the one definition of "a failure that must not pass
  silently".
- `lib/scrub-event.ts` — header redaction; a sibling of the CRM's
  `lib/services/scrub-event.ts`, but for what *this* site receives.

Touched, mechanically — the thirteen sites become `report(...)` calls:

- `lib/crm.ts` (12), `app/api/enquiry/route.ts` (1), `lib/revalidate.ts` (1)
- `package.json` — `@sentry/nextjs` at the version the CRM runs

Not touched: `next.config.ts`, `.github/workflows/ci.yml`, `app/legal/page.tsx`.

### The reporting contract

`report()` keeps the console line byte-identical and additionally sends to
Sentry:

```ts
report({
  event: "crm.feed.bad-status",                                   // stable title
  level: "error",
  log: [`[crm] feed responded ${res.status} at offset ${offset}`], // verbatim
  extra: { status: res.status, offset },
});
```

Two properties matter:

- **`event` is the fingerprint.** The varying parts stay out of the title, or
  every offset would open its own Sentry issue. They go in `extra`.
- **The console string is unchanged**, so the thirteen existing tests that
  assert on it stay green untouched. That is the evidence the change is
  behaviour-preserving, rather than a claim that it is.

When a real error object exists it goes through `captureException` so the stack
survives, with the fingerprint forced to `event` so one failure mode is one
issue regardless of the underlying network error. Otherwise `captureMessage`.

Thirteen stable names: `enquiry.refused`, `crm.enquiry.{refused,failed,retried}`,
`crm.feed.{unreachable,bad-status,bad-shape,too-many-pages,unstable}`,
`crm.listing.{bad-status,bad-shape,failed}`, `revalidate.failed`.

### What gets scrubbed

`beforeSend` redacts, from the incoming request headers:

- `x-forwarded-for`, `x-real-ip`, `x-vercel-forwarded-for` — the visitor's raw
  address. `/legal` says "We never store the address itself"; an unscrubbed
  event on the enquiry route would make that sentence false.
- `x-gnk-revalidate-key` — `SITE_REVALIDATE_KEY`, which the CRM presents to
  `/api/revalidate`.
- `cookie`, `authorization` — belt and braces; `sendDefaultPii: false` already
  strips what the SDK knows about.

Redacted rather than deleted, following the CRM's reasoning: an event showing a
header was present but unreadable tells the person debugging what they need
without telling them the value.

### Secrets

One new environment variable, `SENTRY_DSN`, server-side, set in Vercel. A DSN is
a write-only ingest address: it accepts events and reads nothing.

**Production target only** — decided when setting it, against this document's
first draft of "Production and Preview". The alert rule notifies on every new
issue, so a preview deploy being poked at by hand would email the operator about
its own experiments; that is the noise this project was split from the CRM's to
avoid. It also matches how `CRM_FORWARD_KEY` and `SITE_REVALIDATE_KEY` are
already scoped here. On a preview, `report()` is a console wrapper, exactly as
in dev and CI.

**No `SENTRY_AUTH_TOKEN`, no `withSentryConfig`, no source-map upload.** The CI
build step keeps running with no credential and its comment stays true. The cost
is stated plainly: some server stack frames will arrive minified from the
Turbopack build. Revisit only if a real trace proves unreadable.

Vercel binds env at build time, so after setting `SENTRY_DSN` a redeploy is
required or nothing changes.

### Testing

- `lib/scrub-event.test.ts` — each sensitive header redacted, others untouched,
  the no-headers case.
- `lib/report.test.ts` — console output identical to today's; no throw when
  Sentry was never initialised.
- `lib/sentry-not-in-client.test.ts` — walks value-imports from every
  `"use client"` file and asserts `@sentry/nextjs` is unreachable. This is what
  keeps the privacy position true as the code grows. Today it holds only because
  the client components import `Listing` as a *type*, which the compiler erases;
  that is luck, and this makes it a rule. Same idiom as `lib/headers.test.ts`.
- The thirteen existing console assertions stay green, unmodified.

### Verification

Local `typecheck`, `lint`, `test`, `build`; branch; PR; CI green; set the DSN in
Vercel; redeploy; then send one event to confirm the DSN, the alert rule and the
email all actually fire.

## Explicitly not done

The legal text is not edited. Every sentence stays literally true under this
design. Naming Sentry as a technical-error processor would be defensible and is
a legal judgment for the operator, not a change to make silently.
