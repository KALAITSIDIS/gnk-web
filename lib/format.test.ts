import { describe, expect, it } from "vitest";
import type { Listing } from "@/lib/crm";
import {
  constructionLabel,
  coverImage,
  deliveryLabel,
  floorLabel,
  isContainer,
  placeLine,
  priceLabel,
  pricePerSqm,
  storeysLabel,
  vatLabel,
  yearBuiltLabel,
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

describe("a unit of a development is whatever its TYPE says it is", () => {
  // In the CRM kind = "unit" means "a child of a project" and nothing more —
  // it generates villa units on purpose (generateVillaUnits writes
  // floor_number null, "they do not stack"). The site read kind = "unit" as
  // "occupies a floor of a building", so a villa in a development whose Floor
  // and Total floors were typed the way PAF0001's were (2 and 2) would have
  // published "Floor 2 of 2" — the sentence floorLabel exists to stop.
  it("gives a villa unit its storeys, never a floor position", () => {
    const villaUnit = { ...villa, reference: "PAF0002-V01", kind: "unit" } as Listing;
    expect(floorLabel(villaUnit)).toBeNull();
    expect(storeysLabel(villaUnit)).toBe("2");
  });

  it("still gives an apartment — unit or not — its position and no storey count", () => {
    // The stacked case, which had no fixture at all.
    const flat = {
      ...villa,
      reference: "PAF0010",
      property_type: "apartment",
      floor_number: 3,
      total_floors: 5,
    } as Listing;
    expect(floorLabel(flat)).toBe("3 of 5");
    expect(storeysLabel(flat)).toBeNull();
    expect(floorLabel({ ...flat, kind: "unit" } as Listing)).toBe("3 of 5");
  });
});

describe("year built is a fact about one building", () => {
  it("is withheld on a development, whose year the CRM never connects to its units", () => {
    // The fixture's year is null, as PAF0002's is — so set one to prove the
    // gate and not the gap.
    expect(yearBuiltLabel({ ...development, year_built: 2020 } as Listing)).toBeNull();
    expect(yearBuiltLabel({ ...development, kind: "phase", year_built: 2020 } as Listing)).toBeNull();
  });

  it("renders for a dwelling", () => {
    expect(yearBuiltLabel(villa)).toBe("2007");
    expect(yearBuiltLabel({ ...villa, year_built: null } as Listing)).toBeNull();
  });
});

describe("the cover photograph is the first one the feed sends", () => {
  /* The feed's images carry NO cover flag — exactly {alt, card, full, thumb,
     watermarked} — and the CRM puts the cover FIRST (public_listings orders
     is_cover desc, sort_order, created_at; gnk-crm RLS test 49 pins both
     halves). That test catches the feed changing; this one pins that the site
     reads the contract as written rather than a field it invented — for six
     days it read `is_cover`, which the feed has never sent, and was right by
     accident. */
  const img = (card: string) => ({ card, thumb: null, full: null, alt: null });

  it("reads element 0", () => {
    const l = { ...villa, images: [img("cover.webp"), img("second.webp")] } as unknown as Listing;
    expect(coverImage(l)?.card).toBe("cover.webp");
  });

  it("is not moved by a stray flag on a later image — there is no flag to read", () => {
    // The exact regression: someone re-adding `.find((i) => i.is_cover)`.
    const stray = { ...img("second.webp"), is_cover: true };
    const l = { ...villa, images: [img("cover.webp"), stray] } as unknown as Listing;
    expect(coverImage(l)?.card).toBe("cover.webp");
  });

  it("is null with no photographs, so the page can say 'Photography to follow'", () => {
    expect(coverImage({ ...villa, images: [] } as unknown as Listing)).toBeNull();
    expect(coverImage({ ...villa, images: null } as unknown as Listing)).toBeNull();
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
