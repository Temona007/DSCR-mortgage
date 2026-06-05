import { RATE_SHEET, DEMO_SCENARIOS } from "./rate-sheet.js";
import { priceLoan, calcLTV, formatCurrency, formatPercent } from "./calculator.js";

const form = document.getElementById("pricer-form");
const resultsEl = document.getElementById("results");
const placeholderEl = document.getElementById("results-placeholder");
const scenarioModal = document.getElementById("scenario-modal");

function init() {
  document.getElementById("rate-sheet-label").textContent =
    `${RATE_SHEET.name} · Effective ${RATE_SHEET.effectiveDate}`;

  bindEvents();
  populateScenarios();
  updateLtvHint();
  // Auto-price on load for immediate feedback
  runPricing();
}

function bindEvents() {
  document.getElementById("btn-price").addEventListener("click", runPricing);
  document.getElementById("btn-reset").addEventListener("click", resetForm);
  document.getElementById("btn-load-scenario").addEventListener("click", () => scenarioModal.showModal());
  document.getElementById("modal-close").addEventListener("click", () => scenarioModal.close());

  const fico = document.getElementById("fico");
  const ficoOutput = document.getElementById("fico-output");
  fico.addEventListener("input", () => {
    ficoOutput.textContent = fico.value;
  });

  ["propertyValue", "loanAmount"].forEach((id) => {
    document.getElementById(id).addEventListener("input", updateLtvHint);
  });

  form.addEventListener("input", debounce(runPricing, 350));
  form.addEventListener("change", runPricing);
}

function populateScenarios() {
  const list = document.getElementById("scenario-list");
  DEMO_SCENARIOS.forEach((sc) => {
    const li = document.createElement("li");
    li.innerHTML = `
      <button type="button" class="scenario-item" data-id="${sc.id}">
        <span class="scenario-item__label">${sc.label}</span>
        <span class="scenario-item__meta">${formatCurrency(sc.loanAmount)} · FICO ${sc.fico}</span>
      </button>
    `;
    li.querySelector("button").addEventListener("click", () => {
      loadScenario(sc);
      scenarioModal.close();
    });
    list.appendChild(li);
  });
}

function loadScenario(sc) {
  Object.entries(sc).forEach(([key, val]) => {
    const el = form.elements[key];
    if (el) el.value = val;
  });
  document.getElementById("fico-output").textContent = sc.fico;
  updateLtvHint();
  runPricing();
}

function resetForm() {
  loadScenario(DEMO_SCENARIOS[0]);
}

function getFormData() {
  const fd = new FormData(form);
  return {
    propertyValue: Number(fd.get("propertyValue")),
    loanAmount: Number(fd.get("loanAmount")),
    monthlyRent: Number(fd.get("monthlyRent")),
    monthlyTaxes: Number(fd.get("monthlyTaxes")) || 0,
    monthlyInsurance: Number(fd.get("monthlyInsurance")) || 0,
    monthlyHoa: Number(fd.get("monthlyHoa")) || 0,
    fico: Number(fd.get("fico")),
    propertyType: fd.get("propertyType"),
    purpose: fd.get("purpose"),
    prepayPenalty: fd.get("prepayPenalty"),
    term: Number(fd.get("term")),
    brokerPoints: Number(fd.get("brokerPoints")) || 0,
  };
}

function updateLtvHint() {
  const pv = Number(document.getElementById("propertyValue").value);
  const la = Number(document.getElementById("loanAmount").value);
  const ltv = calcLTV(la, pv);
  const hint = document.getElementById("ltv-hint");
  hint.textContent = pv ? `LTV ${ltv.toFixed(1)}%` : "LTV —";
  hint.classList.toggle("field__hint--warn", ltv > RATE_SHEET.maxLtv);
}

function runPricing() {
  const inputs = getFormData();
  if (!inputs.propertyValue || !inputs.loanAmount || !inputs.monthlyRent) return;

  const result = priceLoan(inputs);
  renderResults(result);
}

function renderResults(r) {
  placeholderEl.classList.add("hidden");
  resultsEl.classList.remove("hidden");
  resultsEl.classList.remove("results--animate");
  void resultsEl.offsetWidth; // reflow for animation restart
  resultsEl.classList.add("results--animate");

  const banner = document.getElementById("eligibility-banner");
  banner.className = `eligibility ${r.eligibility.eligible ? "eligibility--pass" : "eligibility--fail"}`;
  document.getElementById("eligibility-text").textContent = r.eligibility.eligible
    ? "Eligible — meets all program guidelines"
    : "Ineligible — one or more guidelines not met";

  document.getElementById("result-rate").textContent = formatPercent(r.noteRate, 3);
  document.getElementById("result-term").textContent = `${r.term}-yr fixed`;
  document.getElementById("result-dscr").textContent = `${r.dscr.toFixed(2)}x`;
  document.getElementById("result-dscr").className = `metric__value ${r.dscr >= RATE_SHEET.minDscr ? "text-pass" : "text-fail"}`;
  document.getElementById("result-ltv").textContent = `${r.ltv.toFixed(1)}%`;
  document.getElementById("result-ltv").className = `metric__value ${r.ltv <= RATE_SHEET.maxLtv ? "text-pass" : "text-fail"}`;
  document.getElementById("result-pitia").textContent = formatCurrency(r.pitia);

  document.getElementById("result-pi").textContent = formatCurrency(r.monthlyPI);
  const cfEl = document.getElementById("result-cashflow");
  cfEl.textContent = formatCurrency(r.monthlyCashFlow);
  cfEl.className = `summary-card__value ${r.monthlyCashFlow >= 0 ? "text-pass" : "text-fail"}`;

  document.getElementById("result-price").textContent = r.totalPoints.toFixed(3);

  const ptsEl = document.getElementById("result-points");
  if (r.discountPoints > 0) {
    ptsEl.textContent = `${r.discountPoints.toFixed(3)} pts (${formatCurrency(r.pointsCost)})`;
    ptsEl.className = "summary-card__value text-warn";
  } else if (r.lenderCredit > 0) {
    ptsEl.textContent = `${r.lenderCredit.toFixed(3)} credit (${formatCurrency(r.creditAmount)})`;
    ptsEl.className = "summary-card__value text-pass";
  } else {
    ptsEl.textContent = "At par";
    ptsEl.className = "summary-card__value";
  }

  const tbody = document.getElementById("adj-table-body");
  tbody.innerHTML = r.adjustments
    .filter((a) => a.category !== "base" || a.points !== 100)
  .map(
    (a) => `
      <tr>
        <td>${a.label}</td>
        <td class="${a.points > 0 ? "adj-positive" : a.points < 0 ? "adj-negative" : ""}">${a.points >= 0 ? "+" : ""}${a.points.toFixed(3)}</td>
      </tr>`
  )
    .join("");

  // Always show base
  tbody.insertAdjacentHTML(
    "afterbegin",
    `<tr><td>Base price (par)</td><td>100.000</td></tr>`
  );

  document.getElementById("adj-total").textContent = r.totalPoints.toFixed(3);

  const gList = document.getElementById("guideline-list");
  gList.innerHTML = r.eligibility.checks
    .map(
      (c) => `
      <li class="guideline-item ${c.pass ? "guideline-item--pass" : "guideline-item--fail"}">
        <span class="guideline-item__status" aria-hidden="true">${c.pass ? "✓" : "✗"}</span>
        <span>${c.label}</span>
        <span class="guideline-item__value">${c.value}</span>
      </li>`
    )
    .join("");
}

function debounce(fn, ms) {
  let t;
  return (...args) => {
    clearTimeout(t);
    t = setTimeout(() => fn(...args), ms);
  };
}

init();
