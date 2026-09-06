# gnk-web

The public website for GN Kalaitsidis Capital.

Intended to replace the holding page currently served at
**www.kalaitsidis.com**. Deployed meanwhile at `gnk-web.vercel.app`.

## It holds one secret, and that secret grants nothing

The site is a CLIENT of the CRM's public API and nothing else:

| | |
|---|---|
| Listings | `GET  {CRM_API_URL}/api/public/listings?org={CRM_ORG_SLUG}` |
| Enquiries | `POST {CRM_API_URL}/api/public/enquiries` |

Both are unauthenticated, rate-limited and RLS-bound on the CRM side
(migrations 0066, 0073, 0084). **This repo must never contain a Supabase key,
a service-role key, or any database credential.** If this site is ever
compromised, the blast radius is "read published listings and submit an
enquiry" — which is what any visitor can already do. That property is
deliberate; do not trade it away for convenience.

The one secret is `CRM_FORWARD_KEY` (since 2026-09-06). It proves to the CRM
that an enquiry came through this site, so the CRM meters the visitor we
forward rather than metering the whole site as one address. It opens no door
and reads nothing: an attacker holding it gains a per-visitor enquiry budget
of five where a stranger gets a shared one. It lives in the Vercel
environment of both projects and nowhere in either repo; `lib/env.test.ts`
allows exactly that one secret-shaped name and fails on any other.

## Configuration

Four environment variables, all optional, each read in exactly one file
beside its production default:

| | read at | default |
|---|---|---|
| `CRM_API_URL` | `lib/crm.ts` | `https://gnk-crm.vercel.app` |
| `CRM_FORWARD_KEY` | `lib/crm.ts` | `` |
| `CRM_ORG_SLUG` | `lib/crm.ts` | `gnk` |
| `SITE_URL` | `lib/site-url.ts` | `https://gnk-web.vercel.app` |

`CRM_FORWARD_KEY` unset is not broken, it is weaker: the CRM then meters
this site's egress address as one visitor, and the sixth enquiry in any
quarter of an hour — from anyone — is refused. Set it to the same value as
the CRM's `ENQUIRY_FORWARD_KEY`.

`SITE_URL` is the domain cut-over. The day www.kalaitsidis.com points here,
set it to `https://www.kalaitsidis.com` and every canonical, og:url, sitemap
entry and JSON-LD `url` follows; nothing else in this repo names the host.

This table is not a copy of the code. `lib/env.test.ts` parses it and fails
if the site reads any `process.env` name it does not list, reads one from a
different file, or ships a different default — so a new variable means
editing this table, and a `SUPABASE_*` read anywhere fails CI, which is what
keeps the section above true. (It used to say "the only configuration is
CRM_API_URL" while the code read three.)

## Where the content comes from

Listings are **not** in this repo. They are entered in the CRM and reach the
site through the feed, so the desk publishes a property without a deploy.
Only the chrome — the marketing copy, the layout, the pages that are not
listings — lives here.

## Related

- CRM: `KALAITSIDIS/gnk-crm` — the feed and the enquiry door
- Previous site: `KALAITSIDIS/kalaitsidis-website` — static HTML, kept for its
  brand assets and as the record of what the domain served before
