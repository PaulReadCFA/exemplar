# Exemplar Equation Explorer

Reference layout for new **Equation Explorer** calculators. This folder demonstrates a complete, accessible compound-interest explorer and documents what each file is responsible for.

## File map — what each file is for

| File | Purpose |
|------|---------|
| **`index.html`** | Main interactive page. Contains structure and semantics: metadata, stylesheet/script includes, skip links, calculator inputs, dynamic equation mount, chart/table view toggle, table container, results container, and live regions used by JS announcements. |
| **`calculator.js`** | Main behavior module for `index.html`: input parsing/validation, series computation (`A = P(1 + r)^n`), dynamic MathML rendering + MathJax typesetting, chart/table rendering, view toggle behavior, responsive force-table behavior, skip-link handling, and accessibility announcements. |
| **`cfa-base.css`** | Shared base design system used across explorers. Includes color tokens, layout primitives, card styles, form controls, table styles, toggle button styles, validation summary styles, skip-link utilities, and responsive table/card behavior. Treat as shared infrastructure, not one-off page styling. |
| **`exemplar-specific.css`** | Page-specific overrides/extensions for this explorer only: input row layout, equation/visualizer sizing tweaks, results styling, **Canvas/LTI page chrome** (`--exemplar-embed-surface` on `body` — grey outside cards while `.card` stays white via `cfa-base`), visualizer table header on white for token-coloured variables, legend/label variable colours, noscript/input intro classes, and high-zoom table overflow handling. |
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

## Colour logic

### Source of truth

- **Canonical palette:** `cfa-base.css` → `:root` (section **“1. CSS VARIABLES”**). The long comment block at the top of that file documents the **v3 brand system**: which hues are text-safe on white, which are decorative only, and contrast notes.
- **Prefer `var(--…)` in CSS** (e.g. `var(--color-blue-interactive)`, `var(--color-gray-600)`, `var(--surface-card)`). **Do not** introduce arbitrary hex in shared layouts when a token exists.

### v3 rule: variable hues on white only

Equation-explorer **variable colours** (`--var-*` and the aliases like `--color-teal-data`, `--color-orange-deep`) are tested for **WCAG AA on `--surface-card` (`#FFFFFF`)**. **`cfa-base.css` states they must not appear on striped or tinted row backgrounds** (e.g. table body stripes use `--surface-stripe`; only neutral text colours belong there). If you need coloured variables in a **table header** that would otherwise sit on a tinted thead, force that header row to **`--surface-card`** in your `*-specific.css` (this exemplar does that for `#visualizer .data-table thead th`).

### Where hex is still required

- **MathML `mathcolor`** attributes cannot reference CSS variables. Use the **same hex values as in `:root`** (see `buildMathML()` in `calculator.js` and `formula.html`).
- **Chart.js** options do not read CSS custom properties. This exemplar keeps a **`PALETTE` object** in `calculator.js` that **mirrors** the base tokens; if you change a token in `cfa-base.css`, update `PALETTE` (and any MathML hex) to match.

### Per-role choices in this exemplar

| Area | Logic |
|------|--------|
| **Page gutter** | `body` → `--exemplar-embed-surface` (`rgb(248,248,248)`) for Canvas-style hosts; cards stay white (see below). |
| **Cards** | From `cfa-base`: `.card` → `--surface-card` (not overridden here). |
| **Results** | Labels → `--color-gray-600`; emphasized values → `--cfa-dark-blue`. |
| **Legend + rate label `r`** | Token variable colours on the white card (`--color-blue-interactive`, `--color-green-data`, `--color-orange-deep`, `--color-teal-data`). |
| **Noscript / errors** | Classes in `exemplar-specific.css` using `--color-error*`, `--color-red-800`, `--color-gray-700`. |

**Orange on grey:** Brand orange (`--var-6` / `#B95B1D`) fails normal-text AA on `#f8f8f8`; keeping **variable-coloured UI on white card interiors** avoids a separate “darker orange for embed” token.

### Does `cfa-base.css` have every colour?

**Almost all shared semantics, yes** — brand anchors, `--var-*`, grays, error/success/warning, surfaces, legacy aliases.

**Not in base:** one-off product colours (e.g. bond legs, binomial paths). Put those in **`*-specific.css`** (or promote to base only if several explorers need the same name).

**This exemplar vs default `body`:** `cfa-base` sets `body` to **`--surface-page`** (warm off-white). Here, **`exemplar-specific.css` overrides `body`** to **`--exemplar-embed-surface`** only; **cards are not overridden**, so they remain **`--surface-card`**. For a standalone page on brand only, drop or repoint that `body` rule.

## Conventions worth keeping

1. **Two stylesheets** — `cfa-base.css` + `your-specific.css` (see discussion in repo; base stays portable).
2. **Inputs first** — calculator card before equation/visualizer (accessibility / SME pattern from existing explorers).
3. **MathJax** — Use config consistent with siblings (`MML_HTMLorMML` when injecting MathML); enable `menuSettings.explorer: true` so the accessibility menu / Explorer matches the bundled `accessibility-menu.js`. After typeset, strip stray MathJax `tabindex` **outside** the live equation container only (`#dynamic-equation-container`), so Explorer can manage focus inside the dynamic math.
4. **Chart.js** — Destroy the previous instance before creating a new one. Respect reduced motion via **`matchMedia('(prefers-reduced-motion: reduce)')`** in JS (canvas does not read CSS `@media`): disable chart `animation`, shorten `transitions`, set `plugins.tooltip.animation` off, and optionally re-render when the media query changes.
5. **Live regions** — Polite announcements for calculation/view updates; assertive for validation errors where appropriate.
6. **No raw non-finite numbers in the UI** — Never show `NaN`, `Infinity`, or `-Infinity` in results, tables, charts, MathML, or screen-reader text. Use validation, pre-render guards (`Number.isFinite`), and/or safe formatters (placeholders like `—` plus clear copy when inputs cannot produce a real value). Keep equation, results, chart, and table behavior consistent.
7. **Cap numeric input length** — Do not allow unbounded typing or paste into calculator fields. `maxlength` on `type="number"` is not dependable; enforce a max raw string length in JS. **Default:** 6 characters for numeric fields; **10** for comma-formatted currency **text** inputs (principal) where commas add length.
8. **Small screens** — Long labels plus `nowrap` flex rows can force horizontal overflow and scrollbars. At narrow breakpoints, allow label/control to wrap or stack, keep `max-width: 100%` / `min-width: 0` on flex children as needed, and place block-level validation (e.g. summary) so the **whole** input group shifts consistently rather than individual rows reflowing oddly when errors appear.

## Model used in this exemplar

Compound interest **`A = P(1 + r)^n`**. Replace compute + MathML + chart/table/result rendering with your domain logic while keeping the same file boundaries and accessibility contracts above.

## For LLMs / codegen

When adding a new explorer, **copy this folder**, rename the specific CSS/JS, then:

1. Read this README and skim `:root` in `cfa-base.css` before inventing new colours.
2. Keep **structural** IDs (`#view-chart-btn`, `#validation-summary`, …) unless you also update `cfa-base.css`.
3. Put **topic-specific** styling and variables only in **`*-specific.css`**.
