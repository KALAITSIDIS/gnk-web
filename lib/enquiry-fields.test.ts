import { describe, expect, it } from "vitest";
import {
  AREAS,
  areasWithFeed,
  assembleMessage,
  CRM_MESSAGE_CAP,
  DEED_STATUSES,
  describeProperty,
  describeRequirement,
  FIELD_CAPS,
  messageBudget,
  PROPERTY_TYPES,
  SELLER_KEYS,
  BUYER_KEYS,
  CONSENT_VERSION,
  campaignFromSearch,
  hasLineBreak,
  LINE_BREAK_CODE_POINTS,
  readCampaign,
  referrerHost,
  rememberCampaign,
} from "./enquiry-fields";

/**
 * What reaches the desk, and whether it reaches the desk at all.
 *
 * The CRM refuses a message over 5000 characters outright — 0084 returns false
 * and nothing anywhere truncates — so an enquiry that crosses the cap is not
 * shortened, it is LOST. The visitor's own text was validated against 5000 and
 * THEN had a property block and a consent line appended, so a real submission
 * through /selling could reach 5409 and be refused with zod's own words, on the
 * one page built to invite owners to write at length.
 *
 * That fix was originally "verified by arithmetic" in a throwaway script that
 * replicated the logic rather than exercising it — which tested a model of the
 * code, not the code, and then deleted itself. This file tests the real thing.
 */

/* Built FROM FIELD_CAPS, not from numbers copied into this file. The first
   version of this test used 80 characters for every field, which several caps
   forbid — so it failed against a budget that was actually correct, and the
   failure is what surfaced that the caps were declared twice. A test that
   hardcodes the lengths is a third copy of the same fact. */
const atCap = (keys: readonly string[]) =>
  Object.fromEntries(keys.map((k) => [k, "x".repeat(FIELD_CAPS[k as keyof typeof FIELD_CAPS])]));
const FULL_SELLER = atCap(SELLER_KEYS);
const FULL_BUYER = atCap(BUYER_KEYS);

describe("the 5000-character guarantee", () => {
  const cases: [string, string | null][] = [
    ["a seller block", describeProperty(FULL_SELLER)],
    ["a buyer block", describeRequirement(FULL_BUYER)],
    ["no block at all", null],
  ];

  for (const [name, block] of cases) {
    for (const own of [0, 1, 100, 4000, 4999, 5000, 50000]) {
      it(`never exceeds the cap: ${name}, ${own} characters of their own`, () => {
        const out = assembleMessage("y".repeat(own), block);
        expect(out.length).toBeLessThanOrEqual(CRM_MESSAGE_CAP);
      });
    }
  }

  it("trims the VISITOR's words, never the structured block", () => {
    const block = describeProperty(FULL_SELLER)!;
    const out = assembleMessage("y".repeat(50000), block);
    // the block survives intact — it is short, fixed, and the reason the lead
    // is useful; a long description is what the desk can ask them to repeat
    expect(out).toContain(block);
    expect(out).toContain("Consent given");
  });

  it("marks a trim, so nobody reads a severed sentence as the whole thought", () => {
    const out = assembleMessage("y".repeat(50000), describeProperty(FULL_SELLER));
    expect(out).toContain("did not fit");
  });

  it("does not mark anything when nothing was trimmed", () => {
    const out = assembleMessage("a short note", describeProperty(FULL_SELLER));
    expect(out).not.toContain("did not fit");
    expect(out).toContain("a short note");
  });

  it("handles an empty message without leaving a dangling separator", () => {
    const out = assembleMessage("", null);
    expect(out.startsWith("\n")).toBe(false);
    expect(out).toContain("Consent given");
  });
});

describe("what the form may honestly advertise", () => {
  it("promises no more than the route can actually accept", () => {
    for (const [kind, block] of [
      ["seller", describeProperty(FULL_SELLER)],
      ["buyer", describeRequirement(FULL_BUYER)],
      [null, null],
    ] as const) {
      const budget = messageBudget(kind);
      // a message exactly at the advertised budget must survive untrimmed
      const out = assembleMessage("y".repeat(budget), block);
      expect(out.length, `${kind} at budget`).toBeLessThanOrEqual(CRM_MESSAGE_CAP);
      expect(out, `${kind} at budget must not be trimmed`).not.toContain("did not fit");
    }
  });

  it("gives a seller less room than a buyer, and both less than a plain enquiry", () => {
    expect(messageBudget("seller")).toBeLessThan(messageBudget("buyer"));
    expect(messageBudget("buyer")).toBeLessThan(messageBudget(null));
  });
});

describe("the desk reads English, not tokens", () => {
  it("turns a seller's answers into readable lines", () => {
    const out = describeProperty({ title_deed_status: "pending", listed_elsewhere: "yes_agent" })!;
    expect(out).toContain("Deed applied for, not yet issued");
    expect(out).toContain("Yes, with another agent");
    expect(out).not.toContain("yes_agent");
  });

  it("turns a buyer's answers into readable lines", () => {
    const out = describeRequirement({ budget: "500_750k", deed_required: "yes" })!;
    expect(out).toContain("€500,000 – €750,000");
    expect(out).toContain("Yes — separate deed only");
    expect(out).not.toContain("500_750k");
  });

  it("omits an unanswered field rather than printing a gap", () => {
    const out = describeProperty({ district: "Paphos" })!;
    expect(out).toContain("District: Paphos");
    expect(out).not.toContain("Plot");
  });

  it("returns null when nothing was answered, so no empty heading is appended", () => {
    expect(describeProperty({})).toBeNull();
    expect(describeRequirement({})).toBeNull();
  });
});

/**
 * The header says the vocabulary is the CRM's. That used to be a date in prose
 * — "Verified against the CRM 2026-09-04" — which was false the day it was
 * written: "hotel" had been in the CRM's list since 2026-07-10 and was never
 * here. A date cannot fail; this can.
 *
 * The site holds no CRM database credential and cannot read the enum, so this is a PINNED
 * COPY with its provenance, not a live check. It binds the form's list to the
 * record and makes "the CRM's list" checkable by anyone with the CRM checkout:
 *   git -C ../gnk-crm show 7e4a008:lib/validators/properties.ts
 * When the CRM's list changes, re-pin here with the new commit.
 */
const CRM_PROPERTY_TYPES = {
  // gnk-crm@7e4a008 lib/validators/properties.ts PROPERTY_TYPES, in its order
  source: "gnk-crm@7e4a008 lib/validators/properties.ts",
  list: [
    "apartment",
    "villa",
    "townhouse",
    "house",
    "land",
    "shop",
    "office",
    "building",
    "hotel",
    "warehouse",
    "mixed_use",
    "other",
  ],
  // gnk-crm@7e4a008 lib/validators/properties.ts TITLE_DEED_STATUSES
  deedStatuses: ["separate", "pending", "shared", "none", "unknown"],
};

describe("the vocabulary is the CRM's, pinned", () => {
  it("offers exactly the CRM's property types, in the CRM's order", () => {
    expect([...PROPERTY_TYPES]).toEqual(CRM_PROPERTY_TYPES.list);
  });

  it("offers exactly the CRM's deed statuses (reordered and labelled on purpose)", () => {
    expect([...DEED_STATUSES].map((d) => d.value).sort()).toEqual(
      [...CRM_PROPERTY_TYPES.deedStatuses].sort(),
    );
  });
});

/**
 * What "a line break" means is the CRM's to say (gnk-crm T-enquiry-identity-
 * single-line, PR #59): its door refuses one in the name, e-mail, phone and
 * reference, and the site's route refuses the same set first, so a script's
 * post is the site's 400 rather than a forwarded refusal. A PINNED COPY, like
 * the vocabulary above, checkable with the CRM checkout:
 *   git -C ../gnk-crm show e5d6190:lib/validators/single-line.ts
 * If the CRM's set changes, re-pin here with the new commit — a set smaller
 * than the CRM's sends its refusals back to being 502s and error reports.
 */
const CRM_LINE_BREAKS = {
  source: "gnk-crm@e5d6190 lib/validators/single-line.ts LINE_BREAK_CODE_POINTS",
  list: [0x0a, 0x0b, 0x0c, 0x0d, 0x85, 0x2028, 0x2029],
};

describe("a line break is the CRM's line break, pinned", () => {
  const ch = (cp: number) => String.fromCodePoint(cp);

  it("is exactly the CRM's set: Unicode's mandatory breaks", () => {
    expect([...LINE_BREAK_CODE_POINTS]).toEqual(CRM_LINE_BREAKS.list);
  });

  it("finds each of them anywhere in a value", () => {
    for (const cp of LINE_BREAK_CODE_POINTS) {
      expect(hasLineBreak(`Ann${ch(cp)}Smith`), cp.toString(16)).toBe(true);
      expect(hasLineBreak(`${ch(cp)}Ann`), cp.toString(16)).toBe(true);
      expect(hasLineBreak(`Ann${ch(cp)}`), cp.toString(16)).toBe(true);
    }
    expect(hasLineBreak("+35799123456\r\nEmail: other@x.invalid")).toBe(true);
  });

  it("passes real names and numbers, and whitespace that is not a break", () => {
    for (const v of [
      "Maria Georgiou",
      "Seán O'Brien",
      "Jean-Luc Picard-Smith",
      "Γιώργος Παπαδόπουλος",
      "Анна-Мария Иванова",
      "+357 99 123456",
      "(+44) 20 7946 0958",
      "+7 (495) 123-45-67",
      "Ann\tSmith",
      `Ann${ch(0xa0)}Smith`,
      "",
    ]) {
      expect(hasLineBreak(v), v).toBe(false);
    }
  });
});

describe("the buyer picker never lacks an area the CRM is publishing with", () => {
  // Shapes the feed actually sends: district/area are {en, el, ru} or null.
  const feed = [
    { district: { en: "Paphos" }, area: { en: "Peyia" } }, // renamed in Settings after this file was written
    { district: { en: "Larnaca" }, area: { en: "Oroklini" } }, // a district this file does not list at all
    { district: { en: "Paphos" }, area: { en: "Kato Paphos" } }, // already listed — must not duplicate
    { district: { en: "Paphos" }, area: null }, // a listing with no area yet
    { district: null, area: { en: "Nowhere" } }, // no district → cannot be placed
  ];
  const out = areasWithFeed(feed);

  it("keeps everything this file lists", () => {
    for (const [district, list] of Object.entries(AREAS)) {
      for (const area of list) expect(out[district]).toContain(area);
    }
  });

  it("adds what the feed carries, under the right district, once, sorted", () => {
    expect(out.Paphos).toContain("Peyia");
    expect(out.Paphos.filter((a) => a === "Kato Paphos")).toHaveLength(1);
    expect(out.Larnaca).toEqual(["Oroklini"]);
    expect(out.Paphos).toEqual([...out.Paphos].sort((a, b) => a.localeCompare(b)));
  });

  it("ignores what it cannot place, and leaves AREAS itself untouched", () => {
    expect(JSON.stringify(out)).not.toContain("Nowhere");
    expect(AREAS.Paphos).not.toContain("Peyia");
    expect(AREAS).not.toHaveProperty("Larnaca");
  });

  it("is exactly AREAS when the feed is down", () => {
    expect(areasWithFeed([])).toEqual(AREAS);
  });
});

/**
 * Where the visitor came from (gnk-crm 0098, audit LR-02). The CRM's lead
 * carried no source page and no campaign — an Instagram ad, a Google search
 * and a portal click were one `website`. The site now remembers the campaign
 * parameters a visit LANDED with, for the session, and the enquiry names the
 * page it was sent from and the site that referred it. Three keys, capped,
 * nothing personal, and every storage access survives a browser that refuses
 * storage.
 */
describe("where the visitor came from", () => {
  const fakeStorage = () => {
    const m = new Map<string, string>();
    return {
      getItem: (k: string) => m.get(k) ?? null,
      setItem: (k: string, v: string) => {
        m.set(k, v);
      },
    };
  };

  it("reads only the three campaign keys from a landing URL, trimmed and capped", () => {
    expect(
      campaignFromSearch("?utm_source=instagram&utm_medium=paid&utm_campaign=spring&fbclid=abc&name=x"),
    ).toEqual({ utm_source: "instagram", utm_medium: "paid", utm_campaign: "spring" });
    expect(campaignFromSearch("?utm_source=" + "x".repeat(121))).toEqual({});
    expect(campaignFromSearch("?utm_source=%20%20")).toEqual({});
    expect(campaignFromSearch("")).toEqual({});
  });

  it("remembers a campaign for the session, and a later plain page does not forget it", () => {
    const s = fakeStorage();
    rememberCampaign("?utm_source=instagram&utm_campaign=spring", s);
    rememberCampaign("", s);
    rememberCampaign("?q=villa", s);
    expect(readCampaign(s)).toEqual({ utm_source: "instagram", utm_campaign: "spring" });
  });

  it("replaces the remembered campaign when a newer one arrives", () => {
    const s = fakeStorage();
    rememberCampaign("?utm_source=instagram", s);
    rememberCampaign("?utm_source=google&utm_medium=cpc", s);
    expect(readCampaign(s)).toEqual({ utm_source: "google", utm_medium: "cpc" });
  });

  it("reads nothing from a missing, throwing or corrupt storage, and never throws on write", () => {
    expect(readCampaign(null)).toEqual({});
    expect(
      readCampaign({
        getItem: () => {
          throw new Error("private mode");
        },
      }),
    ).toEqual({});
    expect(readCampaign({ getItem: () => "{not json" })).toEqual({});
    expect(readCampaign({ getItem: () => JSON.stringify({ utm_source: "x", name: "smuggled" }) })).toEqual({
      utm_source: "x",
    });
    expect(() =>
      rememberCampaign("?utm_source=x", {
        getItem: () => null,
        setItem: () => {
          throw new Error("quota");
        },
      }),
    ).not.toThrow();
  });

  it("names only an EXTERNAL referrer's host — the site's own pages are not a source", () => {
    expect(referrerHost("https://l.instagram.com/?u=abc", "gnk-web.vercel.app")).toBe("l.instagram.com");
    expect(referrerHost("https://gnk-web.vercel.app/properties", "gnk-web.vercel.app")).toBe("");
    expect(referrerHost("", "gnk-web.vercel.app")).toBe("");
    expect(referrerHost("not a url", "gnk-web.vercel.app")).toBe("");
  });

  it("carries a consent version the desk can cite", () => {
    expect(CONSENT_VERSION).toMatch(/^\d{4}-\d{2}-\d{2}$/);
  });
});
