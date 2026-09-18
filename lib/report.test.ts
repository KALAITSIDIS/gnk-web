import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const captureMessage = vi.fn();
const captureException = vi.fn();
vi.mock("@sentry/nextjs", () => ({
  captureMessage: (...a: unknown[]) => captureMessage(...a),
  captureException: (...a: unknown[]) => captureException(...a),
}));

const { report } = await import("@/lib/report");

/**
 * report() sends on a microtask, so asserting straight after the call is a
 * race. The FIRST send in this file also pays for resolving the mocked module,
 * which on a cold CI runner is slow and unpredictable — so the wait is
 * generous, and the tests that wait are given a budget LARGER than it.
 *
 * Those two numbers are why this file went red twice. First the console tests
 * ran with a DSN, queued sends, and their microtasks landed inside a later
 * test after its spy had been cleared. Then the wait was set to 5000 ms inside
 * vitest's default 5000 ms test timeout, so the waiter could never finish. A
 * wait window must always be shorter than the budget it runs inside.
 */
const SEND_WINDOW_MS = 10_000;
const TEST_BUDGET_MS = 20_000;

const sent = () =>
  vi.waitFor(
    () =>
      expect(captureMessage.mock.calls.length + captureException.mock.calls.length).toBeGreaterThan(
        0,
      ),
    { timeout: SEND_WINDOW_MS },
  );

describe("report", () => {
  afterEach(() => {
    delete process.env.SENTRY_DSN;
    vi.restoreAllMocks();
  });

  describe("the console line it replaced", () => {
    /* NO DSN in this block, and that is the point: the console line does not
       depend on one, and with a DSN each of these calls would queue a send
       whose microtask lands during a later test. */
    beforeEach(() => {
      delete process.env.SENTRY_DSN;
      captureMessage.mockClear();
      captureException.mockClear();
    });

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
    beforeEach(() => {
      captureMessage.mockClear();
      captureException.mockClear();
      // Reporting is gated on a DSN, so give it one. Without this every
      // assertion below would pass by never reaching Sentry at all. Each test
      // here awaits its own send before finishing, so none leaks into the next.
      process.env.SENTRY_DSN = "https://examplePublicKey@o0.ingest.sentry.io/0";
    });

    it(
      "sends the event name as the title, fingerprinted so one failure is one issue",
      async () => {
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
      },
      TEST_BUDGET_MS,
    );

    it(
      "groups two occurrences with different varying parts as ONE issue",
      async () => {
        // The whole reason `event` is never interpolated into: the offset lives
        // in `extra`, so a feed failing at 0 and at 60 is one issue, not two.
        vi.spyOn(console, "error").mockImplementation(() => {});
        for (const offset of [0, 60]) {
          report({
            event: "crm.feed.bad-status",
            level: "error",
            log: [`[crm] feed responded 503 at offset ${offset}`],
            extra: { status: 503, offset },
          });
        }
        await vi.waitFor(() => expect(captureMessage).toHaveBeenCalledTimes(2), {
          timeout: SEND_WINDOW_MS,
        });
        const fingerprints = captureMessage.mock.calls.map(
          (c) => (c[1] as { fingerprint: string[] }).fingerprint,
        );
        expect(fingerprints).toEqual([["crm.feed.bad-status"], ["crm.feed.bad-status"]]);
      },
      TEST_BUDGET_MS,
    );

    it(
      "keeps the original error as `cause` so the real stack survives the rename",
      async () => {
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
        const [wrapper, context] = captureException.mock.calls[0] as [
          Error,
          { fingerprint: string[] },
        ];
        expect(wrapper.message, "the title an alert email carries").toBe("crm.feed.unreachable");
        expect(wrapper.cause, "the stack Sentry's linkedErrors follows").toBe(original);
        expect(context.fingerprint).toEqual(["crm.feed.unreachable"]);
      },
      TEST_BUDGET_MS,
    );
  });
});
