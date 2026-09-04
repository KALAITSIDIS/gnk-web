/**
 * The adviser's own view on a property, written by the person who holds the
 * mandate. Keyed on the CRM reference.
 *
 * WHY THIS FILE EXISTS. The listing page used to head the feed's
 * `short_description` "Our view", and the home page promises "Every property on
 * this site carries a written view. If you cannot see the reasoning, do not act
 * on the number." Those two things were not the same thing. On PAF0003 the
 * block headed "Our view" was the FIRST SENTENCE, verbatim, of the paragraph
 * printed directly beneath it — "Prime residential land in the prestigious Sea
 * Caves area... excellent development potential", which is the portal register
 * this firm defines itself against. On PAF0001 it was a beds/baths/m² recap
 * that also serves as the meta description, so the duplication showed in search
 * results and in every shared link.
 *
 * A judgement is the one thing a portal structurally cannot produce, so
 * claiming one where none exists costs more than saying nothing. The page now
 * renders this block ONLY for a reference that appears below, and otherwise
 * presents the feed's summary as a summary.
 *
 * These are written by the principals. Nothing generates them, and nothing may
 * infer them from the listing data — a note that merely restates the
 * specification is what this file was built to stop.
 */
export const adviserViews: Record<string, string> = {
  // PAF0001: awaiting the note from the principal who holds the mandate.
  // PAF0003: awaiting the note from the principal who holds the mandate.
};

export function adviserView(reference: string): string | null {
  return adviserViews[reference.toUpperCase()]?.trim() || null;
}
