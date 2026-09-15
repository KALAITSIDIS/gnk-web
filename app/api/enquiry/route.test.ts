import { describe, expect, it, vi } from "vitest";
import { submitEnquiry } from "@/lib/crm";
import { CONSENT_VERSION } from "@/lib/enquiry-fields";
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
