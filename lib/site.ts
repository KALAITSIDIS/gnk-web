/**
 * Everything about the firm that is not a property, in one file.
 *
 * Deliberately not scattered through the pages: the two people who run this
 * business should be able to change a phone number, a service description or
 * a principal's biography by editing one file, without reading React.
 *
 * TODO markers are real gaps, not placeholders for their own sake. Each one is
 * something only the firm can supply, and each is rendered visibly as missing
 * rather than filled with something invented.
 */

/**
 * NOTE ON app/icon.svg — the browser-tab mark is a PLACEHOLDER.
 *
 * A single letterform in the accent colour, chosen because the alternative was
 * the browser's generic globe on every tab and bookmark. It is deliberately not
 * a logo: this file already records that the restrained palette is "the safest
 * possible host for a brand identity that does not exist yet". Replace it the
 * day one does, and nothing else needs to change.
 */
/* The firm's location in parts, so the footer's display string and the
   organisation JSON-LD (lib/jsonld.ts) derive from ONE source. The JSON-LD
   used to carry its own literals beside a comment saying it emitted no
   address at all. */
const locality = "Paphos";
const country = { name: "Cyprus", code: "CY" } as const;

export const site = {
  name: "GN Kalaitsidis Capital",
  shortName: "Kalaitsidis Capital",
  tagline: "Real estate advisory in Paphos, Cyprus",
  /** Their own words, from the site they are already running. */
  positioning:
    "Disciplined analysis, clear decision-making and hands-on execution across Cyprus real estate.",

  contact: {
    email: "info@kalaitsidis.com",
    phone: "+357 94 000015",
    phoneHref: "tel:+35794000015",
    whatsappHref: "https://wa.me/35794000015",
    locality,
    countryCode: country.code,
    city: `${locality}, ${country.name}`,
    /** TODO: the street address, once confirmed. The footer omits it until then. */
    street: null as string | null,
    hours: "Monday to Friday, 09:00–18:00",
  },

  /**
   * TODO: registration and licence numbers, pending with the Council.
   *
   * Until these exist the site describes ADVISORY work and never uses the
   * regulated phrase "registered and licensed real estate agent" (Real Estate
   * Agents Law 71(I)/2010). When they arrive, fill both and the footer line
   * appears on every page — nothing else needs to change.
   */
  registration: {
    registrationNo: null as string | null,
    licenceNo: null as string | null,
  },

  services: [
    {
      slug: "buyer-seller-advisory",
      name: "Buyer & Seller Advisory",
      summary:
        "Representation on one side of a transaction, with the analysis to support the position taken.",
      deliverables: [
        "A written view on price, with comparables",
        "Negotiation strategy and the walk-away point",
        "Coordination through to completion",
      ],
    },
    {
      slug: "investment-advisory",
      name: "Investment Advisory",
      summary:
        "Whether an asset earns its price, and what it is likely to do next.",
      deliverables: [
        "Yield and holding-cost modelling",
        "Comparative analysis against alternatives",
        "A recommendation with the reasoning attached",
      ],
    },
    {
      slug: "pricing-analytics",
      name: "Pricing Analytics",
      summary:
        "What a property should trade at, defensibly, rather than what someone hopes it will.",
      deliverables: [
        "A defensible price range with evidence",
        "Asking-versus-achieved analysis for the area",
        "€ per square metre against real comparables",
      ],
    },
    {
      slug: "development-support",
      name: "Development Support",
      summary:
        "Advice to owners and developers on what to build, at what specification, for whom.",
      deliverables: [
        "Site and scheme appraisal",
        "Unit mix and specification guidance",
        "Pricing and release strategy",
      ],
    },
    {
      slug: "deal-structuring",
      name: "Deal Structuring",
      summary:
        "How a transaction is put together — payment terms, timing and the risks each side carries.",
      deliverables: [
        "Payment and instalment structuring",
        "VAT and transfer-cost treatment",
        "Contract terms worth negotiating for",
      ],
    },
    {
      slug: "due-diligence",
      name: "Due Diligence",
      summary:
        "What the paperwork actually says, before money moves.",
      deliverables: [
        "Title deed and encumbrance review",
        "Planning and permit position",
        "A written risk memo",
      ],
    },
  ],

  /**
   * TODO: both principals. Names, real backgrounds, and a photograph each.
   *
   * This is the most valuable page on the site and the one thing that cannot
   * be written for them: across 35 Cyprus property sites researched, almost
   * none names a single human being. Two named people with real histories is
   * an unoccupied position in this market.
   */
  principals: [
    {
      // Null, not a TODO string: a placeholder that is truthy renders, and both
      // of these were being served to the public as the principals' names and
      // as <h3> headings in the About page's document outline. Null lets the
      // pages say "to follow" the way they already do for bio and photograph.
      name: null as string | null,
      role: null as string | null,
      bio: null as string | null,
      photo: null as string | null,
      phone: null as string | null,
      email: null as string | null,
    },
    {
      name: null as string | null,
      role: null as string | null,
      bio: null as string | null,
      photo: null as string | null,
      phone: null as string | null,
      email: null as string | null,
    },
  ],
} as const;

export const nav = [
  { href: "/properties", label: "Properties" },
  // An owner deciding who to instruct had no route in: every other item here
  // addresses a buyer. Mandates are the revenue.
  { href: "/selling", label: "Selling" },
  { href: "/services", label: "Advisory" },
  { href: "/valuation", label: "Valuation" },
  { href: "/about", label: "About" },
  { href: "/contact", label: "Contact" },
] as const;
