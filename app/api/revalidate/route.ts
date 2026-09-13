import { revalidatePath } from "next/cache";
import { NextResponse } from "next/server";
import { isTrustedRevalidator, pathsFor, REFERENCE, REVALIDATE_KEY_HEADER } from "@/lib/revalidate";

/**
 * The door the CRM knocks on when a listing changes (audit REL-01).
 *
 * POST { reference?: string } with the shared key in a header. The site marks
 * the home page, the list and — when a reference is given — that listing's
 * page stale, and Next rebuilds each on its next request from the feed. The
 * feed itself is cached for sixty seconds on both sides, so "next request"
 * means "within about a minute", against the hour the stale ceiling allows
 * and the days that were measured before it existed.
 *
 * Refusals say nothing useful to a stranger: 401 for no key or the wrong key,
 * 400 for a body that is not JSON or a reference that is not a reference.
 * A reference becomes a path, so it is validated against the CRM's own shape
 * rather than trusted.
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

  const raw = (body as { reference?: unknown } | null)?.reference;
  let reference: string | null = null;
  if (raw !== undefined && raw !== null && raw !== "") {
    if (typeof raw !== "string" || !REFERENCE.test(raw)) {
      return json({ error: "reference must be a listing reference such as PAF0001." }, 400);
    }
    reference = raw;
  }

  const paths = pathsFor(reference);
  for (const p of paths) revalidatePath(p);
  return json({ ok: true, paths }, 200);
}
