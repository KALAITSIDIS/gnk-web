# gnk-web

The public website for GN Kalaitsidis Capital.

Intended to replace the holding page currently served at
**www.kalaitsidis.com**. Deployed meanwhile at `gnk-web.vercel.app`.

## It holds no credentials

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

## Configuration

Three environment variables, all optional, each read in exactly one file
beside its production default:

| | read at | default |
|---|---|---|
| `CRM_API_URL` | `lib/crm.ts` | `https://gnk-crm.vercel.app` |
| `CRM_ORG_SLUG` | `lib/crm.ts` | `gnk` |
| `SITE_URL` | `lib/site-url.ts` | `https://gnk-web.vercel.app` |

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
