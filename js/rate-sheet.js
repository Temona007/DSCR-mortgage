/**
 * Demo rate sheet — replace with API/DB in production.
 * Prices expressed in points (100 = par). Higher = more cost to borrower.
 */
export const RATE_SHEET = {
  name: "DSCR Prime — Demo Rate Sheet",
  effectiveDate: "2026-06-01",
  minDscr: 0.75,
  maxLtv: 80,
  minLoan: 75000,
  maxLoan: 3000000,
  minFico: 660,
  terms: [30, 25, 20, 15],

  // Base note rates by FICO tier (30-yr fixed)
  baseRates: [
    { minFico: 760, rate: 6.625 },
    { minFico: 740, rate: 6.750 },
    { minFico: 720, rate: 6.875 },
    { minFico: 700, rate: 7.000 },
    { minFico: 680, rate: 7.250 },
    { minFico: 660, rate: 7.500 },
  ],

  // LLPAs in price points (added to base price of 100)
  llpa: {
    ltv: [
      { maxLtv: 50, adj: -0.25 },
      { maxLtv: 60, adj: 0 },
      { maxLtv: 70, adj: 0.375 },
      { maxLtv: 75, adj: 0.625 },
      { maxLtv: 80, adj: 1.0 },
    ],
    dscr: [
      { minDscr: 1.25, adj: -0.375 },
      { minDscr: 1.0, adj: 0 },
      { minDscr: 0.85, adj: 0.5 },
      { minDscr: 0.75, adj: 1.25 },
    ],
    propertyType: {
      sfr: 0,
      "2-4unit": 0.375,
      condo: 0.5,
      "non-warrantable-condo": 1.0,
    },
    purpose: {
      purchase: 0,
      "rate-term": 0.125,
      "cash-out": 0.5,
    },
    prepayPenalty: {
      none: 0.75,
      "1yr": 0.375,
      "3yr": 0,
      "5yr": -0.25,
    },
    loanAmount: [
      { min: 75000, max: 249999, adj: 0.25 },
      { min: 250000, max: 999999, adj: 0 },
      { min: 1000000, max: 3000000, adj: -0.125 },
    ],
  },

  // Par price target — broker can buy down or take credit
  parPrice: 100,
};

/** Demo saved scenarios for quick load */
export const DEMO_SCENARIOS = [
  {
    id: "sc-001",
    label: "Phoenix SFR — Purchase",
    propertyValue: 425000,
    loanAmount: 340000,
    monthlyRent: 2800,
    monthlyTaxes: 350,
    monthlyInsurance: 125,
    monthlyHoa: 0,
    fico: 740,
    propertyType: "sfr",
    purpose: "purchase",
    prepayPenalty: "3yr",
    term: 30,
  },
  {
    id: "sc-002",
    label: "Miami Condo — Cash-Out",
    propertyValue: 550000,
    loanAmount: 385000,
    monthlyRent: 3200,
    monthlyTaxes: 480,
    monthlyInsurance: 175,
    monthlyHoa: 250,
    fico: 700,
    propertyType: "condo",
    purpose: "cash-out",
    prepayPenalty: "5yr",
    term: 30,
  },
  {
    id: "sc-003",
    label: "Atlanta Duplex — Rate/Term",
    propertyValue: 380000,
    loanAmount: 266000,
    monthlyRent: 2400,
    monthlyTaxes: 310,
    monthlyInsurance: 110,
    monthlyHoa: 0,
    fico: 720,
    propertyType: "2-4unit",
    purpose: "rate-term",
    prepayPenalty: "1yr",
    term: 30,
  },
];
