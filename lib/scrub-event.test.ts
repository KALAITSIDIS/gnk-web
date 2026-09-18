import { describe, expect, it } from "vitest";
import { REDACTED, SENSITIVE_HEADERS, scrubSensitiveHeaders } from "@/lib/scrub-event";

/**
 * The privacy notice is what is on trial here. `/legal` promises the visitor
 * "We never store the address itself", and the enquiry route reads that address
 * out of x-forwarded-for on every post. If an error on that route carried the
 * header through to Sentry, the promise would be false — so this is the test
 * that has to fail before that can happen.
 */
describe("scrubSensitiveHeaders", () => {
  it("redacts the visitor's address in every form Vercel sets it", () => {
    const event = {
      request: {
        headers: {
          "x-forwarded-for": "203.0.113.7, 70.41.3.18",
          "x-real-ip": "203.0.113.7",
          "x-vercel-forwarded-for": "203.0.113.7",
        },
      },
    };
    const out = scrubSensitiveHeaders(event);
    expect(out.request.headers["x-forwarded-for"]).toBe(REDACTED);
    expect(out.request.headers["x-real-ip"]).toBe(REDACTED);
    expect(out.request.headers["x-vercel-forwarded-for"]).toBe(REDACTED);
    expect(JSON.stringify(out)).not.toContain("203.0.113.7");
  });

  it("redacts the CRM's revalidate key", () => {
    const event = { request: { headers: { "x-gnk-revalidate-key": "s3cret-knock" } } };
    expect(scrubSensitiveHeaders(event).request.headers["x-gnk-revalidate-key"]).toBe(REDACTED);
  });

  it("redacts however the sender cased the name", () => {
    // Header names are case-insensitive on the wire; the event carries whatever
    // arrived. Matching only lower-case would leak on X-Forwarded-For.
    const event = { request: { headers: { "X-Forwarded-For": "203.0.113.7" } } };
    expect(scrubSensitiveHeaders(event).request.headers["X-Forwarded-For"]).toBe(REDACTED);
  });

  it("redacts rather than deletes, so the header is still visibly present", () => {
    const event = { request: { headers: { "x-gnk-revalidate-key": "s3cret-knock" } } };
    const out = scrubSensitiveHeaders(event);
    expect(Object.keys(out.request.headers), "presence is the debugging signal").toContain(
      "x-gnk-revalidate-key",
    );
  });

  it("leaves everything else alone", () => {
    const event = {
      request: {
        headers: {
          "user-agent": "Mozilla/5.0",
          "content-type": "application/json",
          referer: "https://gnkalaitsidis.com/properties",
        },
      },
    };
    const out = scrubSensitiveHeaders(event);
    expect(out.request.headers["user-agent"]).toBe("Mozilla/5.0");
    expect(out.request.headers["content-type"]).toBe("application/json");
    expect(out.request.headers.referer).toBe("https://gnkalaitsidis.com/properties");
  });

  it("survives an event with no request and one with no headers", () => {
    // Not every event comes from a request — a captureMessage from report()
    // has none at all, and it must not throw on the way out.
    expect(() => scrubSensitiveHeaders({})).not.toThrow();
    expect(() => scrubSensitiveHeaders({ request: {} })).not.toThrow();
  });

  it("names every header it claims to, in lower case", () => {
    // The doc comment above the list is the promise; this is what holds it to
    // the list actually shipped.
    expect([...SENSITIVE_HEADERS]).toEqual([
      "x-forwarded-for",
      "x-real-ip",
      "x-vercel-forwarded-for",
      "x-gnk-revalidate-key",
      "cookie",
      "authorization",
    ]);
    for (const name of SENSITIVE_HEADERS) expect(name).toBe(name.toLowerCase());
  });
});
