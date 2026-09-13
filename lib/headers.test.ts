import { describe, expect, it } from "vitest";
import config from "../next.config";

/**
 * The response headers every page carries, read from the config Next reads.
 *
 * A nonce Content-Security-Policy was rejected for this ISR site (it forfeits
 * the last-good-copy behaviour the listing page depends on). A policy that
 * carries only `frame-ancestors`, `base-uri` and `form-action` has no
 * interaction with scripts or caching, and closes clickjacking twice over
 * (X-Frame-Options stays for the browsers that only read that). A
 * Permissions-Policy denies the powerful features this site never asks for
 * (audit SEC-05).
 */
async function siteHeaders(): Promise<Record<string, string>> {
  const rules = await config.headers!();
  const all = rules.find((r) => r.source === "/:path*");
  expect(all, "one rule covers every path").toBeDefined();
  return Object.fromEntries(all!.headers.map((h) => [h.key, h.value]));
}

describe("every page's headers", () => {
  it("keeps the three that were already there", async () => {
    const h = await siteHeaders();
    expect(h["X-Content-Type-Options"]).toBe("nosniff");
    expect(h["Referrer-Policy"]).toBe("strict-origin-when-cross-origin");
    expect(h["X-Frame-Options"]).toBe("DENY");
  });

  it("carries a CSP that touches nothing but framing, base and form targets", async () => {
    const csp = (await siteHeaders())["Content-Security-Policy"] ?? "";
    expect(csp).toContain("frame-ancestors 'none'");
    expect(csp).toContain("base-uri 'self'");
    expect(csp).toContain("form-action 'self'");
    // No script-src, no default-src: those would need a nonce or 'unsafe-inline'
    // on a Next page, and neither is on offer here.
    expect(csp).not.toMatch(/script-src|default-src|style-src/);
  });

  it("denies the powerful features the site never uses", async () => {
    const pp = (await siteHeaders())["Permissions-Policy"] ?? "";
    for (const f of ["camera", "microphone", "geolocation", "payment"]) {
      expect(pp, f).toContain(`${f}=()`);
    }
  });
});
