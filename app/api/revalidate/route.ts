import { revalidatePath } from "next/cache";
import { NextResponse } from "next/server";
import { feedAnswers } from "@/lib/crm";
import { isTrustedRevalidator, readKnock, REVALIDATE_KEY_HEADER, targetsFor } from "@/lib/revalidate";

/**
 * The door the CRM knocks on when a listing changes (audit REL-01).
 *
 * POST with the shared key in a header and one of
 *   { reference: "PAF0001" }  — the home page, the list and that listing;
 *   { scope: "listings" }     — the home page, the list and EVERY listing
 *                               page (a bulk change in the CRM);
 *   {}                        — the home page and the list.
 * The site marks those pages stale and Next rebuilds each on its next request
 * from the feed. The feed itself is cached for sixty seconds on both sides,
 * so "next request" means "within about a minute", against the hour the
 * stale ceiling allows and the days that were measured before it existed.
 *
 * Refusals say nothing useful to a stranger: 401 for no key or the wrong key,
 * 400 for a body that is not JSON or not one of the three shapes above, 503
 * when the feed is not answering. The WHOLE body is checked, and the feed
 * read once, before anything is rebuilt (lib/revalidate.ts readKnock, lib/crm.ts
 * feedAnswers), so a refused knock has rebuilt nothing. A reference becomes a
 * path, so it is validated against the CRM's own shape rather than trusted.
 */
export const dynamic = "force-dynamic";

const json = (body: unknown, status: number) =>
  NextResponse.json(body, { status, headers: { "Cache-Control": "no-store" } });

export async function POST(request: Request) {
  if (!isTrustedRevalidator(request.headers.get(REVALIDATE_KEY_HEADER))) {
    return json({ error: "Not authorised." }, 401);
  }

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return json({ error: "That is not valid JSON." }, 400);
  }

  const read = readKnock(body);
  if (!read.ok) return json({ error: read.error }, 400);

  // A knock EXPIRES pages, and an expired listing page whose render cannot
  // read the feed answers 500 instead of its last good copy — so nothing is
  // marked stale while the feed is not answering (lib/crm.ts feedAnswers).
  // Only an authorised, well-formed knock costs this one read.
  if (!(await feedAnswers(read.knock.kind === "listing" ? read.knock.reference : null))) {
    return json({ error: "The feed is not answering; nothing was rebuilt." }, 503);
  }

  const targets = targetsFor(read.knock);
  for (const t of targets) {
    if (t.type) revalidatePath(t.path, t.type);
    else revalidatePath(t.path);
  }
  return json({ ok: true, paths: targets.map((t) => t.path) }, 200);
}
