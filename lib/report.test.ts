import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const captureMessage = vi.fn();
const captureException = vi.fn();
vi.mock("@sentry/nextjs", () => ({
  captureMessage: (...a: unknown[]) => captureMessage(...a),
  captureException: (...a: unknown[]) => captureException(...a),
}));

const { report } = await import("@/lib/report");

/** report() sends on a microtask; nothing here should race it. */
const sent = () =>
  vi.waitFor(() =>
    expect(captureMessage.mock.calls.length + captureException.mock.calls.length).toBeGreaterThan(0),
  );

describe("report", () => {
  beforeEach(() => {
    captureMessage.mockClear();
    captureException.mockClear();
    // Reporting is gated on a DSN, so give it one. Without this the Sentry
    // assertions below would pass by never reaching Sentry at all.
    process.env.SENTRY_DSN = "https://examplePublicKey@o0.ingest.sentry.io/0";
  });
  afterEach(() => {
    delete process.env.SENTRY_DSN;
    vi.restoreAllMocks();
  });

  describe("the console line it replaced", () => {
    it("goes to console.error, argument for argument", () => {
      const error = vi.spyOn(console, "error").mockImplementation(() => {});
      const err = new Error("fetch failed");
      report({
        event: "crm.feed.unreachable",
        level: "error",
        log: ["[crm] feed unreachable:", err],
      });
      expect(error).toHaveBeenCalledTimes(1);
      expect(error).toHaveBeenCalledWith("[crm] feed unreachable:", err);
    });

    it("goes to console.warn when the level says so", () => {
      const warn = vi.spyOn(console, "warn").mockImplementation(() => {});
      const error = vi.spyOn(console, "error").mockImplementation(() => {});
      report({
        event: "crm.feed.unstable",
        level: "warning",
        log: ["[crm] feed changed between pages twice; serving the union"],
      });
      expect(warn).toHaveBeenCalledWith("[crm] feed changed between pages twice; serving the union");
      expect(error, "a warning must not become an error in the log").not.toHaveBeenCalled();
    });

    it("carries three arguments as three, not as one joined string", () => {
      // lib/crm.ts logs (label, status, crmError). Collapsing them would change
      // what a Vercel log reads like, which is the thing this promises not to do.
      const error = vi.spyOn(console, "error").mockImplementation(() => {});
      report({
        event: "crm.enquiry.refused",
        level: "error",
        log: ["[crm] enquiry refused:", 400, "Too big"],
      });
      expect(error).toHaveBeenCalledWith("[crm] enquiry refused:", 400, "Too big");
    });
  });

  describe("what reaches Sentry", () => {
    it("sends the event name as the title, fingerprinted so one failure is one issue", async () => {
      vi.spyOn(console, "error").mockImplementation(() => {});
      report({
        event: "crm.feed.bad-status",
        level: "error",
        log: ["[crm] feed responded 503 at offset 0"],
        extra: { status: 503, offset: 0 },
      });
      await sent();
      expect(captureMessage).toHaveBeenCalledWith("crm.feed.bad-status", {
        level: "error",
        fingerprint: ["crm.feed.bad-status"],
        extra: { status: 503, offset: 0 },
      });
    });

    it("groups two occurrences with different varying parts as ONE issue", async () => {
      // The whole reason `event` is never interpolated into: the offset lives
      // in `extra`, so a feed failing at 0 and at 60 is one issue and not two.
      vi.spyOn(console, "error").mockImplementation(() => {});
      for (const offset of [0, 60]) {
        report({
          event: "crm.feed.bad-status",
          level: "error",
          log: [`[crm] feed responded 503 at offset ${offset}`],
          extra: { status: 503, offset },
        });
      }
      await vi.waitFor(() => expect(captureMessage).toHaveBeenCalledTimes(2));
      const fingerprints = captureMessage.mock.calls.map(
        (c) => (c[1] as { fingerprint: string[] }).fingerprint,
      );
      expect(fingerprints).toEqual([["crm.feed.bad-status"], ["crm.feed.bad-status"]]);
    });

    it("keeps the original error as `cause` so the real stack survives the rename", async () => {
      vi.spyOn(console, "error").mockImplementation(() => {});
      const original = new TypeError("fetch failed");
      report({
        event: "crm.feed.unreachable",
        level: "error",
        log: ["[crm] feed unreachable:", original],
        cause: original,
      });
      await sent();
      expect(captureMessage, "an error with a stack is not a message").not.toHaveBeenCalled();
      const [wrapper, context] = captureException.mock.calls[0] as [Error, { fingerprint: string[] }];
      expect(wrapper.message, "the title an alert email carries").toBe("crm.feed.unreachable");
      expect(wrapper.cause, "the stack Sentry's linkedErrors follows").toBe(original);
      expect(context.fingerprint).toEqual(["crm.feed.unreachable"]);
    });
  });
});
