/**
 * Compound Interest Explorer — reference implementation consolidating common Equation Explorer patterns:
 * validation summary with in-page links, debounced input, MathJax typeset + tabindex cleanup,
 * Chart.js with reduced-motion handling, chart/table toggle (incl. narrow-width force-table),
 * skip links, and polite live regions for view and calculation updates.
 *
 * Formula: A = P × (1 + r)^n
 *   P = principal, r = periodic rate (decimal), n = number of periods
 */

const state = { view: 'chart' };

let chartInstance = null;
/** Last successfully computed series — used when toggling back to chart without a full recalc. */
let lastGoodSeries = null;

function $(sel) {
  return document.querySelector(sel);
}

function debounce(fn, ms) {
  let t;
  return (...args) => {
    clearTimeout(t);
    t = setTimeout(() => fn.apply(null, args), ms);
  };
}

/* ---------- Validation (pattern from production explorers) ---------- */

const RULES = {
  principal: { min: 1,    max: 1_000_000, label: 'Principal (P)' },
  rate:      { min: 0.01, max: 50,        label: 'Annual rate (r %)' },
  periods:   { min: 1,    max: 50, int: true, label: 'Periods (n)' },
};

function validateAll(raw) {
  const errors = {};
  for (const id of Object.keys(RULES)) {
    const r = RULES[id];
    const el = document.getElementById(id);
    const v = raw[id];
    if (el && (v === '' || v == null || Number.isNaN(v))) {
      errors[id] = `${r.label} is required`;
      continue;
    }
    if (r.int && !Number.isInteger(v)) {
      errors[id] = `${r.label} must be a whole number`;
      continue;
    }
    if (v < r.min) errors[id] = `${r.label} must be >= ${r.min}`;
    else if (v > r.max) errors[id] = `${r.label} must be <= ${r.max}`;
  }
  return errors;
}

function updateFieldError(fieldId, msg) {
  const el = document.getElementById(fieldId);
  if (!el) return;
  const hasError = !!msg;
  el.classList.toggle('error', hasError);
  el.setAttribute('aria-invalid', hasError ? 'true' : 'false');
  if (hasError) {
    const errorId = `${fieldId}-error`;
    el.setAttribute('aria-describedby', errorId);
    let errorEl = document.getElementById(errorId);
    if (!errorEl) {
      errorEl = document.createElement('span');
      errorEl.id = errorId;
      errorEl.className = 'sr-only';
      errorEl.setAttribute('role', 'alert');
      el.parentElement.appendChild(errorEl);
    }
    errorEl.textContent = msg;
  } else {
    el.removeAttribute('aria-describedby');
    const errorEl = document.getElementById(`${fieldId}-error`);
    if (errorEl) errorEl.remove();
  }
}

let validationLiveRegion = null;
function announceValidationCount(cnt) {
  if (!validationLiveRegion) {
    validationLiveRegion = document.createElement('div');
    validationLiveRegion.id = 'validation-live-region';
    validationLiveRegion.className = 'sr-only';
    validationLiveRegion.setAttribute('aria-live', 'polite');
    validationLiveRegion.setAttribute('aria-atomic', 'true');
    document.body.appendChild(validationLiveRegion);
  }
  validationLiveRegion.textContent = `${cnt} validation ${cnt === 1 ? 'error' : 'errors'}.`;
  setTimeout(() => {
    validationLiveRegion.textContent = '';
  }, 1500);
}

function updateValidationSummary(errors) {
  const sum = $('#validation-summary');
  const list = $('#validation-list');
  if (!sum || !list) return;

  const cnt = Object.keys(errors).length;
  const wasHidden = sum.style.display === 'none';

  if (cnt) {
    list.innerHTML = Object.entries(errors)
      .map(
        ([f, m]) =>
          `<li><a href="#${f}" data-field="${f}" class="validation-error-link">${m}</a></li>`
      )
      .join('');
    sum.style.display = 'block';
    announceValidationCount(cnt);

    list.querySelectorAll('.validation-error-link').forEach((link) => {
      link.addEventListener('click', (e) => {
        e.preventDefault();
        const fieldId = link.getAttribute('data-field');
        const field = document.getElementById(fieldId);
        if (field) {
          field.focus();
          if (typeof field.select === 'function') field.select();
          field.scrollIntoView({ behavior: 'smooth', block: 'center' });
        }
      });
    });

    if (wasHidden) {
      sum.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
    }
  } else {
    sum.style.display = 'none';
  }
}

function hasErrors(errors) {
  return Object.keys(errors).length > 0;
}

/* ---------- Math ---------- */

function readInputs() {
  // Principal is type="text" with comma formatting — strip commas before parsing.
  const rawPrincipal = document.getElementById('principal').value.replace(/,/g, '');
  const principal = Number(rawPrincipal);
  const rate      = Number(document.getElementById('rate').value);
  const periods   = Number(document.getElementById('periods').value);
  return { principal, rate, periods };
}

/** Format a raw number string as a comma-separated integer for display. */
function formatPrincipalDisplay(raw) {
  const n = Number(raw.replace(/,/g, ''));
  if (!Number.isFinite(n) || raw.trim() === '') return raw;
  return Math.round(n).toLocaleString('en-US');
}

function setupPrincipalFormatting() {
  const el = document.getElementById('principal');
  if (!el) return;

  // On focus: strip commas so the user edits a plain number.
  el.addEventListener('focus', () => {
    el.value = el.value.replace(/,/g, '');
  });

  // On blur: re-apply comma formatting if the value is a valid number.
  el.addEventListener('blur', () => {
    const raw = el.value.replace(/,/g, '');
    const n = Number(raw);
    if (raw !== '' && Number.isFinite(n) && n > 0) {
      el.value = Math.round(n).toLocaleString('en-US');
    }
  });
}

/**
 * Compute accumulated amount A for each period t = 0..n.
 * @param {number} P  Principal
 * @param {number} r  Annual rate as a percentage (e.g. 5 for 5%)
 * @param {number} n  Number of periods
 */
function computeSeries(P, r, n) {
  const rDecimal = r / 100;
  const xs = [];
  const ys = [];
  for (let t = 0; t <= n; t++) {
    xs.push(t);
    ys.push(P * Math.pow(1 + rDecimal, t));
  }
  return { xs, ys };
}

/** Format a value as currency (2 dp, thousands-separated). */
function fmtCurrency(v) {
  if (!Number.isFinite(v)) return '0.00';
  return v.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

/** Format the rate percentage as its decimal equivalent, stripping trailing zeros. */
function fmtRateDecimal(r) {
  const d = r / 100;
  const s = d.toFixed(4).replace(/\.?0+$/, '');
  return s || '0';
}

function buildMathML(P, r, n) {
  const pStr = P.toLocaleString('en-US');
  const rStr = fmtRateDecimal(r);
  return `<math xmlns="http://www.w3.org/1998/Math/MathML" display="block"><mrow>
    <mi mathcolor="#3c6ae5">A</mi>
    <mo>=</mo>
    <mn mathcolor="#15803d">${pStr}</mn>
    <mo>&#x00D7;</mo>
    <msup>
      <mrow>
        <mo>(</mo>
        <mn>1</mn>
        <mo>+</mo>
        <mn mathcolor="#b95b1d">${rStr}</mn>
        <mo>)</mo>
      </mrow>
      <mn mathcolor="#0079a6">${n}</mn>
    </msup>
  </mrow></math>`;
}

function cleanMathJaxAccessibility() {
  document.querySelectorAll('[tabindex]').forEach((el) => {
    if (
      el.classList.contains('MathJax') ||
      el.classList.contains('MathJax_Display') ||
      (el.id && el.id.indexOf('MathJax-') === 0) ||
      el.tagName === 'MATH' ||
      (el.closest && el.closest('.MathJax'))
    ) {
      el.removeAttribute('tabindex');
      el.setAttribute('aria-hidden', 'true');
    }
  });
}

function renderEquation(P, r, n) {
  const mount = $('#dynamic-mathml-equation');
  if (!mount) return;
  mount.innerHTML = buildMathML(P, r, n);

  if (typeof window.MathJax !== 'undefined' && window.MathJax.Hub) {
    window.MathJax.Hub.Queue(['Typeset', window.MathJax.Hub, mount], () => {
      cleanMathJaxAccessibility();
      setTimeout(cleanMathJaxAccessibility, 50);
      setTimeout(cleanMathJaxAccessibility, 200);
    });
  }
}

/* ---------- Chart ---------- */

function destroyChart() {
  if (chartInstance) {
    chartInstance.destroy();
    chartInstance = null;
  }
}

function renderChart(xs, ys) {
  const canvas = $('#chart');
  if (!canvas) return;

  const prefersReducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;

  destroyChart();
  const ctx = canvas.getContext('2d');
  chartInstance = new window.Chart(ctx, {
    type: 'line',
    data: {
      labels: xs.map(String),
      datasets: [
        {
          label: 'Amount (A)',
          data: ys,
          borderColor: '#3c6ae5',
          backgroundColor: 'rgba(60, 106, 229, 0.12)',
          fill: true,
          tension: 0.3,
          pointRadius: 4,
          pointHoverRadius: 6,
        },
      ],
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      animation: prefersReducedMotion ? false : undefined,
      interaction: { mode: 'index', intersect: false },
      plugins: {
        legend: { display: false },
        tooltip: {
          callbacks: {
            label(ctx) {
              return `A = ${fmtCurrency(ctx.parsed.y)}`;
            },
          },
        },
      },
      scales: {
        x: {
          title: { display: true, text: 'Period (n)' },
          grid: { color: 'rgba(0,0,0,0.06)' },
        },
        y: {
          title: { display: true, text: 'Amount (A)' },
          grid: { color: 'rgba(0,0,0,0.06)' },
          ticks: {
            callback: (v) => fmtCurrency(v),
          },
        },
      },
    },
  });
}

/* ---------- Table & results ---------- */

function renderTable(xs, ys) {
  const body = $('#table-body');
  if (!body) return;
  body.innerHTML = xs
    .map((x, i) => {
      const y = ys[i];
      return `<tr>
        <td data-label="Period (n)">${x}</td>
        <td data-label="Amount (A)">${fmtCurrency(y)}</td>
      </tr>`;
    })
    .join('');
}

function renderResults(P, r, n, ys) {
  const root = $('#results-content');
  if (!root) return;
  const A = ys[ys.length - 1];
  const interest = A - P;
  const multiple = A / P;

  root.innerHTML = `
    <div class="exemplar-result-block">
      <span class="label">Final amount after ${n} period${n === 1 ? '' : 's'}</span>
      <span class="value">${fmtCurrency(A)}</span>
    </div>
    <div class="exemplar-result-block">
      <span class="label">Interest earned</span>
      <span class="value">${fmtCurrency(interest)}</span>
    </div>
    <div class="exemplar-result-block">
      <span class="label">Growth multiple</span>
      <span class="value">${multiple.toFixed(4)}×</span>
    </div>
    <div class="exemplar-result-block">
      <span class="label">Total return</span>
      <span class="value">${((multiple - 1) * 100).toFixed(2)}%</span>
    </div>
  `;
}

/* ---------- View + narrow screen ---------- */

function updateButtonStates() {
  const chartBtn = $('#view-chart-btn');
  const tableBtn = $('#view-table-btn');
  const isForced = document.body.classList.contains('force-table');
  const current = isForced ? 'table' : state.view;

  if (!chartBtn || !tableBtn) return;

  chartBtn.classList.toggle('active', current === 'chart');
  tableBtn.classList.toggle('active', current === 'table');
  chartBtn.setAttribute('aria-pressed', current === 'chart');
  tableBtn.setAttribute('aria-pressed', current === 'table');
  chartBtn.disabled = isForced;
}

function announceView(label) {
  const el = $('#view-announcement');
  if (el) {
    el.textContent = '';
    setTimeout(() => {
      el.textContent = label;
    }, 30);
  }
}

function applyView() {
  const chartWrap = $('#chart-container');
  const tableWrap = $('#table-container');
  const note = $('#chart-accessibility-note');
  if (!chartWrap || !tableWrap) return;

  const isForced = document.body.classList.contains('force-table');
  const actual = isForced ? 'table' : state.view;

  if (actual === 'chart' && !isForced) {
    chartWrap.style.display = 'block';
    tableWrap.style.display = 'none';
    if (note) note.hidden = false;
  } else {
    chartWrap.style.display = 'none';
    tableWrap.style.display = 'block';
    if (note) note.hidden = true;
    destroyChart();
  }
}

function setView(view) {
  if (document.body.classList.contains('force-table') && view === 'chart') {
    return;
  }
  state.view = view;
  updateButtonStates();
  applyView();
  announceView(view === 'chart' ? 'Chart view' : 'Table view');

  const isForced = document.body.classList.contains('force-table');
  if (!isForced && state.view === 'chart' && lastGoodSeries) {
    renderChart(lastGoodSeries.xs, lastGoodSeries.ys);
  }
}

function detectNarrowScreen() {
  const narrow = window.innerWidth <= 600;
  const helper = $('#chart-helper-text');

  if (narrow) {
    document.body.classList.add('force-table');
    state.view = 'table';
    if (helper) helper.style.display = 'block';
  } else {
    document.body.classList.remove('force-table');
    if (helper) helper.style.display = 'none';
  }
  updateButtonStates();
  applyView();
}

/* ---------- Skip links ---------- */

function setupSkipLinks() {
  document.querySelectorAll('.skip-link').forEach((link) => {
    link.addEventListener('click', (e) => {
      const href = link.getAttribute('href');
      if (!href || href.charAt(0) !== '#') return;
      const id = href.slice(1);
      if (id === 'view-table-btn') {
        e.preventDefault();
        setView('table');
        setTimeout(() => {
          const tableBtn = $('#view-table-btn');
          const tableWrap = $('#table-container');
          if (tableWrap) tableWrap.scrollIntoView({ behavior: 'smooth', block: 'start' });
          setTimeout(() => tableBtn && tableBtn.focus(), 400);
        }, 50);
        return;
      }
      const target = document.getElementById(id);
      if (target) {
        e.preventDefault();
        target.focus();
        target.scrollIntoView({ behavior: 'smooth', block: 'start' });
      }
    });
  });
}

/* ---------- Live region: calculation updated ---------- */

const announceCalculation = debounce(() => {
  const region = $('#calculation-announcement');
  if (!region) return;
  region.textContent = '';
  setTimeout(() => {
    region.textContent = 'Results updated.';
  }, 50);
}, 800);

/* ---------- Main update ---------- */

function refreshAll() {
  const raw = readInputs();
  const errors = validateAll(raw);

  ['principal', 'rate', 'periods'].forEach((id) => {
    updateFieldError(id, errors[id] || null);
  });
  updateValidationSummary(errors);

  if (hasErrors(errors)) {
    destroyChart();
    lastGoodSeries = null;
    return;
  }

  const { principal: P, rate: r, periods: n } = raw;
  const { xs, ys } = computeSeries(P, r, n);
  lastGoodSeries = { xs, ys };

  renderEquation(P, r, n);
  renderTable(xs, ys);
  renderResults(P, r, n, ys);

  const isForced = document.body.classList.contains('force-table');
  const showChart = state.view === 'chart' && !isForced;

  applyView();
  if (showChart) {
    renderChart(xs, ys);
  }

  announceCalculation();
}

const onInput = debounce(refreshAll, 250);

function setupViewToggle() {
  const chartBtn = $('#view-chart-btn');
  const tableBtn = $('#view-table-btn');

  updateButtonStates();

  if (chartBtn) {
    chartBtn.addEventListener(
      'click',
      (e) => {
        if (document.body.classList.contains('force-table') || chartBtn.disabled) {
          e.preventDefault();
          e.stopPropagation();
          setView('table');
          return false;
        }
        setView('chart');
      },
      true
    );
  }

  if (tableBtn) {
    tableBtn.addEventListener('click', () => setView('table'));
  }

  [chartBtn, tableBtn].forEach((btn) => {
    if (!btn) return;
    btn.addEventListener('keydown', (e) => {
      if (e.key === 'ArrowRight' || e.key === 'ArrowLeft') {
        e.preventDefault();
        const next = btn === chartBtn ? tableBtn : chartBtn;
        if (next) next.focus();
        if (next === chartBtn && !document.body.classList.contains('force-table')) {
          setView('chart');
        } else {
          setView('table');
        }
      }
    });
  });
}

function setupInputs() {
  ['principal', 'rate', 'periods'].forEach((id) => {
    const el = document.getElementById(id);
    if (!el) return;
    ['input', 'change', 'blur'].forEach((ev) => el.addEventListener(ev, onInput));
  });
}

function init() {
  detectNarrowScreen();
  window.addEventListener('resize', debounce(detectNarrowScreen, 200));

  setupPrincipalFormatting();
  setupInputs();
  setupViewToggle();
  setupSkipLinks();
  refreshAll();
}

if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', init);
} else {
  init();
}