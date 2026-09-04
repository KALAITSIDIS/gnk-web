import { NextResponse } from "next/server";
import { z } from "zod";
import { submitEnquiry } from "@/lib/crm";

/**
 * The site's own door, which forwards to the CRM's.
 *
 * The CRM would accept a post straight from the browser — it sends CORS `*` —
 * but routing through the server keeps the honeypot, and any timing check
 * added later, out of reach of whoever is filling in the form. It also means
 * the CRM's address never appears in client JavaScript.
 *
 * No credentials pass through here. The CRM's endpoint is public by design.
 */
export const dynamic = "force-dynamic";

const schema = z.object({
  name: z.string().trim().min(1, "Please tell us your name.").max(200),
  email: z.union([z.email("That email address does not look right."), z.literal("")]).optional(),
  phone: z.string().trim().max(40).optional(),
  message: z.string().trim().max(5000).optional(),
  property_reference: z.string().trim().max(40).optional(),
  /** Consent is recorded because the CRM stores personal data (GDPR Art. 6). */
  consent: z.literal(true, { message: "Please confirm you are happy for us to reply." }),
  website: z.string().max(200).optional(),
});

export async function POST(request: Request) {
  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Malformed request." }, { status: 400 });
  }

  const parsed = schema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: parsed.error.issues[0]?.message ?? "Please check the form." },
      { status: 400 },
    );
  }
  const d = parsed.data;

  if (!d.email && !d.phone) {
    return NextResponse.json(
      { error: "Please leave an email address or a phone number so we can reply." },
      { status: 400 },
    );
  }

  const result = await submitEnquiry({
    name: d.name,
    email: d.email || undefined,
    phone: d.phone || undefined,
    // The consent the visitor gave travels with the enquiry, so the desk can
    // see what was agreed to and when without asking them again.
    message: [d.message, "— Consent given to be contacted about this enquiry."]
      .filter(Boolean)
      .join("\n\n"),
    property_reference: d.property_reference || undefined,
    website: d.website || undefined,
  });

  if (!result.ok) return NextResponse.json({ error: result.error }, { status: 502 });
  return NextResponse.json({ ok: true }, { status: 202 });
}
