import { NextResponse } from "next/server";
import { z } from "zod";
import { submitEnquiry } from "@/lib/crm";
import { report } from "@/lib/report";
import { site } from "@/lib/site";
import {
  assembleMessage,
  BUYER_KEYS,
  CONSENT_VERSION,
  describeProperty,
  FIELD_CAPS,
  describeRequirement,
  hasLineBreak,
  PROVENANCE_CAPS,
  PROVENANCE_KEYS,
  sameSitePath,
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

/** A provenance field: optional, trimmed, and silently absent past its cap. */
const capped = (max: number) =>
  z
    .string()
    .optional()
    .transform((v) => {
      const t = v?.trim();
      return t && t.length <= max ? t : undefined;
    });

/**
 * One line, for a value the CRM writes onto one line of its enquiry header
 * (gnk-crm 0114; LINE_BREAK_CODE_POINTS says why). Checked right after the
 * trim, so a break at either end goes with the spaces and only one INSIDE the
 * value is refused, and before the caps, so a long value with a break is told
 * about the break. JavaScript's trim does not count NEL as whitespace, so a
 * NEL is refused wherever it sits — as the CRM refuses it.
 */
const oneLine = (message: string) => [(v: string) => !hasLineBreak(v), message] as const;

const schema = z.object({
  name: z
    .string()
    .trim()
    .refine(...oneLine("Please write your name on one line."))
    .min(1, "Please tell us your name.")
    .max(200),
  // an address with a line break in it is not an address: z.email refuses it
  email: z.union([z.email("That email address does not look right."), z.literal("")]).optional(),
  phone: z
    .string()
    .trim()
    .refine(...oneLine("Please write your phone number on one line."))
    .max(40)
    .optional(),
  // the visitor's own words: written BELOW the CRM's header, so they stay multiline
  message: z.string().trim().max(5000).optional(),
  // set by the listing page, never typed — a break here is a script's
  property_reference: z
    .string()
    .trim()
    .refine(...oneLine("The property reference must be on one line."))
    .max(40)
    .optional(),
  /** Consent is recorded because the CRM stores personal data (GDPR Art. 6). */
  consent: z.literal(true, { message: "Please confirm you are happy for us to reply." }),
  website: z.string().max(200).optional(),
  /* Where it came from (gnk-crm 0098). Over the CRM's cap a value is DROPPED,
     not refused: a campaign name nobody chose must never cost an enquiry. */
  source_page: capped(PROVENANCE_CAPS.source_page),
  utm_source: capped(PROVENANCE_CAPS.utm_source),
  utm_medium: capped(PROVENANCE_CAPS.utm_medium),
  utm_campaign: capped(PROVENANCE_CAPS.utm_campaign),
  referrer_host: capped(PROVENANCE_CAPS.referrer_host),
  /* Minted by the form per attempt (gnk-crm 0096): the CRM answers a repeated
     post with the same key with the first lead, so a retry after a timeout
     is the same enquiry. The CRM refuses any other shape; refusing it here
     first keeps a malformed key from costing a post. */
  enquiry_key: z
    .union([
      z.string().regex(/^[A-Za-z0-9-]{8,64}$/, "The enquiry key is not in the expected shape."),
      z.literal(""),
    ])
    .optional(),
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
      enquiry_key: str("enquiry_key"),
      ...Object.fromEntries(
        [...SELLER_KEYS, ...BUYER_KEYS, ...PROVENANCE_KEYS].map((k) => [k, str(k)]),
      ),
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

  /* The brief as DATA beside the message (gnk-crm 0098, audit LR-01/02): the
     same select values the text block is written from, plus where it came
     from. Blanks are omitted; the CRM's door admits each key from its own
     allowlist and caps it, so this only has to be honest. `source_page` is what
     the form said; on the no-JavaScript route it is the same-site Referer's
     path, and never another site's. The consent version is set HERE, from the
     constant, so a caller cannot claim wording it never saw. */
  const meta: Record<string, string> = {};
  for (const k of [...SELLER_KEYS, ...BUYER_KEYS, ...PROVENANCE_KEYS]) {
    const v = d[k]?.trim();
    if (v) meta[k] = v;
  }
  if (!meta.source_page) {
    const path = sameSitePath(request.headers.get("referer"), new URL(request.url).host);
    if (path) meta.source_page = path;
  }
  meta.consent_version = CONSENT_VERSION;

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
      idempotency_key: d.enquiry_key || undefined,
      meta,
    },
    clientIp,
  );

  if (!result.ok) {
    // The CRM's 429 is about the VISITOR — they, specifically, have sent too
    // many — so it goes through as a 429 with the CRM's Retry-After, not as
    // a 502 that tells them the site is broken. Not logged as a refusal: it
    // is the rate limit working, and the CRM already counted it.
    if (result.status === 429) {
      const res = fail(result.error, 429);
      res.headers.set("Retry-After", result.retryAfter ?? "900");
      return res;
    }
    // A refused enquiry is a lost client. It must never fail silently: without
    // this line the firm has no way of learning an enquiry was turned away.
    /* The sentence above is why this is the one report that matters most, and
       why it carries only `result.error` — the CRM's own words about the
       refusal. The visitor's name, address and message stay out of it. */
    report({
      event: "enquiry.refused",
      level: "error",
      log: ["[enquiry] refused:", result.error],
      extra: { crmError: result.error, hadReference: Boolean(d.property_reference) },
    });
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
