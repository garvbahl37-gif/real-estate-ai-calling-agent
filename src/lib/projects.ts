import type { Project } from "./types";

/**
 * SAMPLE / FICTIONAL PROJECT CATALOGUE
 * ------------------------------------
 * "Aarambh Realty" and every project below are invented for this demo.
 * The RERA numbers are placeholders and are NOT real registrations.
 * No confidential or proprietary developer data is used anywhere in this repo.
 *
 * Fifteen projects, deliberately spread across the Noida – Greater Noida –
 * Yamuna Expressway – Ghaziabad corridor and across ₹28 Lakh to ₹15 Crore, so
 * that changing a budget, a location or a property type mid-call genuinely
 * changes what the agent recommends rather than re-pitching the same thing.
 */

const CR = 10_000_000;
const L = 100_000;

export const PROJECTS: Project[] = [
  /* ---------------------------------------------------------------- */
  /* Noida                                                             */
  /* ---------------------------------------------------------------- */
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
      { configuration: "2BHK", carpetAreaSqft: 745, saleableAreaSqft: 1150, priceMinInr: 95 * L, priceMaxInr: 1.15 * CR, available: true },
      { configuration: "3BHK", carpetAreaSqft: 1080, saleableAreaSqft: 1650, priceMinInr: 1.35 * CR, priceMaxInr: 1.65 * CR, available: true },
      { configuration: "3BHK+S", carpetAreaSqft: 1240, saleableAreaSqft: 1890, priceMinInr: 1.75 * CR, priceMaxInr: 1.95 * CR, available: true },
      { configuration: "4BHK", carpetAreaSqft: 1610, saleableAreaSqft: 2450, priceMinInr: 2.4 * CR, priceMaxInr: 2.8 * CR, available: true },
    ],
    amenities: [
      "45,000 sq ft clubhouse",
      "Olympic-length swimming pool + kids' pool",
      "7-a-side football turf",
      "Indoor badminton & squash courts",
      "Fully equipped gym and yoga deck",
      "Co-working lounge and business centre",
      "Amphitheatre and party lawn",
      "Kids' play zone and creche",
      "EV charging on every basement level",
      "80% open landscaped area",
      "3-tier security with boom barriers and CCTV",
      "Rainwater harvesting and STP",
    ],
    locationAdvantages: [
      { label: "Noida–Greater Noida Expressway", distance: "5 min drive" },
      { label: "Aqua Line Metro (Sector 148)", distance: "~10 min" },
      { label: "Advant / Oxygen Business Park", distance: "15 min" },
      { label: "Noida International Airport, Jewar", distance: "~35 min" },
      { label: "Shiv Nadar & Amity University", distance: "20–25 min" },
      { label: "Proposed Sector 150 sports city & golf course", distance: "Adjacent" },
    ],
    paymentPlans: [
      "10:80:10 subvention-style plan (10% booking, 80% on bank disbursal, 10% on possession)",
      "Construction Linked Plan (CLP)",
      "Down payment plan with additional discount",
    ],
    usps: [
      "Sector 150 is the lowest-density sector in Noida — roughly 80% is reserved as green and sports area",
      "Only 4 apartments per floor, all 3-side open",
      "Under-construction pricing sits below ready stock in Sector 128 and 135",
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
      { configuration: "3BHK", carpetAreaSqft: 1720, saleableAreaSqft: 2600, priceMinInr: 3.2 * CR, priceMaxInr: 3.8 * CR, available: true },
      { configuration: "4BHK", carpetAreaSqft: 2380, saleableAreaSqft: 3550, priceMinInr: 4.4 * CR, priceMaxInr: 5.2 * CR, available: true },
      { configuration: "5BHK", carpetAreaSqft: 3150, saleableAreaSqft: 4700, priceMinInr: 5.9 * CR, priceMaxInr: 6.5 * CR, available: false },
    ],
    amenities: [
      "Private 9-hole golf course access",
      "Riverside jogging and cycling trail",
      "Temperature-controlled infinity pool",
      "Spa, salon, steam and sauna",
      "Private theatre and cigar lounge",
      "Concierge and valet parking",
      "Fine-dining restaurant within the complex",
      "5-tier security with facial recognition",
    ],
    locationAdvantages: [
      { label: "DND Flyway to South Delhi", distance: "20 min" },
      { label: "Botanical Garden Metro (Blue + Magenta)", distance: "12 min" },
      { label: "DLF Mall of India / Sector 18", distance: "15 min" },
      { label: "Jaypee Hospital", distance: "8 min" },
    ],
    paymentPlans: ["100% down payment with 6% discount", "Ready-to-move: bank loan disbursed in one tranche"],
    usps: [
      "Ready to move with OC — no construction risk and no GST on purchase",
      "Only 2 apartments per floor",
      "Rental yield in this pocket has historically been 2.8–3.2% (past performance, not a guarantee)",
    ],
    bestFor: ["self_use", "both"],
    pitchHinglish:
      "Riverfront Residences ready-to-move hai, OC aa chuka hai, matlab GST nahi lagega aur registry turant ho sakti hai. Har floor pe sirf do apartments, aur golf course ka direct view milta hai.",
  },
  {
    id: "villa-grande",
    name: "Aarambh Villa Grande",
    developer: "Aarambh Realty",
    tagline: "Independent villas with private lawns, inside a gated 22-acre estate.",
    city: "Noida",
    locality: "Sector 151",
    microMarket: "Noida Expressway",
    propertyType: "villa",
    status: "under_construction",
    reraId: "UPRERAPRJ-DEMO-151022",
    possession: "Phase 1: September 2027 · Phase 2: March 2028",
    priceRangeLabel: "₹4.5 Crore – ₹7.8 Crore",
    priceMinInr: 4.5 * CR,
    priceMaxInr: 7.8 * CR,
    bookingAmountInr: 20 * L,
    units: [
      { configuration: "4BHK", carpetAreaSqft: 2900, saleableAreaSqft: 3600, priceMinInr: 4.5 * CR, priceMaxInr: 5.4 * CR, available: true },
      { configuration: "5BHK", carpetAreaSqft: 3850, saleableAreaSqft: 4800, priceMinInr: 6.2 * CR, priceMaxInr: 7.8 * CR, available: true },
    ],
    amenities: [
      "Private lawn and terrace with every villa",
      "Provision for a private plunge pool",
      "Estate clubhouse with pool and gym",
      "Golf putting green",
      "Dedicated servant quarters",
      "4-car covered parking",
      "Underground utilities — no overhead cabling",
      "24x7 estate security with patrolling",
    ],
    locationAdvantages: [
      { label: "Noida–Greater Noida Expressway", distance: "7 min" },
      { label: "Sector 150 sports city", distance: "5 min" },
      { label: "Noida International Airport, Jewar", distance: "30 min" },
      { label: "Aqua Line Metro (Sector 148)", distance: "12 min" },
    ],
    paymentPlans: ["Construction Linked Plan", "40:60 plan", "Down payment with 5% discount"],
    usps: [
      "Land ownership with the villa, not just an apartment share",
      "Only 84 villas on 22 acres",
      "Ceiling height of 11 ft on the ground floor",
    ],
    bestFor: ["self_use", "both"],
    pitchHinglish:
      "Villa Grande mein aapko independent villa milta hai apne private lawn ke saath, aur land ownership bhi. Sirf 84 villas hain 22 acre mein, toh density bahut kam hai.",
  },
  {
    id: "studio-one",
    name: "Aarambh Studio One",
    developer: "Aarambh Realty",
    tagline: "Compact studios built for rental yield, beside the Noida IT belt.",
    city: "Noida",
    locality: "Sector 140A",
    microMarket: "Noida Expressway",
    propertyType: "apartment",
    status: "ready_to_move",
    reraId: "UPRERAPRJ-DEMO-140A09",
    possession: "Ready to move — possession within 30 days of registry",
    priceRangeLabel: "₹28 Lakh – ₹48 Lakh",
    priceMinInr: 28 * L,
    priceMaxInr: 48 * L,
    bookingAmountInr: 1 * L,
    units: [
      { configuration: "1BHK", carpetAreaSqft: 295, saleableAreaSqft: 450, priceMinInr: 28 * L, priceMaxInr: 34 * L, available: true },
      { configuration: "1BHK", carpetAreaSqft: 410, saleableAreaSqft: 620, priceMinInr: 38 * L, priceMaxInr: 48 * L, available: true },
    ],
    amenities: [
      "Fully furnished — bed, wardrobe, kitchenette, AC",
      "Managed rental programme (optional)",
      "Rooftop cafe and lounge",
      "Compact gym",
      "High-speed fibre in every unit",
      "Power backup and lift",
      "Housekeeping available on subscription",
    ],
    locationAdvantages: [
      { label: "Advant Navis Business Park", distance: "6 min" },
      { label: "Oxygen Business Park", distance: "9 min" },
      { label: "Aqua Line Metro (Sector 142)", distance: "8 min" },
      { label: "Noida–Greater Noida Expressway", distance: "3 min" },
    ],
    paymentPlans: ["Down payment with 4% discount", "50:50 plan", "Bank loan up to 75% of value"],
    usps: [
      "Lowest entry ticket in the portfolio",
      "Sold furnished, so it can be let out immediately",
      "Walking distance to two large business parks — the tenant pool is IT staff",
    ],
    bestFor: ["investment"],
    pitchHinglish:
      "Studio One 28 lakh se start hoti hai aur fully furnished milti hai, toh aap turant rent pe laga sakte hain. Advant aur Oxygen business park paas mein hain, tenants ki kami nahi hoti.",
  },
  {
    id: "corporate-square",
    name: "Aarambh Corporate Square",
    developer: "Aarambh Realty",
    tagline: "Grade-A offices and high-street retail in Noida's established business sector.",
    city: "Noida",
    locality: "Sector 62",
    microMarket: "Noida Central",
    propertyType: "commercial",
    status: "ready_to_move",
    reraId: "UPRERAPRJ-DEMO-062114",
    possession: "Ready to move — fit-out can begin immediately",
    priceRangeLabel: "₹55 Lakh – ₹3.5 Crore",
    priceMinInr: 55 * L,
    priceMaxInr: 3.5 * CR,
    bookingAmountInr: 5 * L,
    units: [
      { configuration: "shop", carpetAreaSqft: 220, saleableAreaSqft: 320, priceMinInr: 55 * L, priceMaxInr: 95 * L, available: true },
      { configuration: "office", carpetAreaSqft: 480, saleableAreaSqft: 700, priceMinInr: 1.1 * CR, priceMaxInr: 1.6 * CR, available: true },
      { configuration: "office", carpetAreaSqft: 1150, saleableAreaSqft: 1650, priceMinInr: 2.4 * CR, priceMaxInr: 3.5 * CR, available: true },
    ],
    amenities: [
      "Double-height air-conditioned lobby",
      "6 high-speed passenger lifts + service lift",
      "100% DG power backup",
      "Two-level basement parking",
      "Food court and cafeteria",
      "Conference and meeting rooms on demand",
      "24x7 access with card entry",
    ],
    locationAdvantages: [
      { label: "Blue Line Metro (Sector 62 / Electronic City)", distance: "6 min walk" },
      { label: "Fortis Hospital", distance: "5 min" },
      { label: "NH-24 / Delhi–Meerut Expressway", distance: "4 min" },
      { label: "Sector 18 market", distance: "18 min" },
    ],
    paymentPlans: ["Down payment with 7% discount", "50:50 plan", "Lease-guarantee option on select shops"],
    usps: [
      "Sector 62 is an established office market — no waiting for the area to develop",
      "Metro entrance is a six-minute walk, which drives retail footfall",
      "Commercial yields here have historically run higher than residential (past performance, not a guarantee)",
    ],
    bestFor: ["investment"],
    pitchHinglish:
      "Corporate Square Sector 62 mein hai — ye already established office market hai, koi wait nahi karna padta area develop hone ka. Metro sirf 6 minute walk pe hai, isliye retail footfall achha rehta hai.",
  },
  {
    id: "pinnacle",
    name: "Aarambh Pinnacle",
    developer: "Aarambh Realty",
    tagline: "Sky villas and duplex penthouses, four homes to a tower floor.",
    city: "Noida",
    locality: "Sector 94",
    microMarket: "Noida Expressway (Ultra-luxury)",
    propertyType: "apartment",
    status: "new_launch",
    reraId: "UPRERAPRJ-DEMO-094003",
    possession: "December 2030 (new launch — excavation begins Q1 2027)",
    priceRangeLabel: "₹7 Crore – ₹15 Crore",
    priceMinInr: 7 * CR,
    priceMaxInr: 15 * CR,
    bookingAmountInr: 50 * L,
    units: [
      { configuration: "4BHK", carpetAreaSqft: 3400, saleableAreaSqft: 4600, priceMinInr: 7 * CR, priceMaxInr: 9 * CR, available: true },
      { configuration: "5BHK", carpetAreaSqft: 4900, saleableAreaSqft: 6600, priceMinInr: 11 * CR, priceMaxInr: 15 * CR, available: true },
    ],
    amenities: [
      "Private lift lobby for every apartment",
      "Sky lounge on the 40th floor",
      "Infinity pool with Delhi skyline view",
      "Chauffeur lounge and 5-car parking",
      "Concierge, valet and in-residence dining",
      "Wellness floor — spa, salon, physiotherapy",
      "Temperature-controlled corridors",
      "EV charging at every parking bay",
    ],
    locationAdvantages: [
      { label: "DND Flyway to South Delhi", distance: "8 min" },
      { label: "Kalindi Kunj / Okhla", distance: "10 min" },
      { label: "Magenta Line Metro (Okhla Bird Sanctuary)", distance: "7 min" },
      { label: "Indira Gandhi International Airport", distance: "45 min" },
    ],
    paymentPlans: ["25:75 launch plan", "Construction Linked Plan", "Down payment with 8% discount"],
    usps: [
      "Closest Aarambh address to South Delhi — DND is eight minutes away",
      "Only 2 residences per floor with a private lift lobby",
      "New-launch pricing; the same address resells materially higher today",
    ],
    bestFor: ["self_use", "both"],
    pitchHinglish:
      "Pinnacle Sector 94 mein hai — DND sirf 8 minute, matlab South Delhi bilkul paas. Har floor pe sirf do residences aur private lift lobby. Abhi new launch pricing chal rahi hai.",
  },
  {
    id: "meadows",
    name: "Aarambh Meadows",
    developer: "Aarambh Realty",
    tagline: "Mid-sized family homes a short walk from the Aqua Line.",
    city: "Noida",
    locality: "Sector 143B",
    microMarket: "Noida Expressway",
    propertyType: "apartment",
    status: "under_construction",
    reraId: "UPRERAPRJ-DEMO-143B41",
    possession: "June 2028",
    priceRangeLabel: "₹85 Lakh – ₹1.6 Crore",
    priceMinInr: 85 * L,
    priceMaxInr: 1.6 * CR,
    bookingAmountInr: 4 * L,
    units: [
      { configuration: "2BHK", carpetAreaSqft: 690, saleableAreaSqft: 1050, priceMinInr: 85 * L, priceMaxInr: 1.02 * CR, available: true },
      { configuration: "3BHK", carpetAreaSqft: 985, saleableAreaSqft: 1480, priceMinInr: 1.25 * CR, priceMaxInr: 1.6 * CR, available: true },
    ],
    amenities: [
      "22,000 sq ft clubhouse",
      "Swimming pool and toddler pool",
      "Cricket practice net and half basketball court",
      "Jogging track around a central green",
      "Creche and homework room",
      "Retail plaza inside the gate",
      "Power backup and 2-tier security",
    ],
    locationAdvantages: [
      { label: "Aqua Line Metro (Sector 143)", distance: "6 min walk" },
      { label: "Noida–Greater Noida Expressway", distance: "4 min" },
      { label: "Advant Business Park", distance: "10 min" },
      { label: "Genesis & Lotus Valley schools", distance: "12 min" },
    ],
    paymentPlans: ["Construction Linked Plan", "10:80:10 plan", "PMAY-eligible on 2BHK (subject to eligibility)"],
    usps: [
      "One of the few Expressway projects within walking distance of a metro station",
      "Efficient layouts — carpet-to-saleable ratio around 66%",
      "Schools and business parks both within 12 minutes",
    ],
    bestFor: ["self_use", "both"],
    pitchHinglish:
      "Meadows ki khaas baat ye hai ki Aqua Line metro sirf 6 minute walk pe hai — Expressway pe itne projects mein ye milta nahi. Schools aur office dono 10-12 minute mein.",
  },

  /* ---------------------------------------------------------------- */
  /* Greater Noida & Greater Noida West                                */
  /* ---------------------------------------------------------------- */
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
      { configuration: "1BHK", carpetAreaSqft: 420, saleableAreaSqft: 650, priceMinInr: 45 * L, priceMaxInr: 52 * L, available: true },
      { configuration: "2BHK", carpetAreaSqft: 610, saleableAreaSqft: 950, priceMinInr: 58 * L, priceMaxInr: 72 * L, available: true },
      { configuration: "3BHK", carpetAreaSqft: 850, saleableAreaSqft: 1290, priceMinInr: 78 * L, priceMaxInr: 95 * L, available: true },
    ],
    amenities: [
      "18,000 sq ft clubhouse",
      "Swimming pool and kids' splash pad",
      "Multipurpose sports court",
      "Jogging track around the central green",
      "Retail high street within the township",
      "1 KVA power backup per home",
      "Gated community with CCTV",
    ],
    locationAdvantages: [
      { label: "Proposed Metro extension (Sector 16B stop)", distance: "Planned, ~5 min" },
      { label: "Gaur City Mall", distance: "10 min" },
      { label: "FNG Expressway", distance: "8 min" },
      { label: "Noida Sector 62 IT hub", distance: "25 min" },
    ],
    paymentPlans: [
      "Launch-phase CLP with 5% booking",
      "PMAY-eligible units (subject to applicant eligibility)",
      "10:90 plan for the first 100 bookings",
    ],
    usps: [
      "Low entry ticket — suits a first home or a smaller investment",
      "New-launch pricing sits below surrounding resale inventory",
      "Larger balconies than typical Noida Extension stock",
    ],
    bestFor: ["self_use", "investment", "both"],
    pitchHinglish:
      "Urbania first-time buyers ke liye best hai — 45 lakh se start hoti hai, new launch pricing hai isliye rate aas-paas ke resale se kam hai, aur PMAY ka option bhi hai agar aap eligible hain.",
  },
  {
    id: "sunrise-heights",
    name: "Aarambh Sunrise Heights",
    developer: "Aarambh Realty",
    tagline: "Ready-to-move family homes with nothing left to wait for.",
    city: "Greater Noida West",
    locality: "Sector 1, Noida Extension",
    microMarket: "Greater Noida West",
    propertyType: "apartment",
    status: "ready_to_move",
    reraId: "UPRERAPRJ-DEMO-GNW0118",
    possession: "Ready to move — OC received, families already living here",
    priceRangeLabel: "₹52 Lakh – ₹1.05 Crore",
    priceMinInr: 52 * L,
    priceMaxInr: 1.05 * CR,
    bookingAmountInr: 3 * L,
    units: [
      { configuration: "2BHK", carpetAreaSqft: 655, saleableAreaSqft: 1010, priceMinInr: 52 * L, priceMaxInr: 66 * L, available: true },
      { configuration: "3BHK", carpetAreaSqft: 920, saleableAreaSqft: 1395, priceMinInr: 78 * L, priceMaxInr: 1.05 * CR, available: true },
    ],
    amenities: [
      "Operational clubhouse with pool and gym",
      "Landscaped central park",
      "Badminton and basketball courts",
      "Grocery and pharmacy inside the gate",
      "Kids' play area and senior citizens' corner",
      "100% power backup for common areas",
      "Gated with 3-tier security",
    ],
    locationAdvantages: [
      { label: "Gaur City Mall", distance: "6 min" },
      { label: "FNG Expressway", distance: "5 min" },
      { label: "Sector 62 Noida", distance: "22 min" },
      { label: "Yatharth & Kailash Hospitals", distance: "10 min" },
    ],
    paymentPlans: ["Down payment with 5% discount", "Bank loan with immediate disbursal", "No GST — OC received"],
    usps: [
      "Occupied and running — you can see the actual flat, not a sample one",
      "No GST and no construction risk",
      "The society already has an operational clubhouse, not a promised one",
    ],
    bestFor: ["self_use", "both"],
    pitchHinglish:
      "Sunrise Heights ready-to-move hai aur families already reh rahi hain — aap actual flat dekh sakte hain, sample flat nahi. GST bhi nahi lagega kyunki OC aa chuka hai.",
  },
  {
    id: "sports-city",
    name: "Aarambh Sports City",
    developer: "Aarambh Realty",
    tagline: "Homes built around a cricket ground, a 400 m track and a swim academy.",
    city: "Greater Noida",
    locality: "Sector 22D",
    microMarket: "Greater Noida",
    propertyType: "apartment",
    status: "under_construction",
    reraId: "UPRERAPRJ-DEMO-GN22D07",
    possession: "December 2028",
    priceRangeLabel: "₹1.1 Crore – ₹2.2 Crore",
    priceMinInr: 1.1 * CR,
    priceMaxInr: 2.2 * CR,
    bookingAmountInr: 6 * L,
    units: [
      { configuration: "3BHK", carpetAreaSqft: 1150, saleableAreaSqft: 1720, priceMinInr: 1.1 * CR, priceMaxInr: 1.5 * CR, available: true },
      { configuration: "4BHK", carpetAreaSqft: 1620, saleableAreaSqft: 2400, priceMinInr: 1.7 * CR, priceMaxInr: 2.2 * CR, available: true },
    ],
    amenities: [
      "Full-size cricket ground with practice nets",
      "400 m athletics track",
      "Swimming academy with coaching",
      "Indoor sports arena — badminton, TT, squash",
      "Sports medicine and physiotherapy centre",
      "35,000 sq ft clubhouse",
      "Amphitheatre and party lawn",
      "EV charging and 2-level basement parking",
    ],
    locationAdvantages: [
      { label: "Buddh International Circuit", distance: "12 min" },
      { label: "Pari Chowk", distance: "15 min" },
      { label: "Aqua Line Metro (Delta 1)", distance: "18 min" },
      { label: "Noida International Airport, Jewar", distance: "25 min" },
      { label: "Sharda & Galgotias University", distance: "10 min" },
    ],
    paymentPlans: ["Construction Linked Plan", "20:80 plan", "Down payment with 6% discount"],
    usps: [
      "Genuine sporting infrastructure, not a token court — a full cricket ground and a 400 m track",
      "Suits families with children in serious sports training",
      "Large layouts for the price compared with Noida sectors",
    ],
    bestFor: ["self_use", "both"],
    pitchHinglish:
      "Sports City mein poora cricket ground hai aur 400 metre ka athletics track — token court nahi. Agar bachche sports mein serious hain toh ye ekdum sahi jagah hai.",
  },
  {
    id: "knowledge-park-residency",
    name: "Aarambh Knowledge Park Residency",
    developer: "Aarambh Realty",
    tagline: "Rental-focused homes in the middle of Greater Noida's university belt.",
    city: "Greater Noida",
    locality: "Knowledge Park V",
    microMarket: "Greater Noida",
    propertyType: "apartment",
    status: "ready_to_move",
    reraId: "UPRERAPRJ-DEMO-GNKP511",
    possession: "Ready to move",
    priceRangeLabel: "₹48 Lakh – ₹88 Lakh",
    priceMinInr: 48 * L,
    priceMaxInr: 88 * L,
    bookingAmountInr: 2 * L,
    units: [
      { configuration: "2BHK", carpetAreaSqft: 640, saleableAreaSqft: 980, priceMinInr: 48 * L, priceMaxInr: 62 * L, available: true },
      { configuration: "3BHK", carpetAreaSqft: 890, saleableAreaSqft: 1340, priceMinInr: 70 * L, priceMaxInr: 88 * L, available: true },
    ],
    amenities: [
      "Clubhouse with gym and pool",
      "Study lounge and library",
      "High-speed fibre across the society",
      "Cafeteria and tuck shop",
      "Cycle stands and shuttle pickup point",
      "24x7 security with visitor management",
    ],
    locationAdvantages: [
      { label: "Sharda University", distance: "5 min" },
      { label: "Galgotias University", distance: "8 min" },
      { label: "Bennett University", distance: "12 min" },
      { label: "Pari Chowk", distance: "10 min" },
      { label: "Aqua Line Metro (Knowledge Park II)", distance: "9 min" },
    ],
    paymentPlans: ["Down payment with 5% discount", "50:50 plan", "Bank loan up to 80%"],
    usps: [
      "Three large universities within twelve minutes — steady student and faculty tenant demand",
      "Ready to move, so it can be let out from the month of registry",
      "Low ticket size for a 3BHK",
    ],
    bestFor: ["investment", "both"],
    pitchHinglish:
      "Knowledge Park Residency investment ke liye achhi hai — Sharda, Galgotias aur Bennett teenon paas mein hain, toh students aur faculty ka rental demand hamesha rehta hai.",
  },

  /* ---------------------------------------------------------------- */
  /* Yamuna Expressway                                                 */
  /* ---------------------------------------------------------------- */
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
      { configuration: "plot", carpetAreaSqft: 900, saleableAreaSqft: 900, priceMinInr: 38 * L, priceMaxInr: 46 * L, available: true },
      { configuration: "plot", carpetAreaSqft: 1800, saleableAreaSqft: 1800, priceMinInr: 72 * L, priceMaxInr: 88 * L, available: true },
      { configuration: "plot", carpetAreaSqft: 2700, saleableAreaSqft: 2700, priceMinInr: 1.1 * CR, priceMaxInr: 1.4 * CR, available: true },
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
    ],
    paymentPlans: ["Full down payment with registry in 30 days", "50:50 plan over 6 months"],
    usps: [
      "Freehold and registry-ready — you own the land outright",
      "Plots historically move on infrastructure milestones; Jewar Airport is the trigger here",
      "You can build to your own design within the approved FAR",
    ],
    bestFor: ["investment", "both"],
    pitchHinglish:
      "Green Acres Yamuna Expressway pe plotted township hai, Jewar Airport sirf 15 minute door. Registry-ready hai, matlab aap turant apne naam karwa sakte hain aur apni marzi ka ghar bana sakte hain.",
  },
  {
    id: "aerocity",
    name: "Aarambh Aerocity",
    developer: "Aarambh Realty",
    tagline: "Apartments built for the airport economy, twelve minutes from Jewar.",
    city: "Greater Noida",
    locality: "Sector 22E, Yamuna Expressway",
    microMarket: "Jewar Airport Belt",
    propertyType: "apartment",
    status: "new_launch",
    reraId: "UPRERAPRJ-DEMO-YEX22E4",
    possession: "September 2029 (new launch)",
    priceRangeLabel: "₹58 Lakh – ₹1.25 Crore",
    priceMinInr: 58 * L,
    priceMaxInr: 1.25 * CR,
    bookingAmountInr: 3 * L,
    units: [
      { configuration: "2BHK", carpetAreaSqft: 700, saleableAreaSqft: 1080, priceMinInr: 58 * L, priceMaxInr: 74 * L, available: true },
      { configuration: "3BHK", carpetAreaSqft: 1010, saleableAreaSqft: 1520, priceMinInr: 92 * L, priceMaxInr: 1.25 * CR, available: true },
    ],
    amenities: [
      "Clubhouse with pool, gym and cafe",
      "Serviced-apartment block for short stays",
      "Co-working floor",
      "Airport shuttle pickup point",
      "Retail plaza",
      "EV charging and visitor parking",
      "Gated with 3-tier security",
    ],
    locationAdvantages: [
      { label: "Noida International Airport, Jewar", distance: "12 min" },
      { label: "Yamuna Expressway access", distance: "3 min" },
      { label: "Proposed Film City site", distance: "18 min" },
      { label: "Proposed Pod Taxi corridor", distance: "Planned along YEX" },
    ],
    paymentPlans: ["Launch CLP with 5% booking", "25:75 plan", "Down payment with 7% discount"],
    usps: [
      "Closest Aarambh residential project to the new airport",
      "Includes a serviced-apartment block aimed at airport and crew short stays",
      "Launch pricing in a corridor whose infrastructure is still being built out",
    ],
    bestFor: ["investment", "both"],
    pitchHinglish:
      "Aerocity Jewar Airport se sirf 12 minute hai. New launch pricing chal rahi hai, aur ek serviced-apartment block bhi hai jo airport crew ke short stays ke liye hai.",
  },
  {
    id: "industrial-park",
    name: "Aarambh Industrial Park",
    developer: "Aarambh Realty",
    tagline: "Warehousing and light-industrial plots on the freight corridor.",
    city: "Greater Noida",
    locality: "Sector 32, Yamuna Expressway",
    microMarket: "Jewar Airport Belt",
    propertyType: "commercial",
    status: "ready_to_move",
    reraId: "UPRERAPRJ-DEMO-YEX3201",
    possession: "Immediate registry — construction can begin at once",
    priceRangeLabel: "₹1.5 Crore – ₹8 Crore",
    priceMinInr: 1.5 * CR,
    priceMaxInr: 8 * CR,
    bookingAmountInr: 15 * L,
    units: [
      { configuration: "plot", carpetAreaSqft: 9000, saleableAreaSqft: 9000, priceMinInr: 1.5 * CR, priceMaxInr: 2.2 * CR, available: true },
      { configuration: "plot", carpetAreaSqft: 18000, saleableAreaSqft: 18000, priceMinInr: 2.9 * CR, priceMaxInr: 4.2 * CR, available: true },
      { configuration: "plot", carpetAreaSqft: 36000, saleableAreaSqft: 36000, priceMinInr: 5.6 * CR, priceMaxInr: 8 * CR, available: true },
    ],
    amenities: [
      "24 m and 18 m internal roads rated for trailers",
      "Dedicated 33 KV substation",
      "Effluent treatment plant",
      "Truck parking and weighbridge",
      "Labour rest facility and canteen",
      "Fire hydrant network",
      "Boundary wall with 24x7 security",
    ],
    locationAdvantages: [
      { label: "Noida International Airport cargo terminal", distance: "20 min" },
      { label: "Eastern Dedicated Freight Corridor", distance: "25 min" },
      { label: "Yamuna Expressway access", distance: "4 min" },
      { label: "Proposed multi-modal logistics hub", distance: "22 min" },
    ],
    paymentPlans: ["Down payment with registry in 45 days", "40:60 plan", "Institutional finance can be arranged"],
    usps: [
      "Industrial land use already approved — no conversion needed",
      "Sized for warehousing, light manufacturing and cold storage",
      "Airport cargo and the freight corridor are both within 25 minutes",
    ],
    bestFor: ["investment"],
    pitchHinglish:
      "Industrial Park mein land use already industrial approved hai, conversion nahi karana padta. Airport cargo terminal aur freight corridor dono 25 minute ke andar hain.",
  },

  /* ---------------------------------------------------------------- */
  /* Ghaziabad                                                         */
  /* ---------------------------------------------------------------- */
  {
    id: "riverside-indirapuram",
    name: "Aarambh Riverside Indirapuram",
    developer: "Aarambh Realty",
    tagline: "Large family homes in a settled Ghaziabad neighbourhood, close to Delhi.",
    city: "Ghaziabad",
    locality: "Indirapuram",
    microMarket: "Ghaziabad",
    propertyType: "apartment",
    status: "ready_to_move",
    reraId: "UPRERAPRJ-DEMO-GZB0224",
    possession: "Ready to move",
    priceRangeLabel: "₹1.3 Crore – ₹2.4 Crore",
    priceMinInr: 1.3 * CR,
    priceMaxInr: 2.4 * CR,
    bookingAmountInr: 6 * L,
    units: [
      { configuration: "3BHK", carpetAreaSqft: 1180, saleableAreaSqft: 1740, priceMinInr: 1.3 * CR, priceMaxInr: 1.7 * CR, available: true },
      { configuration: "4BHK", carpetAreaSqft: 1690, saleableAreaSqft: 2450, priceMinInr: 1.95 * CR, priceMaxInr: 2.4 * CR, available: true },
    ],
    amenities: [
      "Clubhouse with pool, gym and banquet hall",
      "Landscaped park and jogging loop",
      "Tennis and badminton courts",
      "Market and schools within walking distance",
      "Two-level basement parking",
      "100% power backup",
      "Gated with 3-tier security",
    ],
    locationAdvantages: [
      { label: "Blue Line Metro (Vaishali)", distance: "10 min" },
      { label: "NH-24 / Delhi–Meerut Expressway", distance: "5 min" },
      { label: "Anand Vihar ISBT & railway station", distance: "15 min" },
      { label: "Shipra Mall / Aditya Mall", distance: "6 min" },
      { label: "Yashoda & Max Hospitals", distance: "8 min" },
    ],
    paymentPlans: ["Down payment with 5% discount", "Bank loan with immediate disbursal", "No GST — OC received"],
    usps: [
      "Indirapuram is a settled neighbourhood — schools, markets and hospitals already exist",
      "Delhi–Meerut Expressway five minutes away makes East Delhi commutes short",
      "Larger built-up areas than comparably priced Noida stock",
    ],
    bestFor: ["self_use", "both"],
    pitchHinglish:
      "Riverside Indirapuram mein hai — ye settled area hai, schools, market, hospital sab already hain. Delhi-Meerut Expressway sirf 5 minute, toh East Delhi jaana easy rehta hai.",
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

/** Every market the agent operates in, derived rather than hand-maintained. */
export function operatingMarkets(): string[] {
  return Array.from(new Set(PROJECTS.map((p) => p.city)));
}

/**
 * The catalogue as it appears in the system instruction.
 *
 * Deliberately an INDEX, not a full fact sheet. Fifteen projects at full detail
 * is ~25,000 characters, which would more than double the system prompt and
 * measurably degrade a realtime voice model's instruction-following — she
 * starts skipping the language rules and the guardrails long before she runs
 * out of context.
 *
 * So the prompt carries just enough to answer "what have you got in my budget
 * near X" and to pick the right project, and `get_project_details` fetches the
 * amenities, carpet areas, payment plans and possession schedule on demand.
 * That is what the tool is for.
 */
export function projectsAsPromptContext(): string {
  const byMarket = new Map<string, typeof PROJECTS>();
  for (const p of PROJECTS) {
    const key = `${p.city}${p.microMarket && p.microMarket !== p.city ? ` — ${p.microMarket}` : ""}`;
    byMarket.set(key, [...(byMarket.get(key) ?? []), p]);
  }

  const sections: string[] = [];
  for (const [market, projects] of byMarket) {
    const lines = projects.map((p) => {
      const configs = Array.from(new Set(p.units.filter((u) => u.available).map((u) => u.configuration))).join("/");
      const status =
        p.status === "ready_to_move" ? "ready to move" : p.status === "new_launch" ? "new launch" : "under construction";
      return `  - ${p.name} [${p.id}] · ${p.locality} · ${p.propertyType} · ${configs} · ${p.priceRangeLabel} · ${status}`;
    });
    sections.push(`${market}\n${lines.join("\n")}`);
  }

  return sections.join("\n\n");
}
