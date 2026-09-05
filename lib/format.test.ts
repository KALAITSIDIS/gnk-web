import { describe, expect, it } from "vitest";
import type { Listing } from "@/lib/crm";
import {
  constructionLabel,
  deliveryLabel,
  floorLabel,
  isContainer,
  placeLine,
  priceLabel,
  pricePerSqm,
  storeysLabel,
  vatLabel,
} from "./format";

/**
 * These functions decide whether a fact reaches a buyer.
 *
 * Every one of them exists because the site published something untrue: a 2007
 * villa shown as still in finishing with a delivery date fourteen months out, a
 * VAT status contradicting the page's own description, a detached house on
 * "Floor 2 of 2", and a six-villa development about to state four wrong figures
 * and a meaningless €/m².
 *
 * The last of those is the reason this file exists at all. No development has
 * ever been published, so its rendering could not be checked by looking at a
 * page — and the CRM's quality gate scores that record 100/100, because the gate
 * measures whether fields are filled and not whether they are true. Nothing but
 * a test stands behind it.
 */

/** PAF0002 as it actually is: a project whose own fields describe no dwelling. */
const development = {
  reference: "PAF0002",
  kind: "project",
  property_type: "villa",
  transaction_type: "sale",
  asking_price: 800000,
  rent_price_month: null,
  bedrooms: 5,
  bathrooms: 5,
  covered_area_sqm: 300,
  year_built: null,
  construction_status: "finishing",
  delivery_date: "2099-10-01",
  vat_status: "unknown",
  floor_number: null,
  total_floors: null,
} as unknown as Listing;

/** PAF0001 as it actually is: a completed resale villa. */
const villa = {
  reference: "PAF0001",
  kind: "standalone",
  property_type: "villa",
  transaction_type: "sale",
  asking_price: 450000,
  rent_price_month: null,
  bedrooms: 3,
  bathrooms: 3,
  covered_area_sqm: 185,
  year_built: 2007,
  construction_status: "finishing",
  delivery_date: "2026-11-29",
  vat_status: "reduced_rate_eligible",
  floor_number: 2,
  total_floors: 2,
} as unknown as Listing;

describe("a development is not a dwelling", () => {
  it("prices FROM, because its units carry the real prices", () => {
    expect(priceLabel(development)).toBe("from €800,000");
    expect(priceLabel(villa)).toBe("€450,000");
  });

  it("refuses a €/m² built from two numbers about different objects", () => {
    // 800000 / 300 would render €2,666/m² and describe nothing that exists.
    expect(pricePerSqm(development)).toBeNull();
    expect(pricePerSqm(villa)).not.toBeNull();
  });

  it("has no floor and no storey count", () => {
    expect(floorLabel(development)).toBeNull();
    expect(storeysLabel(development)).toBeNull();
  });

  it("still says what IS true of it — that it is being built", () => {
    expect(isContainer(development)).toBe(true);
    expect(constructionLabel(development)).toBe("Finishing");
    expect(deliveryLabel(development)).toBe("1 October 2099");
  });
});

describe("the line a buyer scans says which of the two it is", () => {
  const where = { area: { en: "Peyia" }, district: { en: "Paphos" } };

  it("calls a development a development", () => {
    // Withholding the beds and the areas, and pricing "from", left the detail
    // page reading "Villa in Peyia, Paphos" over a table with no bedrooms —
    // one villa with missing data. The card had a badge; the page, which is
    // where a shared link and a search result land, had nothing.
    const l = { ...development, ...where } as unknown as Listing;
    expect(placeLine(l)).toBe("Villa development in Peyia, Paphos");
  });

  it("leaves a dwelling alone", () => {
    const l = { ...villa, ...where } as unknown as Listing;
    expect(placeLine(l)).toBe("Villa in Peyia, Paphos");
  });

  it("says it of a phase too, which is a container by the same rule", () => {
    const l = { ...development, ...where, kind: "phase" } as unknown as Listing;
    expect(placeLine(l)).toBe("Villa development in Peyia, Paphos");
  });

  it("does not pluralise, so land and plots still read as English", () => {
    const l = { ...development, ...where, property_type: "land" } as unknown as Listing;
    expect(placeLine(l)).toBe("Land development in Peyia, Paphos");
  });
});

describe("a completed resale states nothing about being built", () => {
  it("suppresses construction and delivery once a year built is recorded", () => {
    // PAF0001 carried construction_status "finishing" and a Nov 2026 delivery
    // on a house standing since 2007. A recorded year built is the check that
    // catches stale data rather than trusting it.
    expect(constructionLabel(villa)).toBeNull();
    expect(deliveryLabel(villa)).toBeNull();
  });

  it("is not on a floor of anything", () => {
    // "2 of 2" read as a second-floor apartment under an H1 saying "villa".
    expect(floorLabel(villa)).toBeNull();
    expect(storeysLabel(villa)).toBe("2");
  });
});

describe("VAT is published only where the property settles it", () => {
  it("withholds a claim that turns on the buyer, not the dwelling", () => {
    expect(vatLabel("reduced_rate_eligible")).toBeNull();
  });

  it("never leaks the internal sentinel", () => {
    // "VAT — Unknown" was live on PAF0003.
    expect(vatLabel("unknown")).toBeNull();
    expect(vatLabel(null)).toBeNull();
  });

  it("publishes the two that ARE facts about the property", () => {
    expect(vatLabel("resale_no_vat")).toBe("Resale — no VAT on the purchase");
    expect(vatLabel("new_vat")).toBe("New build — VAT applies");
  });
});

describe("a delivery date is a promise, so it is only made when it can be kept", () => {
  it("is withheld once it is in the past, however the record reads", () => {
    const overdue = { ...development, delivery_date: "2020-01-01" } as Listing;
    expect(deliveryLabel(overdue)).toBeNull();
  });

  it("survives an unparseable date without rendering NaN", () => {
    const bad = { ...development, delivery_date: "not a date" } as Listing;
    expect(deliveryLabel(bad)).toBeNull();
  });
});

describe("land", () => {
  it("has no construction, no storeys and no floor", () => {
    const land = {
      ...villa,
      reference: "PAF0003",
      property_type: "land",
      year_built: null,
      construction_status: "planning",
    } as Listing;
    expect(constructionLabel(land)).toBeNull();
    expect(storeysLabel(land)).toBeNull();
    expect(floorLabel(land)).toBeNull();
  });
});
