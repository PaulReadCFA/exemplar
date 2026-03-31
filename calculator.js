/**
 * Compound Interest Explorer — reference implementation consolidating common Equation Explorer patterns:
 * validation summary with in-page links, debounced input, MathJax typeset + tabindex cleanup,
 * Chart.js with reduced-motion handling, chart/table toggle (incl. narrow-width force-table),
 * skip links, a polite live region for view changes, and an on-demand results summary for screen readers.
 *
 * Formula: A = P × (1 + r)^n
 *   P = principal, r = periodic rate (decimal), n = number of periods
 */

const state = { view: 'chart' };

let chartInstance = null;
/** Last successfully computed series — used when toggling back to chart without a full recalc. */
let lastGoodSeries = null;
/** Last keyboard-focused point index (line chart); restored on chart focus. */
let chartKeyboardIndex = 0;

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

/**
 * JS equivalent of CSS `prefers-reduced-motion: reduce` (same user preference, readable from script).
 * Use for canvas APIs (Chart.js) that do not consult CSS media queries on their own.
 */
function reducedMotionPreferred() {
  try {
    return window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  } catch {
    return false;
  }
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
  const baseHelpId = 'inputHelp';
  const errorId = `${fieldId}-error`;
  el.classList.toggle('error', hasError);
  el.setAttribute('aria-invalid', hasError ? 'true' : 'false');
  if (hasError) {
    el.setAttribute('aria-describedby', `${baseHelpId} ${errorId}`);
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
    el.setAttribute('aria-describedby', baseHelpId);
    const errorEl = document.getElementById(errorId);
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

function filterPrincipalValue(raw) {
  return raw.replace(/[^\d,]/g, '');
}

function setupPrincipalFormatting() {
  const el = document.getElementById('principal');
  if (!el) return;

  const onPrincipalChange = () => {
    const cleaned = filterPrincipalValue(el.value);
    if (cleaned !== el.value) {
      const pos = Math.min(el.selectionStart ?? cleaned.length, cleaned.length);
      el.value = cleaned;
      el.setSelectionRange?.(pos, pos);
    }
  };

  // Digits and comma only (comma formatting on blur).
  el.addEventListener('beforeinput', (e) => {
    if (e.inputType !== 'insertText' || !e.data) return;
    if (e.data.replace(/[\d,]/g, '').length) e.preventDefault();
  });
  el.addEventListener('input', onPrincipalChange);
  el.addEventListener('paste', (e) => {
    e.preventDefault();
    const pasted = (e.clipboardData?.getData('text') || '').replace(/[^\d,]/g, '');
    const start = el.selectionStart ?? 0;
    const end = el.selectionEnd ?? 0;
    el.value = el.value.slice(0, start) + pasted + el.value.slice(end);
    onPrincipalChange();
    const caret = start + pasted.length;
    el.setSelectionRange?.(caret, caret);
  });

  // On focus: strip commas so the user edits a plain number.
  el.addEventListener('focus', () => {
    el.value = el.value.replace(/,/g, '');
  });

  // On blur: re-apply comma formatting if the value is a valid number.
  el.addEventListener('blur', () => {
    const raw = el.value.replace(/,/g, '');
    const n = Number(raw);
    if (raw !== '' && Number.isFinite(n) && n > 0) {
      el.value = n.toLocaleString('en-US', { maximumFractionDigits: 20 });
    }
  });
}

function setupNumberOnlyFields() {
  const blockExprChars = (e) => {
    if (e.key === 'e' || e.key === 'E' || e.key === '+' || e.key === '-') e.preventDefault();
  };
  const rate = document.getElementById('rate');
  const periods = document.getElementById('periods');
  if (rate) rate.addEventListener('keydown', blockExprChars);
  if (periods) periods.addEventListener('keydown', blockExprChars);

  const filterPeriods = () => {
    if (!periods) return;
    const cleaned = periods.value.replace(/[^\d]/g, '');
    if (cleaned !== periods.value) {
      const pos = Math.min(periods.selectionStart ?? cleaned.length, cleaned.length);
      periods.value = cleaned;
      periods.setSelectionRange?.(pos, pos);
    }
  };
  if (periods) {
    periods.addEventListener('beforeinput', (e) => {
      if (e.inputType !== 'insertText' || !e.data) return;
      if (/\D/.test(e.data)) e.preventDefault();
    });
    periods.addEventListener('input', filterPeriods);
    periods.addEventListener('paste', (e) => {
      e.preventDefault();
      const pasted = (e.clipboardData?.getData('text') || '').replace(/\D/g, '');
      const start = periods.selectionStart ?? 0;
      const end = periods.selectionEnd ?? 0;
      periods.value = periods.value.slice(0, start) + pasted + periods.value.slice(end);
      filterPeriods();
      const caret = start + pasted.length;
      periods.setSelectionRange?.(caret, caret);
    });
  }

  const filterRate = () => {
    if (!rate) return;
    let v = rate.value.replace(/[^\d.]/g, '');
    const firstDot = v.indexOf('.');
    if (firstDot !== -1) {
      v = v.slice(0, firstDot + 1) + v.slice(firstDot + 1).replace(/\./g, '');
    }
    if (v !== rate.value) {
      const pos = Math.min(rate.selectionStart ?? v.length, v.length);
      rate.value = v;
      rate.setSelectionRange?.(pos, pos);
    }
  };
  if (rate) {
    rate.addEventListener('beforeinput', (e) => {
      if (e.inputType !== 'insertText' || !e.data) return;
      if (e.data.replace(/[\d.]/g, '').length) e.preventDefault();
    });
    rate.addEventListener('input', filterRate);
    rate.addEventListener('paste', (e) => {
      e.preventDefault();
      const pasted = (e.clipboardData?.getData('text') || '').replace(/[^\d.]/g, '');
      const start = rate.selectionStart ?? 0;
      const end = rate.selectionEnd ?? 0;
      rate.value = rate.value.slice(0, start) + pasted + rate.value.slice(end);
      filterRate();
      const caret = start + pasted.length;
      rate.setSelectionRange?.(caret, caret);
    });
  }
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

/** Plain amount with separators (no currency suffix). */
function fmtMoneyAmount(v) {
  if (!Number.isFinite(v)) return '0.00';
  return v.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

/** Visible: `USD1,234.56` (no space; prefix). */
function fmtMoneyVisual(v) {
  return `USD${fmtMoneyAmount(v)}`;
}

/** Spoken-friendly for aria-label and live regions (not “U-S-D”). */
function fmtMoneySpeech(v) {
  return `${fmtMoneyAmount(v)} dollars`;
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
    if (el.closest && el.closest('#dynamic-equation-container')) return;
    if (
      el.classList.contains('MathJax') ||
      el.classList.contains('MathJax_Display') ||
      (el.id && el.id.indexOf('MathJax-') === 0) ||
      el.tagName === 'MATH' ||
      (el.closest && el.closest('.MathJax'))
    ) {
      el.removeAttribute('tabindex');
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

function teardownChartKeyboardNav(canvas) {
  if (!canvas || !canvas._exemplarChartKeyNav) return;
  const { keydown, focusin, blur } = canvas._exemplarChartKeyNav;
  canvas.removeEventListener('keydown', keydown);
  canvas.removeEventListener('focusin', focusin);
  canvas.removeEventListener('blur', blur);
  delete canvas._exemplarChartKeyNav;
}

function clearCanvasChartFocus() {
  const region = $('#chart-point-announcement');
  if (region) region.textContent = '';
  if (!chartInstance) return;
  chartInstance.setActiveElements([]);
  const tip = chartInstance.tooltip;
  if (tip && typeof tip.setActiveElements === 'function') {
    try {
      tip.setActiveElements([], { x: 0, y: 0 });
    } catch {
      /* Chart.js API differences; clearing chart active elements is enough */
    }
  }
  chartInstance.update();
}

function announceChartPoint(periodLabel, y) {
  const el = $('#chart-point-announcement');
  if (!el || el.getAttribute('aria-hidden') === 'true') return;
  el.textContent = '';
  setTimeout(() => {
    el.textContent = `Period ${periodLabel}, amount A ${fmtMoneySpeech(y)}.`;
  }, 30);
}

function activateChartTooltipAtIndex(chart, index) {
  if (!chart) return;
  const meta = chart.getDatasetMeta(0);
  if (!meta || !meta.data || !meta.data[index]) return;
  const element = meta.data[index];
  const xy =
    typeof element.getCenterPoint === 'function'
      ? element.getCenterPoint()
      : { x: element.x, y: element.y };
  const active = [{ datasetIndex: 0, index }];
  chart.setActiveElements(active);
  const tip = chart.tooltip;
  if (tip && typeof tip.setActiveElements === 'function') {
    tip.setActiveElements(active, xy);
  }
  chart.update();
  chartKeyboardIndex = index;
  const labels = chart.data.labels;
  const ys = chart.data.datasets[0].data;
  announceChartPoint(labels[index], ys[index]);
}

function setupChartKeyboardNav(canvas) {
  teardownChartKeyboardNav(canvas);

  const keydown = (e) => {
    if (!chartInstance) return;
    const meta = chartInstance.getDatasetMeta(0);
    const len = meta && meta.data ? meta.data.length : 0;
    if (!len) return;
    if (e.key !== 'ArrowLeft' && e.key !== 'ArrowRight' && e.key !== 'Home' && e.key !== 'End') return;
    e.preventDefault();
    const current = chartInstance.getActiveElements();
    let idx = current.length ? current[0].index : chartKeyboardIndex;
    if (e.key === 'Home') idx = 0;
    else if (e.key === 'End') idx = len - 1;
    else if (e.key === 'ArrowLeft') idx = idx > 0 ? idx - 1 : len - 1;
    else if (e.key === 'ArrowRight') idx = idx < len - 1 ? idx + 1 : 0;
    idx = Math.max(0, Math.min(len - 1, idx));
    activateChartTooltipAtIndex(chartInstance, idx);
  };

  const focusin = () => {
    if (!chartInstance) return;
    const meta = chartInstance.getDatasetMeta(0);
    const len = meta && meta.data ? meta.data.length : 0;
    if (!len) return;
    const idx = Math.min(Math.max(0, chartKeyboardIndex), len - 1);
    activateChartTooltipAtIndex(chartInstance, idx);
  };

  const blur = () => clearCanvasChartFocus();

  canvas.addEventListener('keydown', keydown);
  canvas.addEventListener('focusin', focusin);
  canvas.addEventListener('blur', blur);
  canvas._exemplarChartKeyNav = { keydown, focusin, blur };
}

function destroyChart() {
  const canvas = $('#chart');
  teardownChartKeyboardNav(canvas);
  if (chartInstance) {
    chartInstance.destroy();
    chartInstance = null;
  }
}

function renderChart(xs, ys) {
  const canvas = $('#chart');
  if (!canvas) return;
  if (typeof window.Chart !== 'function') {
    setView('table');
    announceView('Table view (chart unavailable)');
    return;
  }

  const reduceMotion = reducedMotionPreferred();

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
      animation: reduceMotion ? false : undefined,
      /* Hover / show-hide without easing when reduced motion is requested */
      transitions: reduceMotion
        ? {
            active: { animation: { duration: 0 } },
            show: { animation: { duration: 0 } },
            hide: { animation: { duration: 0 } },
            resize: { animation: { duration: 0 } },
          }
        : undefined,
      interaction: { mode: 'index', intersect: false },
      plugins: {
        legend: { display: false },
        tooltip: {
          animation: reduceMotion ? false : undefined,
          /* Match legend variable A (#1a3378), not the pale series fill colour */
          backgroundColor: '#ffffff',
          titleColor: '#1f2937',
          bodyColor: '#1a3378',
          borderColor: '#e5e7eb',
          borderWidth: 1,
          displayColors: true,
          callbacks: {
            labelColor() {
              return { borderColor: '#1a3378', backgroundColor: '#1a3378' };
            },
            labelTextColor() {
              return '#1a3378';
            },
            title(items) {
              if (!items.length) return '';
              return `Period (n) = ${items[0].label}`;
            },
            label(ctx) {
              return `A = ${fmtMoneyVisual(ctx.parsed.y)}`;
            },
          },
        },
      },
      scales: {
        x: {
          title: {
            display: true,
            text: 'Period (n)',
            color: '#1f2937',
          },
          ticks: { color: '#374151' },
          grid: { color: 'rgba(0,0,0,0.06)' },
        },
        y: {
          title: {
            display: true,
            text: 'Amount (A), USD',
            color: '#1f2937',
          },
          ticks: {
            color: '#374151',
            callback: (v) => fmtMoneyAmount(v),
          },
          grid: { color: 'rgba(0,0,0,0.06)' },
        },
      },
    },
  });

  chartKeyboardIndex = 0;
  setupChartKeyboardNav(canvas);
}

/** Rebuild chart when the user toggles “reduce motion” in the OS so tooltip/popup behaviour updates without reload. */
function setupReducedMotionMediaListener() {
  let mq;
  try {
    mq = window.matchMedia('(prefers-reduced-motion: reduce)');
  } catch {
    return;
  }
  const rerenderChartIfVisible = () => {
    const forced = document.body.classList.contains('force-table');
    if (forced || state.view !== 'chart' || !lastGoodSeries || typeof window.Chart !== 'function') return;
    renderChart(lastGoodSeries.xs, lastGoodSeries.ys);
  };
  if (typeof mq.addEventListener === 'function') {
    mq.addEventListener('change', rerenderChartIfVisible);
  } else if (typeof mq.addListener === 'function') {
    mq.addListener(rerenderChartIfVisible);
  }
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
        <td data-label="Amount (A), USD" aria-label="${fmtMoneySpeech(y)}">${fmtMoneyAmount(y)}</td>
      </tr>`;
    })
    .join('');
}

/** Spoken summary for the Results card (used when the user explicitly requests it). */
function buildResultsSpokenSummary(P, r, n, ys) {
  const A = ys[ys.length - 1];
  const interest = A - P;
  const multiple = A / P;
  const pct = ((multiple - 1) * 100).toFixed(2);
  return (
    `Final amount after ${n} period${n === 1 ? '' : 's'}: ${fmtMoneySpeech(A)}. ` +
    `Interest earned: ${fmtMoneySpeech(interest)}. ` +
    `Growth multiple: ${multiple.toFixed(4)} times. Total return: ${pct} percent.`
  );
}

function renderResults(P, r, n, ys) {
  const root = $('#results-content');
  if (!root) return;
  const A = ys[ys.length - 1];
  const interest = A - P;
  const multiple = A / P;

  root.innerHTML = `
    <p class="exemplar-result-block">
      <span class="label">Final amount after ${n} period${n === 1 ? '' : 's'}</span>
      <span class="value" aria-label="${fmtMoneySpeech(A)}">${fmtMoneyVisual(A)}</span>
    </p>
    <p class="exemplar-result-block">
      <span class="label">Interest earned</span>
      <span class="value" aria-label="${fmtMoneySpeech(interest)}">${fmtMoneyVisual(interest)}</span>
    </p>
    <p class="exemplar-result-block">
      <span class="label">Growth multiple</span>
      <span class="value">${multiple.toFixed(4)}×</span>
    </p>
    <p class="exemplar-result-block">
      <span class="label">Total return</span>
      <span class="value">${((multiple - 1) * 100).toFixed(2)}%</span>
    </p>
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

  // Roving tabindex: one toolbar control in tab order (WAI-ARIA toolbar pattern).
  if (isForced) {
    chartBtn.tabIndex = -1;
    tableBtn.tabIndex = 0;
  } else if (current === 'chart') {
    chartBtn.tabIndex = 0;
    tableBtn.tabIndex = -1;
  } else {
    chartBtn.tabIndex = -1;
    tableBtn.tabIndex = 0;
  }
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
  const chartPointLive = $('#chart-point-announcement');
  const chartKbHelp = $('#chart-keyboard-help');
  if (!chartWrap || !tableWrap) return;

  const isForced = document.body.classList.contains('force-table');
  const actual = isForced ? 'table' : state.view;

  const canvas = $('#chart');
  if (actual === 'chart' && !isForced) {
    chartWrap.style.display = 'block';
    tableWrap.style.display = 'none';
    chartWrap.removeAttribute('aria-hidden');
    tableWrap.setAttribute('aria-hidden', 'true');
    if (chartPointLive) {
      chartPointLive.textContent = '';
      chartPointLive.removeAttribute('aria-hidden');
    }
    if (chartKbHelp) chartKbHelp.removeAttribute('aria-hidden');
    if (note) note.hidden = false;
    if (canvas) canvas.tabIndex = 0;
  } else {
    chartWrap.style.display = 'none';
    tableWrap.style.display = 'block';
    chartWrap.setAttribute('aria-hidden', 'true');
    tableWrap.removeAttribute('aria-hidden');
    if (chartPointLive) {
      chartPointLive.textContent = '';
      chartPointLive.setAttribute('aria-hidden', 'true');
    }
    if (chartKbHelp) chartKbHelp.setAttribute('aria-hidden', 'true');
    if (note) note.hidden = true;
    if (canvas) canvas.tabIndex = -1;
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
  announceView(
    view === 'chart'
      ? 'Chart view. Data table is hidden.'
      : 'Table view. Chart and chart announcements are hidden.',
  );

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

/* ---------- Live region: results summary on demand ---------- */

function announceResultsOnDemand() {
  const region = $('#calculation-announcement');
  if (!region) return;
  const raw = readInputs();
  const errors = validateAll(raw);
  let msg;
  if (hasErrors(errors)) {
    msg = 'Results are not available until the inputs are valid.';
  } else {
    const { principal: P, rate: r, periods: n } = raw;
    const { ys } = computeSeries(P, r, n);
    msg = buildResultsSpokenSummary(P, r, n, ys);
  }
  region.textContent = '';
  setTimeout(() => {
    region.textContent = msg;
  }, 50);
}

function setupAnnounceResultsButton() {
  const btn = $('#announce-results-btn');
  if (btn) btn.addEventListener('click', announceResultsOnDemand);
}

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
      const forced = document.body.classList.contains('force-table');
      if (e.key === 'Home' && chartBtn && !forced) {
        e.preventDefault();
        chartBtn.focus();
        setView('chart');
        return;
      }
      if (e.key === 'End' && tableBtn) {
        e.preventDefault();
        tableBtn.focus();
        setView('table');
        return;
      }
      if (e.key === 'ArrowRight' || e.key === 'ArrowLeft') {
        e.preventDefault();
        const next = btn === chartBtn ? tableBtn : chartBtn;
        if (next) next.focus();
        if (next === chartBtn && !forced) {
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
  setupNumberOnlyFields();
  setupInputs();
  setupViewToggle();
  setupSkipLinks();
  setupReducedMotionMediaListener();
  setupAnnounceResultsButton();
  refreshAll();
}

if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', init);
} else {
  init();
}