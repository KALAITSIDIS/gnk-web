import { describe, expect, it, vi } from "vitest";
import { submitEnquiry } from "@/lib/crm";
import { CONSENT_VERSION, LINE_BREAK_CODE_POINTS } from "@/lib/enquiry-fields";
import { report } from "@/lib/report";
import { POST } from "./route";

/**
 * The site's door forwards to the CRM's, and what the CRM says about the
 * VISITOR has to reach the visitor. A 429 from the CRM is "you, specifically,
 * have sent too many" with a Retry-After; answering that with a generic 502
 * told the person the site was broken and told their browser nothing about
 * when to try again (the audit's small site fixes).
 */
const state = vi.hoisted(() => ({
  result: { ok: true } as
    | { ok: true }
    | { ok: false; error: string; status?: number; retryAfter?: string | null },
}));
vi.mock("@/lib/crm", () => ({ submitEnquiry: vi.fn(async () => state.result) }));
// the real report, watched: a refused enquiry must be reported, a refused SHAPE must not
vi.mock("@/lib/report", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@/lib/report")>();
  return { ...actual, report: vi.fn(actual.report) };
});

const post = (body: Record<string, unknown>) =>
  POST(
    new Request("https://gnk-web.vercel.app/api/enquiry", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify(body),
    }),
  );

const valid = { name: "A Buyer", email: "buyer@example.invalid", consent: true };

describe("the site's enquiry door", () => {
  it("passes a 429 through as a 429, with the CRM's Retry-After", async () => {
    state.result = {
      ok: false,
      error: "Too many enquiries from this address. Please try again shortly.",
      status: 429,
      retryAfter: "900",
    };
    const res = await post(valid);
    expect(res.status).toBe(429);
    expect(res.headers.get("retry-after")).toBe("900");
    expect((await res.json()).error).toContain("Too many enquiries");
  });

  it("supplies the standard window when the CRM sent none", async () => {
    state.result = { ok: false, error: "Too many enquiries.", status: 429, retryAfter: null };
    const res = await post(valid);
    expect(res.status).toBe(429);
    expect(res.headers.get("retry-after")).toBe("900");
  });

  it("answers any other refusal as a 502 without a Retry-After", async () => {
    vi.spyOn(console, "error").mockImplementation(() => {});
    state.result = { ok: false, error: "That enquiry could not be sent. Please call or WhatsApp us instead." };
    const res = await post(valid);
    expect(res.status).toBe(502);
    expect(res.headers.get("retry-after")).toBeNull();
  });

  it("accepts with 202 when the CRM accepted", async () => {
    state.result = { ok: true };
    expect((await post(valid)).status).toBe(202);
  });
});

/**
 * The form mints a key per attempt (gnk-crm 0096, integrations audit INT-02);
 * the route hands it to the CRM as `idempotency_key` on both posting paths, so
 * a retry after a timeout is the same enquiry and not a second lead.
 */
describe("the enquiry key travels", () => {
  const sent = () => vi.mocked(submitEnquiry).mock.calls.at(-1)![0];

  it("from the JSON post, as idempotency_key", async () => {
    state.result = { ok: true };
    vi.mocked(submitEnquiry).mockClear();
    expect((await post({ ...valid, enquiry_key: "3f2a9c1e-0b7d-4c6e-8a9f-0b1c2d3e4f50" })).status).toBe(202);
    expect(sent().idempotency_key).toBe("3f2a9c1e-0b7d-4c6e-8a9f-0b1c2d3e4f50");
  });

  it("from the no-JavaScript form post too", async () => {
    state.result = { ok: true };
    vi.mocked(submitEnquiry).mockClear();
    const form = new URLSearchParams({
      name: "A Buyer",
      email: "buyer@example.invalid",
      consent: "on",
      enquiry_key: "3f2a9c1e-0b7d-4c6e-8a9f-0b1c2d3e4f50",
    });
    const res = await POST(
      new Request("https://gnk-web.vercel.app/api/enquiry", {
        method: "POST",
        headers: { "content-type": "application/x-www-form-urlencoded" },
        body: form.toString(),
      }),
    );
    expect(res.status).toBe(200);
    expect(sent().idempotency_key).toBe("3f2a9c1e-0b7d-4c6e-8a9f-0b1c2d3e4f50");
  });

  it("is absent rather than empty when the form sent none", async () => {
    state.result = { ok: true };
    vi.mocked(submitEnquiry).mockClear();
    expect((await post({ ...valid, enquiry_key: "" })).status).toBe(202);
    expect(sent().idempotency_key).toBeUndefined();
  });

  it("refuses a key the CRM would refuse, before posting anything", async () => {
    vi.mocked(submitEnquiry).mockClear();
    expect((await post({ ...valid, enquiry_key: "no spaces!" })).status).toBe(400);
    expect(submitEnquiry).not.toHaveBeenCalled();
  });
});

/**
 * The brief and its provenance travel as DATA beside the message (gnk-crm
 * 0098, audit LR-01/02): the select values as they are, the page the form was
 * sent from, the campaign the visit landed with, the referring site's host,
 * and the version of the consent wording. The message keeps its text block so
 * nothing the desk reads changes shape. Nothing personal ever enters meta.
 */
describe("the brief and its provenance travel as meta", () => {
  const sent = () => vi.mocked(submitEnquiry).mock.calls.at(-1)![0];

  it("forwards the buyer's answers, the page, the campaign, the referrer host and the consent version", async () => {
    state.result = { ok: true };
    vi.mocked(submitEnquiry).mockClear();
    const res = await post({
      ...valid,
      budget: "over_1m",
      buy_area: "Peyia / Coral Bay",
      looking_to: "buy",
      source_page: "/properties/PAF0001",
      utm_source: "instagram",
      utm_campaign: "spring",
      referrer_host: "l.instagram.com",
    });
    expect(res.status).toBe(202);
    expect(sent().meta).toEqual({
      budget: "over_1m",
      buy_area: "Peyia / Coral Bay",
      looking_to: "buy",
      source_page: "/properties/PAF0001",
      utm_source: "instagram",
      utm_campaign: "spring",
      referrer_host: "l.instagram.com",
      consent_version: CONSENT_VERSION,
    });
    // the desk's text block is unchanged
    expect(sent().message).toContain("Budget: Over €1m");
  });

  it("omits blanks, and never carries the person as meta", async () => {
    state.result = { ok: true };
    vi.mocked(submitEnquiry).mockClear();
    await post({ ...valid, budget: "", utm_source: "", source_page: "" });
    expect(sent().meta).toEqual({ consent_version: CONSENT_VERSION });
    expect(JSON.stringify(sent().meta)).not.toContain("buyer@example.invalid");
    expect(JSON.stringify(sent().meta)).not.toContain("A Buyer");
  });

  it("takes the page from a same-site Referer on the no-JavaScript path, and never from another site", async () => {
    state.result = { ok: true };
    const formPost = (referer: string) =>
      POST(
        new Request("https://gnk-web.vercel.app/api/enquiry", {
          method: "POST",
          headers: { "content-type": "application/x-www-form-urlencoded", referer },
          body: new URLSearchParams({ name: "A Seller", email: "s@example.invalid", consent: "on" }).toString(),
        }),
      );
    vi.mocked(submitEnquiry).mockClear();
    expect((await formPost("https://gnk-web.vercel.app/selling?utm_source=x")).status).toBe(200);
    expect(sent().meta?.source_page).toBe("/selling");
    vi.mocked(submitEnquiry).mockClear();
    await formPost("https://evil.example/phish");
    expect(sent().meta?.source_page).toBeUndefined();
  });

  it("caps what it forwards, so an oversized campaign name is dropped rather than refused", async () => {
    state.result = { ok: true };
    vi.mocked(submitEnquiry).mockClear();
    expect((await post({ ...valid, utm_campaign: "x".repeat(121) })).status).toBe(202);
    expect(sent().meta?.utm_campaign).toBeUndefined();
  });
});

/**
 * gnk-crm T-enquiry-identity-single-line (PR #59, migration 0114). The CRM's
 * door writes the name, e-mail, phone and reference onto ONE line each of the
 * header the desk reads the person back from, and a line break in one of them
 * wrote a line of its own: a phone of "+35799123456\nEmail: other@x.invalid"
 * became the lead's e-mail. The CRM now refuses a break in any of the four.
 *
 * This route refused nothing of the kind. It forwarded the body, the CRM said
 * no, and the caller got a 502 "That did not send" — while Sentry got an
 * error-level `enquiry.refused`, the report that exists for a REAL enquiry
 * turned away. The same rule here makes it the site's own 400, in the site's
 * words, before anything is forwarded or reported. Mostly a script's case: a
 * one-line input drops LF and CR (Chromium turns a pasted newline into a
 * space). But the browser keeps VT, FF, NEL, U+2028 and U+2029, so a visitor
 * who PASTES one inside a name or number meets this too — and now reads a
 * sentence they can act on instead of "That did not send". The message stays
 * multiline.
 */
describe("a line break in a one-line field", () => {
  const sent = () => vi.mocked(submitEnquiry).mock.calls.at(-1)![0];

  /** A 400 in the site's words, and nothing forwarded, reported or logged. */
  async function refusedBeforeForwarding(res: Response, sentence: string) {
    expect(res.status).toBe(400);
    expect(((await res.json()) as { error: string }).error).toBe(sentence);
    expect(submitEnquiry, "never forwarded to the CRM").not.toHaveBeenCalled();
    expect(report, "never reported as a refused enquiry").not.toHaveBeenCalled();
  }

  const fresh = () => {
    state.result = { ok: true };
    vi.mocked(submitEnquiry).mockClear();
    vi.mocked(report).mockClear();
  };

  it("refuses the audit's case A — a phone carrying an Email: line", async () => {
    fresh();
    const res = await post({
      ...valid,
      name: "Example Buyer",
      phone: "+35799123456\nEmail: other@x.invalid",
      message: "Please contact me.",
    });
    await refusedBeforeForwarding(res, "Please write your phone number on one line.");
  });

  it("refuses the audit's case B — a five-line name — as a line break, not a missing name", async () => {
    fresh();
    const res = await post({ ...valid, name: "Example\nextra\nextra\nextra\nextra", phone: "+35799123456" });
    await refusedBeforeForwarding(res, "Please write your name on one line.");
  });

  it("refuses CR and CRLF as well as LF, in the name and in the phone", async () => {
    for (const br of ["\r", "\r\n", "\n\n"]) {
      fresh();
      await refusedBeforeForwarding(await post({ ...valid, name: `Ann${br}Smith` }), "Please write your name on one line.");
      fresh();
      await refusedBeforeForwarding(await post({ ...valid, phone: `99${br}123456` }), "Please write your phone number on one line.");
    }
  });

  it("refuses every break the CRM refuses — U+2028 and NEL included", async () => {
    for (const cp of LINE_BREAK_CODE_POINTS) {
      fresh();
      const res = await post({ ...valid, name: `Ann${String.fromCodePoint(cp)}Email: other@x.invalid` });
      expect(res.status, `U+${cp.toString(16).padStart(4, "0")}`).toBe(400);
      expect(submitEnquiry).not.toHaveBeenCalled();
    }
    // JavaScript's trim does not count NEL as whitespace, so even a trailing one is refused
    fresh();
    await refusedBeforeForwarding(await post({ ...valid, name: `Ann${String.fromCodePoint(0x85)}` }), "Please write your name on one line.");
  });

  it("refuses a reference with an injected line — the CRM writes it onto the About line", async () => {
    fresh();
    const res = await post({ ...valid, property_reference: "PAF0001\nEmail: other@x.invalid" });
    await refusedBeforeForwarding(res, "The property reference must be on one line.");
  });

  it("refuses an e-mail with a line break as the address it is not", async () => {
    fresh();
    await refusedBeforeForwarding(await post({ ...valid, email: "buyer@example.invalid\nPhone: 1" }), "That email address does not look right.");
  });

  it("refuses on the no-JavaScript path too, with the page it always answers with", async () => {
    fresh();
    const res = await POST(
      new Request("https://gnk-web.vercel.app/api/enquiry", {
        method: "POST",
        headers: { "content-type": "application/x-www-form-urlencoded" },
        body: new URLSearchParams({
          name: "Example\nEmail: other@x.invalid",
          email: "buyer@example.invalid",
          consent: "on",
        }).toString(),
      }),
    );
    expect(res.status).toBe(400);
    expect(res.headers.get("content-type")).toContain("text/html");
    expect(await res.text()).toContain("Please write your name on one line.");
    expect(submitEnquiry).not.toHaveBeenCalled();
    expect(report).not.toHaveBeenCalled();
  });

  it("trims a break at either end like a space, as before — only an embedded one is refused", async () => {
    fresh();
    expect(
      (await post({ ...valid, name: "\nA Buyer\r\n", phone: " +357 99 123456\n", property_reference: "PAF0001\r\n" })).status,
    ).toBe(202);
    expect(sent().name).toBe("A Buyer");
    expect(sent().phone).toBe("+357 99 123456");
    expect(sent().property_reference).toBe("PAF0001");
  });

  it("names the break, not the length, when an over-long value also carries one", async () => {
    fresh();
    await refusedBeforeForwarding(await post({ ...valid, name: `${"x".repeat(200)}\nmore` }), "Please write your name on one line.");
    fresh();
    await refusedBeforeForwarding(await post({ ...valid, phone: `${"9".repeat(40)}\n1` }), "Please write your phone number on one line.");
    fresh();
    await refusedBeforeForwarding(
      await post({ ...valid, property_reference: `${"R".repeat(40)}\nEmail: other@x.invalid` }),
      "The property reference must be on one line.",
    );
  });

  it("keeps a blank-only name a missing name", async () => {
    fresh();
    await refusedBeforeForwarding(await post({ ...valid, name: "\n\n" }), "Please tell us your name.");
  });

  it("forwards a multiline message whole, header-shaped lines and all", async () => {
    fresh();
    const message = "Is it still available?\nEmail: my old address bounced\r\nPhone: after 6\n\nName: that is my husband's";
    expect((await post({ ...valid, message })).status).toBe(202);
    expect(sent().message?.startsWith(`${message}\n\n`)).toBe(true);
  });

  it("forwards real names and international numbers exactly as typed", async () => {
    for (const [name, phone] of [
      ["Γιώργος Παπαδόπουλος", "+357 99 123456"],
      ["Анна-Мария Иванова", "+7 (495) 123-45-67"],
      ["Seán O'Brien", "(+44) 20 7946 0958"],
      ["Jean-Luc Picard-Smith", "00357 99 123456 ext. 12"],
    ]) {
      fresh();
      expect((await post({ ...valid, name, phone })).status, name).toBe(202);
      expect(sent().name).toBe(name);
      expect(sent().phone).toBe(phone);
    }
  });

  it("keeps the caps and the optional fields as they were", async () => {
    fresh();
    expect((await post({ ...valid, name: "Ω".repeat(200) })).status).toBe(202);
    expect((await post({ ...valid, name: "Ω".repeat(201) })).status).toBe(400);
    expect((await post({ ...valid, phone: "9".repeat(41) })).status).toBe(400);
    expect((await post({ ...valid, property_reference: "R".repeat(41) })).status).toBe(400);
    fresh();
    expect((await post({ ...valid, phone: "", property_reference: "" })).status).toBe(202);
    expect(sent().phone).toBeUndefined();
    expect(sent().property_reference).toBeUndefined();
  });
});
