import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

/**
 * The door the CRM knocks on when a listing changes.
 *
 * Until 2026-09-13 the only thing that refreshed a page here was time: three
 * caches of sixty seconds, and an ISR ceiling that was a year by default. On
 * a quiet site the home page was measured serving a render five days old. The
 * ceiling is an hour now (next.config.ts expireTime), and this route is the
 * other half: the CRM calls it after a write, and the affected pages are
 * rebuilt on the next request rather than on the next hour.
 *
 * It grants nothing. A caller who holds the key can make the site re-read a
 * public feed a little sooner; that is the whole power. Without the key, or
 * with the wrong one, nothing happens and the caller is told so.
 */
const revalidatePath = vi.hoisted(() => vi.fn());
vi.mock("next/cache", () => ({ revalidatePath }));

const { POST } = await import("./route");

const post = (body: unknown, key?: string) =>
  POST(
    new Request("https://gnk-web.vercel.app/api/revalidate", {
      method: "POST",
      headers: {
        "content-type": "application/json",
        ...(key ? { "x-gnk-revalidate-key": key } : {}),
      },
      body: typeof body === "string" ? body : JSON.stringify(body),
    }),
  );

const OLD = { ...process.env };
beforeEach(() => {
  process.env.SITE_REVALIDATE_KEY = "test-key-that-is-long-enough";
  revalidatePath.mockClear();
});
afterEach(() => {
  process.env = { ...OLD };
  vi.restoreAllMocks();
});

describe("the revalidate door", () => {
  it("refuses a call without the key and rebuilds nothing", async () => {
    const res = await post({ reference: "PAF0001" });
    expect(res.status).toBe(401);
    expect(revalidatePath).not.toHaveBeenCalled();
  });

  it("refuses the wrong key the same way", async () => {
    const res = await post({ reference: "PAF0001" }, "not-the-key");
    expect(res.status).toBe(401);
    expect(revalidatePath).not.toHaveBeenCalled();
  });

  it("rebuilds the home, the list and the listing for a reference", async () => {
    const res = await post({ reference: "PAF0001" }, "test-key-that-is-long-enough");
    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({ ok: true, paths: ["/", "/properties", "/properties/PAF0001"] });
    expect(revalidatePath.mock.calls.map((c) => c[0])).toEqual(["/", "/properties", "/properties/PAF0001"]);
  });

  it("rebuilds the home and the list when no reference is given", async () => {
    const res = await post({}, "test-key-that-is-long-enough");
    expect(res.status).toBe(200);
    expect(revalidatePath.mock.calls.map((c) => c[0])).toEqual(["/", "/properties"]);
  });

  it("refuses a reference that is not a reference — a path is not rebuilt from caller text", async () => {
    for (const bad of ["../etc", "PAF0001/../..", "a b", "x".repeat(41)]) {
      revalidatePath.mockClear();
      const res = await post({ reference: bad }, "test-key-that-is-long-enough");
      expect(res.status, bad).toBe(400);
      expect(revalidatePath).not.toHaveBeenCalled();
    }
  });

  it("refuses malformed JSON", async () => {
    const res = await post("{not json", "test-key-that-is-long-enough");
    expect(res.status).toBe(400);
    expect(revalidatePath).not.toHaveBeenCalled();
  });

  it("trusts nobody when the site has no key configured, and says so once", async () => {
    delete process.env.SITE_REVALIDATE_KEY;
    const error = vi.spyOn(console, "error").mockImplementation(() => {});
    expect((await post({ reference: "PAF0001" }, "any-key")).status).toBe(401);
    expect((await post({ reference: "PAF0001" }, "any-key")).status).toBe(401);
    expect(revalidatePath).not.toHaveBeenCalled();
    const mentions = error.mock.calls.filter((c) => String(c[0]).includes("SITE_REVALIDATE_KEY"));
    expect(mentions.length, "one loud line per instance, not one per call").toBe(1);
  });
});
