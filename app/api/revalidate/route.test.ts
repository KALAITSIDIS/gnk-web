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
// The door reads the feed once before it expires anything (lib/crm.ts
// feedAnswers). Stubbed: an unmocked probe would read the REAL CRM.
const feedAnswers = vi.hoisted(() => vi.fn<(reference: string | null) => Promise<boolean>>(async () => true));
vi.mock("@/lib/crm", () => ({ feedAnswers }));

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

const KEY = "test-key-that-is-long-enough";
const OLD = { ...process.env };
beforeEach(() => {
  process.env.SITE_REVALIDATE_KEY = "test-key-that-is-long-enough";
  revalidatePath.mockClear();
  feedAnswers.mockClear();
  feedAnswers.mockImplementation(async () => true);
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

  /* A BULK change (T-unit-site-revalidate): the CRM's bulk reprice and
     unit-type stamp move many units' pages at once. It asks for every
     listing page in ONE knock — no list of references, so no unit the site
     does not show is ever named to it, and the request does not grow with
     the scope. Next marks the route pattern stale and each page is rebuilt
     on its own next visit (revalidatePath with a pattern and type "page"). */
  it("rebuilds the home, the list and EVERY listing page for scope: listings", async () => {
    const res = await post({ scope: "listings" }, KEY);
    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({ ok: true, paths: ["/", "/properties", "/properties/[reference]"] });
    expect(revalidatePath.mock.calls).toEqual([["/"], ["/properties"], ["/properties/[reference]", "page"]]);
  });

  it("refuses scope: listings without the key, or with the wrong one, and rebuilds nothing", async () => {
    expect((await post({ scope: "listings" })).status).toBe(401);
    expect((await post({ scope: "listings" }, "not-the-key")).status).toBe(401);
    expect(revalidatePath).not.toHaveBeenCalled();
  });

  it("refuses a scope it does not know, before rebuilding anything", async () => {
    for (const scope of ["all", "LISTINGS", "", 1, true, ["listings"], { listings: true }]) {
      revalidatePath.mockClear();
      const res = await post({ scope }, KEY);
      expect(res.status, JSON.stringify(scope)).toBe(400);
      expect(revalidatePath).not.toHaveBeenCalled();
    }
  });

  it("refuses a reference AND a scope together — one knock asks for one thing", async () => {
    const res = await post({ reference: "PAF0001", scope: "listings" }, KEY);
    expect(res.status).toBe(400);
    expect(revalidatePath).not.toHaveBeenCalled();
  });

  it("refuses a body that is not an object, or carries a field the door does not read — nothing half-applied", async () => {
    // A list of references is NOT this contract: half-reading one (the home
    // and the list rebuilt, the listings silently not) would answer 200 for a
    // knock that did not do what it asked.
    for (const body of [null, [], ["PAF0001"], "PAF0001", 42, { references: ["PAF0001", "PAF0002"] }, { reference: "PAF0001", extra: 1 }]) {
      revalidatePath.mockClear();
      const res = await post(JSON.stringify(body), KEY);
      expect(res.status, JSON.stringify(body)).toBe(400);
      expect(revalidatePath).not.toHaveBeenCalled();
    }
  });

  it("still takes the knocks the CRM sent before scope existed: { reference } and {}", async () => {
    expect((await post({ reference: "PAF0002-V03" }, KEY)).status).toBe(200);
    expect((await post({ reference: null }, KEY)).status).toBe(200);
    expect((await post({ reference: "" }, KEY)).status).toBe(200);
    expect((await post({}, KEY)).status).toBe(200);
    expect(revalidatePath.mock.calls).toEqual([
      ["/"], ["/properties"], ["/properties/PAF0002-V03"],
      ["/"], ["/properties"],
      ["/"], ["/properties"],
      ["/"], ["/properties"],
    ]);
  });

  /* A knock EXPIRES pages: the next visitor waits for a fresh render. With
     the feed down that render throws, and a listing page answers 500 where,
     left alone, it keeps its last good copy — measured on a production build
     2026-10-08. So the door reads the feed first and rebuilds nothing when it
     cannot. */
  it("rebuilds NOTHING while the feed is not answering — 503, and every page keeps its last good copy", async () => {
    feedAnswers.mockImplementation(async () => false);
    for (const body of [{ reference: "PAF0001" }, { scope: "listings" }, {}]) {
      const res = await post(body, KEY);
      expect(res.status, JSON.stringify(body)).toBe(503);
    }
    expect(revalidatePath).not.toHaveBeenCalled();
  });

  it("asks the feed about the listing it names, or the book — and only for an authorised, well-formed knock", async () => {
    await post({ reference: "PAF0001" });
    await post({ reference: "PAF0001" }, "not-the-key");
    await post({ scope: "nope" }, KEY);
    await post("{not json", KEY);
    expect(feedAnswers, "a refused knock costs the CRM nothing").not.toHaveBeenCalled();
    await post({ reference: "PAF0002-V03" }, KEY);
    await post({ scope: "listings" }, KEY);
    await post({}, KEY);
    expect(feedAnswers.mock.calls).toEqual([["PAF0002-V03"], [null], [null]]);
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
