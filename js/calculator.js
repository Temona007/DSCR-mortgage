import { RATE_SHEET } from "./rate-sheet.js";

/** Monthly P&I (standard amortizing fixed) */
export function calcMonthlyPI(loanAmount, annualRate, termYears) {
  if (loanAmount <= 0 || termYears <= 0) return 0;
  const r = annualRate / 100 / 12;
  const n = termYears * 12;
  if (r === 0) return loanAmount / n;
  return (loanAmount * r * Math.pow(1 + r, n)) / (Math.pow(1 + r, n) - 1);
}

export function calcLTV(loanAmount, propertyValue) {
  if (!propertyValue) return 0;
  return (loanAmount / propertyValue) * 100;
}

export function calcDSCR(monthlyRent, pitia) {
  if (!pitia) return 0;
  return monthlyRent / pitia;
}

function lookupBaseRate(fico) {
  const tier = RATE_SHEET.baseRates.find((t) => fico >= t.minFico);
  return tier ? tier.rate : RATE_SHEET.baseRates[RATE_SHEET.baseRates.length - 1].rate;
}

function lookupLtvAdj(ltv) {
  const bucket = RATE_SHEET.llpa.ltv.find((b) => ltv <= b.maxLtv);
  return bucket ? bucket.adj : RATE_SHEET.llpa.ltv[RATE_SHEET.llpa.ltv.length - 1].adj;
}

function lookupDscrAdj(dscr) {
  const bucket = RATE_SHEET.llpa.dscr.find((b) => dscr >= b.minDscr);
  return bucket ? bucket.adj : RATE_SHEET.llpa.dscr[RATE_SHEET.llpa.dscr.length - 1].adj;
}

function lookupLoanAmountAdj(amount) {
  const bucket = RATE_SHEET.llpa.loanAmount.find(
    (b) => amount >= b.min && amount <= b.max
  );
  return bucket ? bucket.adj : 0;
}

export function priceLoan(inputs) {
  const {
    propertyValue,
    loanAmount,
    monthlyRent,
    monthlyTaxes = 0,
    monthlyInsurance = 0,
    monthlyHoa = 0,
    fico,
    propertyType,
    purpose,
    prepayPenalty,
    term = 30,
    brokerPoints = 0,
  } = inputs;

  const ltv = calcLTV(loanAmount, propertyValue);
  const noteRate = lookupBaseRate(fico);

  // Iterative DSCR: PITIA depends on P&I which depends on rate — single pass is fine for MVP
  const monthlyPI = calcMonthlyPI(loanAmount, noteRate, term);
  const pitia = monthlyPI + monthlyTaxes + monthlyInsurance + monthlyHoa;
  const dscr = calcDSCR(monthlyRent, pitia);

  const adjustments = [
    { label: "Base price (par)", points: RATE_SHEET.parPrice, category: "base" },
    { label: `LTV ${ltv.toFixed(1)}%`, points: lookupLtvAdj(ltv), category: "llpa" },
    { label: `DSCR ${dscr.toFixed(2)}x`, points: lookupDscrAdj(dscr), category: "llpa" },
    {
      label: formatPropertyType(propertyType),
      points: RATE_SHEET.llpa.propertyType[propertyType] ?? 0,
      category: "llpa",
    },
    {
      label: formatPurpose(purpose),
      points: RATE_SHEET.llpa.purpose[purpose] ?? 0,
      category: "llpa",
    },
    {
      label: formatPrepay(prepayPenalty),
      points: RATE_SHEET.llpa.prepayPenalty[prepayPenalty] ?? 0,
      category: "llpa",
    },
    {
      label: "Loan amount tier",
      points: lookupLoanAmountAdj(loanAmount),
      category: "llpa",
    },
    { label: "Broker compensation", points: brokerPoints, category: "broker" },
  ];

  const totalPoints = adjustments.reduce((sum, a) => sum + a.points, 0);
  const discountPoints = Math.max(0, totalPoints - RATE_SHEET.parPrice);
  const lenderCredit = Math.max(0, RATE_SHEET.parPrice - totalPoints);
  const pointsCost = (discountPoints / 100) * loanAmount;
  const creditAmount = (lenderCredit / 100) * loanAmount;

  const eligibility = checkEligibility({ ltv, dscr, loanAmount, fico });

  return {
    noteRate,
    term,
    ltv,
    dscr,
    monthlyPI,
    pitia,
    monthlyRent,
    monthlyCashFlow: monthlyRent - pitia,
    adjustments,
    totalPoints,
    discountPoints,
    lenderCredit,
    pointsCost,
    creditAmount,
    eligibility,
    totalInterest: monthlyPI * term * 12 - loanAmount,
  };
}

function checkEligibility({ ltv, dscr, loanAmount, fico }) {
  const checks = [
    {
      id: "fico",
      label: `Min FICO ${RATE_SHEET.minFico}`,
      pass: fico >= RATE_SHEET.minFico,
      value: fico,
    },
    {
      id: "ltv",
      label: `Max LTV ${RATE_SHEET.maxLtv}%`,
      pass: ltv <= RATE_SHEET.maxLtv,
      value: `${ltv.toFixed(1)}%`,
    },
    {
      id: "dscr",
      label: `Min DSCR ${RATE_SHEET.minDscr}x`,
      pass: dscr >= RATE_SHEET.minDscr,
      value: `${dscr.toFixed(2)}x`,
    },
    {
      id: "loanMin",
      label: `Min loan $${formatNum(RATE_SHEET.minLoan)}`,
      pass: loanAmount >= RATE_SHEET.minLoan,
      value: `$${formatNum(loanAmount)}`,
    },
    {
      id: "loanMax",
      label: `Max loan $${formatNum(RATE_SHEET.maxLoan)}`,
      pass: loanAmount <= RATE_SHEET.maxLoan,
      value: `$${formatNum(loanAmount)}`,
    },
  ];
  return {
    checks,
    eligible: checks.every((c) => c.pass),
  };
}

function formatNum(n) {
  return n.toLocaleString("en-US", { maximumFractionDigits: 0 });
}

function formatPropertyType(t) {
  const map = {
    sfr: "Single Family",
    "2-4unit": "2–4 Unit",
    condo: "Warrantable Condo",
    "non-warrantable-condo": "Non-Warrantable Condo",
  };
  return map[t] || t;
}

function formatPurpose(p) {
  const map = {
    purchase: "Purchase",
    "rate-term": "Rate/Term Refi",
    "cash-out": "Cash-Out Refi",
  };
  return map[p] || p;
}

function formatPrepay(p) {
  const map = {
    none: "No Prepay Penalty",
    "1yr": "1-Year Prepay",
    "3yr": "3-Year Prepay",
    "5yr": "5-Year Prepay",
  };
  return map[p] || p;
}

export function formatCurrency(n, decimals = 0) {
  return n.toLocaleString("en-US", {
    style: "currency",
    currency: "USD",
    minimumFractionDigits: decimals,
    maximumFractionDigits: decimals,
  });
}

export function formatPercent(n, decimals = 3) {
  return `${n.toFixed(decimals)}%`;
}
