import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { ENQUIRY_RETENTION_MONTHS } from "@/lib/site";

/**
 * The privacy page says how long an enquiry is kept, and a job in the CRM
 * keeps that promise (gnk-crm 0092, `redact_stale_enquiries`, nightly at
 * 03:10 with a default of 24 months). The number lives in two repositories on
 * purpose — a database function cannot import a TypeScript constant — so each
 * side pins its own copy: the CRM's migration asserts its default at apply
 * time, and this test asserts the page states THIS constant and nothing
 * hand-typed beside it. Change both or neither (audit DATA-01).
 */
const { default: LegalPage } = await import("./page");
const html = renderToStaticMarkup(createElement(LegalPage));

describe("the retention promise on the privacy page", () => {
  it("is the number the CRM's sweep enforces", () => {
    expect(ENQUIRY_RETENTION_MONTHS).toBe(24);
    expect(html).toContain(`${ENQUIRY_RETENTION_MONTHS} months`);
  });

  it("describes what actually happens — an automatic erasure, not a manual deletion", () => {
    expect(html).toMatch(/automatically/);
    expect(html).not.toMatch(/within two\s+years/);
  });
});
