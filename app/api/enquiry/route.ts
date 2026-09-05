import { NextResponse } from "next/server";
import { z } from "zod";
import { submitEnquiry } from "@/lib/crm";
import { site } from "@/lib/site";
import {
  assembleMessage,
  BUYER_KEYS,
  describeProperty,
  FIELD_CAPS,
  describeRequirement,
  SELLER_KEYS,
  type BuyerFields,
  type SellerFields,
} from "@/lib/enquiry-fields";

/**
 * The site's own door, which forwards to the CRM's.
 *
 * The CRM would accept a post straight from the browser — it sends CORS `*` —
 * but routing through the server keeps the honeypot, and any timing check
 * added later, out of reach of whoever is filling in the form. It also means
 * the CRM's address never appears in client JavaScript.
 *
 * No credentials pass through here. The CRM's endpoint is public by design.
 *
 * TWO CONTENT TYPES, ON PURPOSE. The form posts JSON once React has hydrated,
 * and plain `application/x-www-form-urlencoded` when it has not. The second
 * path is not a nicety: a form with no `action` falls back to GET against the
 * current document, which would put the visitor's name, email address, phone
 * number and message into the URL bar, their history and the platform's request
 * logs — personal data in three places the privacy notice does not describe and
 * the consent checkbox did not cover — and lose the enquiry on top.
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
  /* An owner's answers about their own property, and a buyer's about what they
     want. All optional on purpose: the contact details are what make a lead,
     and a form that refuses to send until someone remembers their plot size is
     a form that does not get sent. Kept as strings rather than coerced to
     numbers — "about 180" is a real answer, and rejecting it would lose an
     enquiry over a formatting opinion.

     Written out one per line, but the LENGTHS come from FIELD_CAPS. They used
     to be literals here while lib/enquiry-fields.ts held a second copy for
     computing the message budget, so raising one would silently make the other
     wrong and the form would advertise a budget the route could not honour.
     Generating these keys from the list instead would be shorter and would cost
     zod's inference — d.district would stop being typed, and the flattening
     below depends on it. */
  district: z.string().trim().max(FIELD_CAPS.district).optional(),
  area: z.string().trim().max(FIELD_CAPS.area).optional(),
  property_type: z.string().trim().max(FIELD_CAPS.property_type).optional(),
  bedrooms: z.string().trim().max(FIELD_CAPS.bedrooms).optional(),
  covered_area_sqm: z.string().trim().max(FIELD_CAPS.covered_area_sqm).optional(),
  plot_area_sqm: z.string().trim().max(FIELD_CAPS.plot_area_sqm).optional(),
  year_built: z.string().trim().max(FIELD_CAPS.year_built).optional(),
  title_deed_status: z.string().trim().max(FIELD_CAPS.title_deed_status).optional(),
  listed_elsewhere: z.string().trim().max(FIELD_CAPS.listed_elsewhere).optional(),
  timing: z.string().trim().max(FIELD_CAPS.timing).optional(),
  looking_to: z.string().trim().max(FIELD_CAPS.looking_to).optional(),
  budget: z.string().trim().max(FIELD_CAPS.budget).optional(),
  buy_area: z.string().trim().max(FIELD_CAPS.buy_area).optional(),
  buy_property_type: z.string().trim().max(FIELD_CAPS.buy_property_type).optional(),
  bedrooms_min: z.string().trim().max(FIELD_CAPS.bedrooms_min).optional(),
  deed_required: z.string().trim().max(FIELD_CAPS.deed_required).optional(),
  buy_timing: z.string().trim().max(FIELD_CAPS.buy_timing).optional(),
});


/** A tiny, self-contained page for the visitor whose JavaScript never arrived. */
function htmlReply(title: string, body: string, status: number) {
  const page = `<!doctype html><html lang="en"><head><meta charset="utf-8">
<meta name="viewport" content="width=device-width,initial-scale=1">
<meta name="robots" content="noindex">
<title>${title} — ${site.name}</title>
<style>
 body{font:16px/1.6 system-ui,-apple-system,Segoe UI,Roboto,sans-serif;color:#1a1a1a;
      background:#faf9f7;margin:0;display:grid;place-items:center;min-height:100vh;padding:24px}
 main{max-width:34rem}
 h1{font-size:1.5rem;font-weight:600;margin:0 0 .75rem}
 p{margin:0 0 1rem;color:#444}
 a{color:#1a1a1a}
</style></head><body><main>
<h1>${title}</h1>
<p>${body}</p>
<p><a href="/properties">Back to the properties</a> &middot; <a href="${site.contact.phoneHref}">${site.contact.phone}</a></p>
</main></body></html>`;
  return new NextResponse(page, {
    status,
    headers: { "Content-Type": "text/html; charset=utf-8", "Cache-Control": "no-store" },
  });
}

export async function POST(request: Request) {
  const contentType = request.headers.get("content-type") ?? "";
  const isFormPost =
    contentType.includes("application/x-www-form-urlencoded") ||
    contentType.includes("multipart/form-data");

  let body: unknown;
  if (isFormPost) {
    const form = await request.formData();
    const str = (k: string) => {
      const v = form.get(k);
      return typeof v === "string" && v.trim() !== "" ? v : undefined;
    };
    body = {
      name: str("name") ?? "",
      email: str("email"),
      phone: str("phone"),
      message: str("message"),
      property_reference: str("property_reference"),
      // an unchecked box is absent from the payload entirely
      consent: form.get("consent") !== null,
      website: str("website"),
      ...Object.fromEntries([...SELLER_KEYS, ...BUYER_KEYS].map((k) => [k, str(k)])),
    };
  } else {
    try {
      body = await request.json();
    } catch {
      return NextResponse.json({ error: "Malformed request." }, { status: 400 });
    }
  }

  const fail = (message: string, status: number) =>
    isFormPost
      ? htmlReply("That did not send", message, status)
      : NextResponse.json({ error: message }, { status });

  const parsed = schema.safeParse(body);
  if (!parsed.success) {
    return fail(parsed.error.issues[0]?.message ?? "Please check the form.", 400);
  }
  const d = parsed.data;

  if (!d.email && !d.phone) {
    return fail("Please leave an email address or a phone number so we can reply.", 400);
  }

  /* The visitor's own address, so the CRM meters this enquiry against them and
     not against every other visitor to the site. Vercel sets x-forwarded-for;
     the first entry is the client, the rest are proxies. */
  const clientIp = request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() || undefined;

  const result = await submitEnquiry(
    {
      name: d.name,
      email: d.email || undefined,
      phone: d.phone || undefined,
      // The consent the visitor gave travels with the enquiry, so the desk can
      // see what was agreed to and when without asking them again.
      /* Assembled by ONE function that guarantees the CRM's 5000-character cap,
         because the visitor's message was validated against 5000 and THEN had
         the property block and consent line appended — a real seller
         submission could reach 5409 and be refused outright. See
         lib/enquiry-fields.ts. Both submit paths land here, so the JSON and
         no-JavaScript routes produce an identical lead. */
      /* A form is one side or the other, never both, so whichever block has
         content is the one that describes this enquiry. */
      message: assembleMessage(
        d.message,
        describeProperty(Object.fromEntries(SELLER_KEYS.map((k) => [k, d[k]])) as SellerFields) ??
          describeRequirement(
            Object.fromEntries(BUYER_KEYS.map((k) => [k, d[k]])) as BuyerFields,
          ),
      ),
      property_reference: d.property_reference || undefined,
      website: d.website || undefined,
    },
    clientIp,
  );

  if (!result.ok) {
    // A refused enquiry is a lost client. It must never fail silently: without
    // this line the firm has no way of learning an enquiry was turned away.
    console.error("[enquiry] refused:", result.error);
    return fail(result.error, 502);
  }

  return isFormPost
    ? htmlReply(
        "Thank you — that has reached us",
        "One of us will reply personally. If it is urgent, please call.",
        200,
      )
    : NextResponse.json({ ok: true }, { status: 202 });
}
