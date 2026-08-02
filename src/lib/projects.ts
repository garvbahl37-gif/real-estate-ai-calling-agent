import type { Project } from "./types";

/**
 * SAMPLE / FICTIONAL PROJECT CATALOGUE
 * ------------------------------------
 * "Aarambh Realty" and every project below are invented for this demo.
 * The RERA numbers are placeholders and are NOT real registrations.
 * No confidential or proprietary developer data is used anywhere in this repo.
 *
 * Four projects deliberately span very different budgets and property types so
 * the agent has something genuine to do when a caller changes their budget or
 * preferred location mid-conversation.
 */

const CR = 10_000_000;
const L = 100_000;

export const PROJECTS: Project[] = [
  {
    id: "skyline-greens",
    name: "Aarambh Skyline Greens",
    developer: "Aarambh Realty",
    tagline: "3-side open towers on the Noida Expressway, wrapped in 8 acres of green.",
    city: "Noida",
    locality: "Sector 150",
    microMarket: "Noida Expressway",
    propertyType: "apartment",
    status: "under_construction",
    reraId: "UPRERAPRJ-DEMO-150001",
    possession: "Phase 1 (Towers A & B): December 2027 · Phase 2 (Towers C & D): June 2028",
    priceRangeLabel: "₹95 Lakh – ₹2.8 Crore",
    priceMinInr: 95 * L,
    priceMaxInr: 2.8 * CR,
    bookingAmountInr: 5 * L,
    units: [
      {
        configuration: "2BHK",
        carpetAreaSqft: 745,
        saleableAreaSqft: 1150,
        priceMinInr: 95 * L,
        priceMaxInr: 1.15 * CR,
        available: true,
      },
      {
        configuration: "3BHK",
        carpetAreaSqft: 1080,
        saleableAreaSqft: 1650,
        priceMinInr: 1.35 * CR,
        priceMaxInr: 1.65 * CR,
        available: true,
      },
      {
        configuration: "3BHK+S",
        carpetAreaSqft: 1240,
        saleableAreaSqft: 1890,
        priceMinInr: 1.75 * CR,
        priceMaxInr: 1.95 * CR,
        available: true,
      },
      {
        configuration: "4BHK",
        carpetAreaSqft: 1610,
        saleableAreaSqft: 2450,
        priceMinInr: 2.4 * CR,
        priceMaxInr: 2.8 * CR,
        available: true,
      },
    ],
    amenities: [
      "45,000 sq ft clubhouse",
      "Olympic-length swimming pool + kids' pool",
      "7-a-side football turf",
      "Indoor badminton & squash courts",
      "Fully equipped gym and yoga deck",
      "Co-working lounge and business centre",
      "Amphitheatre and party lawn",
      "Dedicated kids' play zone and creche",
      "EV charging bays on every basement level",
      "80% open landscaped area",
      "3-tier security with boom barriers and CCTV",
      "Rainwater harvesting and STP",
    ],
    locationAdvantages: [
      { label: "Noida–Greater Noida Expressway", distance: "5 min drive" },
      { label: "Aqua Line Metro (Sector 148 station)", distance: "~10 min" },
      { label: "Advant / Oxygen Business Park", distance: "15 min" },
      { label: "Noida Jewar International Airport", distance: "~35 min" },
      { label: "Shiv Nadar & Amity University", distance: "20–25 min" },
      { label: "Yamuna Expressway entry", distance: "12 min" },
      { label: "Proposed Sector 150 sports city & golf course", distance: "Adjacent" },
    ],
    paymentPlans: [
      "10:80:10 subvention-style plan (10% booking, 80% on bank disbursal, 10% on possession)",
      "Construction Linked Plan (CLP)",
      "Down payment plan with additional discount",
    ],
    usps: [
      "Sector 150 is the lowest-density sector in Noida — roughly 80% of it is reserved as green/sports area",
      "Only 4 apartments per floor, all 3-side open",
      "Under-construction inventory means lower entry price than ready stock in Sector 128/135",
    ],
    bestFor: ["self_use", "investment", "both"],
    pitchHinglish:
      "Sector 150 Noida ka sabse green sector hai — 80 percent area sports aur greenery ke liye reserved hai. Skyline Greens mein sirf 4 flats per floor hain, teenon side se open, aur Expressway sirf 5 minute door hai.",
  },
  {
    id: "riverfront-residences",
    name: "Aarambh Riverfront Residences",
    developer: "Aarambh Realty",
    tagline: "Low-density luxury with uninterrupted golf-course and river views.",
    city: "Noida",
    locality: "Sector 128",
    microMarket: "Noida Expressway (Premium)",
    propertyType: "apartment",
    status: "ready_to_move",
    reraId: "UPRERAPRJ-DEMO-128007",
    possession: "Ready to move — OC received, immediate registry possible",
    priceRangeLabel: "₹3.2 Crore – ₹6.5 Crore",
    priceMinInr: 3.2 * CR,
    priceMaxInr: 6.5 * CR,
    bookingAmountInr: 15 * L,
    units: [
      {
        configuration: "3BHK",
        carpetAreaSqft: 1720,
        saleableAreaSqft: 2600,
        priceMinInr: 3.2 * CR,
        priceMaxInr: 3.8 * CR,
        available: true,
      },
      {
        configuration: "4BHK",
        carpetAreaSqft: 2380,
        saleableAreaSqft: 3550,
        priceMinInr: 4.4 * CR,
        priceMaxInr: 5.2 * CR,
        available: true,
      },
      {
        configuration: "5BHK",
        carpetAreaSqft: 3150,
        saleableAreaSqft: 4700,
        priceMinInr: 5.9 * CR,
        priceMaxInr: 6.5 * CR,
        available: false,
      },
    ],
    amenities: [
      "Private 9-hole golf course access",
      "Riverside jogging and cycling trail",
      "Temperature-controlled infinity pool",
      "Spa, salon and steam/sauna",
      "Private theatre and cigar lounge",
      "Concierge and valet parking",
      "Fine-dining restaurant within the complex",
      "Helipad-ready podium (approval pending)",
      "5-tier security with facial recognition",
    ],
    locationAdvantages: [
      { label: "DND Flyway to South Delhi", distance: "20 min" },
      { label: "Botanical Garden Metro (Blue + Magenta)", distance: "12 min" },
      { label: "Sector 18 Atta Market / DLF Mall of India", distance: "15 min" },
      { label: "Okhla Bird Sanctuary Metro", distance: "10 min" },
      { label: "Jaypee Hospital", distance: "8 min" },
    ],
    paymentPlans: ["100% down payment with 6% discount", "Ready-to-move: bank loan disbursed in one tranche"],
    usps: [
      "Ready to move with OC — no construction risk, no GST on purchase",
      "Only 2 apartments per floor",
      "Rental yield in this pocket has historically been 2.8–3.2% (past performance, not a guarantee)",
    ],
    bestFor: ["self_use", "both"],
    pitchHinglish:
      "Riverfront Residences ready-to-move hai, OC aa chuka hai, matlab GST nahi lagega aur registry turant ho sakti hai. Har floor pe sirf do apartments, aur golf course ka direct view milta hai.",
  },
  {
    id: "urbania",
    name: "Aarambh Urbania",
    developer: "Aarambh Realty",
    tagline: "Smart, compact homes for first-time buyers in Greater Noida West.",
    city: "Greater Noida West",
    locality: "Sector 16B, Noida Extension",
    microMarket: "Greater Noida West",
    propertyType: "apartment",
    status: "new_launch",
    reraId: "UPRERAPRJ-DEMO-GNW0042",
    possession: "March 2029 (new launch — construction begins Q4 2026)",
    priceRangeLabel: "₹45 Lakh – ₹95 Lakh",
    priceMinInr: 45 * L,
    priceMaxInr: 95 * L,
    bookingAmountInr: 2 * L,
    units: [
      {
        configuration: "1BHK",
        carpetAreaSqft: 420,
        saleableAreaSqft: 650,
        priceMinInr: 45 * L,
        priceMaxInr: 52 * L,
        available: true,
      },
      {
        configuration: "2BHK",
        carpetAreaSqft: 610,
        saleableAreaSqft: 950,
        priceMinInr: 58 * L,
        priceMaxInr: 72 * L,
        available: true,
      },
      {
        configuration: "3BHK",
        carpetAreaSqft: 850,
        saleableAreaSqft: 1290,
        priceMinInr: 78 * L,
        priceMaxInr: 95 * L,
        available: true,
      },
    ],
    amenities: [
      "18,000 sq ft clubhouse",
      "Swimming pool and kids' splash pad",
      "Multipurpose sports court",
      "Jogging track around central green",
      "Retail high street within the township",
      "Power backup for common areas + 1KVA per home",
      "Gated community with CCTV",
    ],
    locationAdvantages: [
      { label: "Proposed Metro extension (Sector 16B stop)", distance: "Planned, ~5 min" },
      { label: "Gaur City Mall / Grand Venice Mall", distance: "10–15 min" },
      { label: "FNG Expressway", distance: "8 min" },
      { label: "Noida Sector 62 IT hub", distance: "25 min" },
      { label: "Kailash & Yatharth Hospitals", distance: "12 min" },
    ],
    paymentPlans: [
      "Launch-phase CLP with 5% booking",
      "PMAY-eligible units available (subject to applicant eligibility)",
      "10:90 plan for the first 100 bookings",
    ],
    usps: [
      "Lowest entry ticket in the portfolio — good for a first home or a smaller investment",
      "New-launch pricing, so the per-sq-ft rate is below surrounding resale inventory",
      "Larger balconies than typical Noida Extension stock",
    ],
    bestFor: ["self_use", "investment", "both"],
    pitchHinglish:
      "Urbania first-time buyers ke liye best hai — 45 lakh se start hoti hai, new launch pricing hai isliye rate aas-paas ke resale se kam hai, aur PMAY ka option bhi available hai agar aap eligible hain.",
  },
  {
    id: "green-acres",
    name: "Aarambh Green Acres",
    developer: "Aarambh Realty",
    tagline: "Registry-ready residential plots on the Yamuna Expressway, near Jewar Airport.",
    city: "Greater Noida",
    locality: "Yamuna Expressway, Sector 22D",
    microMarket: "Jewar Airport Belt",
    propertyType: "plot",
    status: "ready_to_move",
    reraId: "UPRERAPRJ-DEMO-YEX0311",
    possession: "Immediate registry and possession",
    priceRangeLabel: "₹38 Lakh – ₹1.4 Crore",
    priceMinInr: 38 * L,
    priceMaxInr: 1.4 * CR,
    bookingAmountInr: 3 * L,
    units: [
      {
        configuration: "plot",
        carpetAreaSqft: 900, // 100 sq yd
        saleableAreaSqft: 900,
        priceMinInr: 38 * L,
        priceMaxInr: 46 * L,
        available: true,
      },
      {
        configuration: "plot",
        carpetAreaSqft: 1800, // 200 sq yd
        saleableAreaSqft: 1800,
        priceMinInr: 72 * L,
        priceMaxInr: 88 * L,
        available: true,
      },
      {
        configuration: "plot",
        carpetAreaSqft: 2700, // 300 sq yd
        saleableAreaSqft: 2700,
        priceMinInr: 1.1 * CR,
        priceMaxInr: 1.4 * CR,
        available: true,
      },
    ],
    amenities: [
      "Gated plotted township with boundary wall",
      "40 ft and 60 ft internal roads",
      "Underground electricity and water lines",
      "Central park and community centre",
      "24x7 security",
    ],
    locationAdvantages: [
      { label: "Noida International Airport, Jewar", distance: "15 min" },
      { label: "Yamuna Expressway access", distance: "2 min" },
      { label: "Proposed Film City site", distance: "20 min" },
      { label: "Buddh International Circuit", distance: "25 min" },
      { label: "Proposed Pod Taxi corridor", distance: "Planned along YEX" },
    ],
    paymentPlans: ["Full down payment with registry in 30 days", "50:50 plan over 6 months"],
    usps: [
      "Freehold, registry-ready — you own the land outright",
      "Plots historically appreciate on infrastructure milestones; Jewar Airport is the key trigger here",
      "You can build to your own design within the approved FAR",
    ],
    bestFor: ["investment", "both"],
    pitchHinglish:
      "Green Acres Yamuna Expressway pe plotted township hai, Jewar Airport sirf 15 minute door. Registry-ready hai, matlab aap turant apne naam karwa sakte hain aur apni marzi ka ghar bana sakte hain.",
  },
];

export function getProject(id: string): Project | undefined {
  return PROJECTS.find((p) => p.id === id);
}

/** Human-friendly Indian currency formatting: 9500000 -> "₹95 Lakh". */
export function formatInr(amount: number): string {
  if (amount >= CR) {
    const cr = amount / CR;
    return `₹${cr % 1 === 0 ? cr.toFixed(0) : cr.toFixed(2).replace(/0$/, "")} Crore`;
  }
  if (amount >= L) {
    const lakh = amount / L;
    return `₹${lakh % 1 === 0 ? lakh.toFixed(0) : lakh.toFixed(1)} Lakh`;
  }
  return `₹${amount.toLocaleString("en-IN")}`;
}

/**
 * Rendered into the agent's system instruction. Kept terse on purpose — a
 * speech-to-speech model does noticeably worse when the prompt is bloated,
 * so this is the shortest form that still answers the questions a buyer asks.
 */
export function projectsAsPromptContext(): string {
  return PROJECTS.map((p) => {
    const units = p.units
      .map(
        (u) =>
          `    - ${u.configuration} · ${u.saleableAreaSqft} sq ft · ${formatInr(u.priceMinInr)}–${formatInr(
            u.priceMaxInr,
          )}${u.available ? "" : " (SOLD OUT)"}`,
      )
      .join("\n");
    const loc = p.locationAdvantages.map((l) => `${l.label} (${l.distance})`).join("; ");
    return `### ${p.name} [id: ${p.id}]
  Developer: ${p.developer} | ${p.locality}, ${p.city} | ${p.microMarket}
  Type: ${p.propertyType} | Status: ${p.status.replace(/_/g, " ")} | RERA: ${p.reraId}
  Price band: ${p.priceRangeLabel} | Booking amount: ${formatInr(p.bookingAmountInr)}
  Possession: ${p.possession}
  Units:
${units}
  Amenities: ${p.amenities.join(", ")}
  Location advantages: ${loc}
  Payment plans: ${p.paymentPlans.join(" | ")}
  Why buyers pick it: ${p.usps.join(" | ")}
  Spoken Hinglish pitch: "${p.pitchHinglish}"`;
  }).join("\n\n");
}
