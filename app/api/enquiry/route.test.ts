import { describe, expect, it, vi } from "vitest";
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
