# gnk-web

The public website for GN Kalaitsidis Capital.

Intended to replace the holding page currently served at
**www.kalaitsidis.com**. Deployed meanwhile at `gnk-web.vercel.app`.

## It holds two secrets, and neither grants anything

The site is a CLIENT of the CRM's public API and nothing else:

| | |
|---|---|
| Listings | `GET  {CRM_API_URL}/api/public/listings?org={CRM_ORG_SLUG}` |
| Enquiries | `POST {CRM_API_URL}/api/public/enquiries` |

Both are unauthenticated and rate-limited on the CRM side, and each is bounded
differently — worth stating precisely, because "RLS-bound" stopped being true
of the second one. The **feed** is an anon-scoped `security definer` function
whose returned columns are an allowlist in SQL (migrations 0066, 0073, 0085,
0088): a column added to the CRM's tables is withheld until someone edits that
function. The **enquiry door** is a Next route holding the CRM's service-role
client, which bypasses RLS by design — since migration 0087 the database grants
those functions to nobody else, so the route's own controls (a per-visitor rate
counter, a honeypot, an email-format check) are what bound it, not RLS.
**This repo must never contain a Supabase key, a service-role key, or any
database credential.** If this site is ever
compromised, the blast radius is "read published listings and submit an
enquiry" — which is what any visitor can already do. That property is
deliberate; do not trade it away for convenience.

The first secret is `CRM_FORWARD_KEY` (since 2026-09-06). It proves to the
CRM that a request came through this site: on an enquiry the CRM then meters
the visitor we forward rather than the whole site as one address, and on a
feed read (since 2026-09-13) it meters the site on its own, larger budget
instead of the one a stranger gets. It opens no door and reads nothing: an
attacker holding it gains a per-visitor enquiry budget of five and a bigger
allowance of a public feed.

The second is `SITE_REVALIDATE_KEY` (since 2026-09-13). It proves to THIS
site that a knock on `/api/revalidate` came from the CRM, which knocks after
a write that changes a listing's public face; the site then rebuilds the home
page, the list and that listing on their next request instead of waiting for
its timers. A holder can make the site re-read a public feed a little sooner,
and nothing else.

Both live in the Vercel environment of both projects and nowhere in either
repo; `lib/env.test.ts` allows exactly those two secret-shaped names and
fails on any other.

## Configuration

Five environment variables, all optional, each read in exactly one file
beside its production default:

| | read at | default |
|---|---|---|
| `CRM_API_URL` | `lib/crm.ts` | `https://gnk-crm.vercel.app` |
| `CRM_FORWARD_KEY` | `lib/crm.ts` | `` |
| `CRM_ORG_SLUG` | `lib/crm.ts` | `gnk` |
| `SITE_REVALIDATE_KEY` | `lib/revalidate.ts` | `` |
| `SITE_URL` | `lib/site-url.ts` | `https://gnk-web.vercel.app` |

`CRM_FORWARD_KEY` unset is not broken, it is weaker: the CRM then meters
this site's egress address as one visitor, and the sixth enquiry in any
quarter of an hour — from anyone — is refused, and every feed read counts
against a stranger's budget of 120 per quarter hour. Set it to the same
value as the CRM's `ENQUIRY_FORWARD_KEY`.

`SITE_REVALIDATE_KEY` unset is not broken either: every knock is refused
(and the site says so once in its logs), and pages refresh on their timers
alone. Set it to the same value as the CRM's `SITE_REVALIDATE_KEY`.

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

## How fresh the site is

Three caches sit between a change in the CRM and a visitor, and each holds
for 60 seconds: the CRM's edge keeps a feed body for `max-age=60`
(`/api/public/listings`), this site's data cache re-reads the feed after
`FEED_REVALIDATE` seconds (`lib/crm.ts`), and each page is ISR with
`revalidate = 60`. Under steady traffic a change therefore shows within
about three minutes. On a quiet site the first visitor after a lull is
served the last render while a fresh one is built — but for at most one
hour past its sixty seconds (`expireTime = 3600` in `next.config.ts`);
older than that, the visitor waits for the fresh render. Until 2026-09-13
that ceiling was Next's default of a year, and the home page was measured
serving a five-day-old render. `lib/freshness.test.ts` holds the numbers in
this paragraph to the constants; the CRM's `max-age` is pinned by its own
route test. The site's functions run in `fra1`, beside the CRM and the
database (`vercel.json`), so a fresh render does not cross the Atlantic.

The timers are the fallback, not the mechanism. Since 2026-09-13 the CRM
knocks on `/api/revalidate` after a write that changes a listing's public
face, and the site rebuilds the home page, the list and that listing on
their next request — so under normal operation a publish, a withdrawal or a
new price shows within about a minute, the feed's own cache being the only
wait left. A lost knock costs freshness, never correctness: the timers above
still apply.

## Related

- CRM: `KALAITSIDIS/gnk-crm` — the feed and the enquiry door
- Previous site: `KALAITSIDIS/kalaitsidis-website` — static HTML, kept for its
  brand assets and as the record of what the domain served before
