# Exemplar Equation Explorer

Reference layout for new **Equation Explorer** calculators. This folder demonstrates a complete, accessible compound-interest explorer and documents what each file is responsible for.

## File map — what each file is for

| File | Purpose |
|------|---------|
| **`index.html`** | Main interactive page. Contains structure and semantics: metadata, stylesheet/script includes, skip links, calculator inputs, dynamic equation mount, chart/table view toggle, table container, results container, and live regions used by JS announcements. |
| **`calculator.js`** | Main behavior module for `index.html`: input parsing/validation, series computation (`A = P(1 + r)^n`), dynamic MathML rendering + MathJax typesetting, chart/table rendering, view toggle behavior, responsive force-table behavior, skip-link handling, and accessibility announcements. |
| **`cfa-base.css`** | Shared base design system used across explorers. Includes color tokens, layout primitives, card styles, form controls, table styles, toggle button styles, validation summary styles, skip-link utilities, and responsive table/card behavior. Treat as shared infrastructure, not one-off page styling. |
| **`exemplar-specific.css`** | Page-specific overrides/extensions for this explorer only: input row layout, equation/visualizer sizing tweaks, results styling, and exemplar-level accessibility/contrast adjustments (for example table-header variable colors and high-zoom table overflow handling). |
| **`formula.html`** | Standalone page with **only** the typeset equation (no prose, legend, or controls). Same MathJax setup as `index.html`. |
| **`README.md`** | Usage notes and conventions for copying this exemplar into new calculators. |

### Why one `calculator.js` here (no `utils.js`, `results.js`, …)

**On purpose.** The exemplar keeps everything in one module so the full pipeline is visible in one scroll and easy to copy into a new project. Production explorers (e.g. dividend) split **`modules/utils.js`**, **`validation.js`**, **`chart.js`**, **`table.js`**, **`results.js`**, **`equations.js`**, **`state.js`**, etc. when complexity warrants it.

**When to split:** multiple models, heavy chart logic, shared validation across files, or anything that makes a single file hard to review — then mirror the dividend layout: thin **`calculator.js`** entry that wires imports and subscriptions, with the same responsibilities moved into named modules.

## HTML/JS contract (important IDs)

These IDs/classes are relied on by **this** `cfa-base.css` (copied from the shared dividend base). If you rename them, update CSS or JS accordingly.

- **Chart / table toggle (narrow screens):** `body.force-table` (set when `window.innerWidth <= 600`), `#view-chart-btn`, `#view-table-btn`, `#chart-container`, `#table-container`.
- **Validation:** `#validation-summary`, `#validation-list`; summary uses `.validation-summary`, `.validation-title`.
- **Structure:** `.container` → `main.content` → `.card` → `.card-title`, `.card-content`.
- **Dynamic mounts:** `#dynamic-mathml-equation`, `#table-body`, `#results-content`, `#view-announcement`, `#calculation-announcement`.

## Colours — does `cfa-base.css` have them all?

**Almost all *shared* colours yes** — they live under `:root` at the top of `cfa-base.css` (section “1. CSS VARIABLES”): brand blues/purples/greens/oranges/teals, gray scale, red/error states, success/warning, tinted backgrounds (`--color-bg-*`), and legacy aliases (`--color-primary`, `--color-mint`, etc.).

**Not in base:** colours that belong to **one product** only (e.g. bond PV/PMT/FV, binomial up/down paths). Those are defined in that explorer’s **`*-specific.css`** (or inline in HTML for legends). If you need a new *semantic* colour for a new topic, add a `--color-…` in **your** `*-specific.css` and use it in JS/HTML for charts and labels — only promote it to `cfa-base.css` if several explorers should share it.

**Prefer tokens over hex** in new code: e.g. `var(--color-blue-interactive)`, `var(--color-gray-600)`.

## Conventions worth keeping

1. **Two stylesheets** — `cfa-base.css` + `your-specific.css` (see discussion in repo; base stays portable).
2. **Inputs first** — calculator card before equation/visualizer (accessibility / SME pattern from existing explorers).
3. **MathJax** — Use config consistent with siblings (`MML_HTMLorMML` when injecting MathML); strip MathJax `tabindex` after typeset so focus order stays sane, but do not hide the math from assistive tech.
4. **Chart.js** — Destroy the previous instance before creating a new one; respect `prefers-reduced-motion`.
5. **Live regions** — Polite announcements for calculation/view updates; assertive for validation errors where appropriate.

## Model used in this exemplar

Compound interest **`A = P(1 + r)^n`**. Replace compute + MathML + chart/table/result rendering with your domain logic while keeping the same file boundaries and accessibility contracts above.

## For LLMs / codegen

When adding a new explorer, **copy this folder**, rename the specific CSS/JS, then:

1. Read this README and skim `:root` in `cfa-base.css` before inventing new colours.
2. Keep **structural** IDs (`#view-chart-btn`, `#validation-summary`, …) unless you also update `cfa-base.css`.
3. Put **topic-specific** styling and variables only in **`*-specific.css`**.
