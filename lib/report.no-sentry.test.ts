import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const captureMessage = vi.fn();
const captureException = vi.fn();
vi.mock("@sentry/nextjs", () => ({
  captureMessage: (...a: unknown[]) => captureMessage(...a),
  captureException: (...a: unknown[]) => captureException(...a),
}));

const { report } = await import("@/lib/report");

/**
 * With no SENTRY_DSN — every `npm run dev`, every CI run, and any deploy where
 * the variable has not been set.
 *
 * instrumentation.ts promises that case is "a complete no-op" and report()'s
 * comment promises the console line is "the whole of it". A promise about what
 * happens when the monitoring is absent is worth exactly as much as the test
 * that fires it.
 */
describe("report with no DSN configured", () => {
  beforeEach(() => {
    captureMessage.mockClear();
    captureException.mockClear();
    delete process.env.SENTRY_DSN;
  });
  afterEach(() => vi.restoreAllMocks());

  it("still writes the console line, and sends nothing", async () => {
    const error = vi.spyOn(console, "error").mockImplementation(() => {});
    expect(() =>
      report({
        event: "crm.feed.unreachable",
        level: "error",
        log: ["[crm] feed unreachable:", new Error("fetch failed")],
        cause: new Error("fetch failed"),
      }),
    ).not.toThrow();
    expect(error, "the log is the fallback, so it must survive").toHaveBeenCalledTimes(1);

    // Give the microtask the send would have used a chance to run, so this is
    // "nothing was sent" and not "the assertion got there first".
    await new Promise((r) => setTimeout(r, 10));
    expect(captureException).not.toHaveBeenCalled();
    expect(captureMessage).not.toHaveBeenCalled();
  });

  it("does not throw on the message path either", () => {
    const error = vi.spyOn(console, "error").mockImplementation(() => {});
    expect(() =>
      report({ event: "revalidate.key-unset", level: "error", log: ["[revalidate] unset"] }),
    ).not.toThrow();
    expect(error).toHaveBeenCalledTimes(1);
  });
});
