# Exemplar Equation Explorer

Reference layout for new **Equation Explorer** calculators. It mirrors how the production explorers are structured so you (and automation) know **what belongs in which file** without guessing.

## File map — write what where

| File | Put here |
|------|-----------|
| **`index.html`** | Page shell: `<meta>`, title, link to `cfa-base.css` then `*-specific.css`, CDN scripts (MathJax, Chart.js), **noscript** banner, **skip links**, **live regions** (`aria-live`), **card sections** in order: calculator → equation → visualizer (chart/table) → results. Use semantic IDs that match the JS contract (below). |
| **`cfa-base.css`** | **Do not edit for a single calculator.** Shared design system: `:root` tokens, layout (`.container`, `.card`, `.content`), inputs, tables, toggles, validation summary, skip links, `.force-table` behavior. Refresh this file from the canonical shared copy when updating the design system. |
| **`*-specific.css`** | **Only** rules for *this* explorer: extra layout, one-off chart heights, domain legend tweaks, new CSS variables for *this* topic’s series (e.g. “coupon” vs “principal”). Prefer `var(--color-…)` from base first. |
| **`calculator.js`** (or split `modules/` if the app grows) | All **behavior**: parse/validate inputs, compute, update DOM, **MathJax** `Hub.Queue(["Typeset", …])` + tabindex cleanup after render, **Chart.js** create/destroy, chart↔table view, narrow-screen handling, skip-link handlers, debounced input, `aria-pressed` on toggles. |

### Why one `calculator.js` here (no `utils.js`, `results.js`, …)

**On purpose.** The exemplar keeps everything in one module so the full pipeline is visible in one scroll and easy to copy into a new project. Production explorers (e.g. dividend) split **`modules/utils.js`**, **`validation.js`**, **`chart.js`**, **`table.js`**, **`results.js`**, **`equations.js`**, **`state.js`**, etc. when complexity warrants it.

**When to split:** multiple models, heavy chart logic, shared validation across files, or anything that makes a single file hard to review — then mirror the dividend layout: thin **`calculator.js`** entry that wires imports and subscriptions, with the same responsibilities moved into named modules.

## HTML ↔ `cfa-base.css` contract

These IDs/classes are relied on by **this** `cfa-base.css` (copied from the shared dividend base). If you rename them, update CSS or JS accordingly.

- **Chart / table toggle (narrow screens):** `body.force-table` (set when `window.innerWidth <= 600`), `#view-chart-btn`, `#view-table-btn`, `#chart-container`, `#table-container`.
- **Validation:** `#validation-summary`, `#validation-list`; summary uses `.validation-summary`, `.validation-title`.
- **Structure:** `.container` → `main.content` → `.card` → `.card-title`, `.card-content` where needed.

## Colours — does `cfa-base.css` have them all?

**Almost all *shared* colours yes** — they live under `:root` at the top of `cfa-base.css` (section “1. CSS VARIABLES”): brand blues/purples/greens/oranges/teals, gray scale, red/error states, success/warning, tinted backgrounds (`--color-bg-*`), and legacy aliases (`--color-primary`, `--color-mint`, etc.).

**Not in base:** colours that belong to **one product** only (e.g. bond PV/PMT/FV, binomial up/down paths). Those are defined in that explorer’s **`*-specific.css`** (or inline in HTML for legends). If you need a new *semantic* colour for a new topic, add a `--color-…` in **your** `*-specific.css` and use it in JS/HTML for charts and labels — only promote it to `cfa-base.css` if several explorers should share it.

**Prefer tokens over hex** in new code: e.g. `var(--color-blue-interactive)`, `var(--color-gray-600)`.

## Conventions worth keeping

1. **Two stylesheets** — `cfa-base.css` + `your-specific.css` (see discussion in repo; base stays portable).
2. **Inputs first** — calculator card before equation/visualizer (accessibility / SME pattern from existing explorers).
3. **MathJax** — Use config consistent with siblings (`MML_HTMLorMML` when injecting MathML); strip MathJax `tabindex` and set `aria-hidden` after typeset so focus order stays sane.
4. **Chart.js** — Destroy the previous instance before creating a new one; respect `prefers-reduced-motion`.
5. **Live regions** — Polite announcements for calculation/view updates; assertive for validation errors where appropriate.

## Simple model in this exemplar

Linear **y = mx + b**: trivial math on purpose. Replace the compute + MathML + chart/table sections with your domain logic while keeping the same file boundaries and contracts above.

## For LLMs / codegen

When adding a new explorer, **copy this folder**, rename the specific CSS/JS, then:

1. Read this README and skim `:root` in `cfa-base.css` before inventing new colours.
2. Keep **structural** IDs (`#view-chart-btn`, `#validation-summary`, …) unless you also update `cfa-base.css`.
3. Put **topic-specific** styling and variables only in **`*-specific.css`**.
