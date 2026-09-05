import { describe, expect, it } from "vitest";
import {
  assembleMessage,
  CRM_MESSAGE_CAP,
  describeProperty,
  describeRequirement,
  FIELD_CAPS,
  messageBudget,
  SELLER_KEYS,
  BUYER_KEYS,
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
