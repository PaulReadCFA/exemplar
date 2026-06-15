# Exemplar Equation Explorer

Reference layout for **Equation Explorer** calculators and other **interactive learning visuals** built on the same stack. This folder shows the full **four-card** pattern (inputs, equation, chart/table, results); the same files are a **baseline** you can slim down — for example chart-only or chart + table without equation or results cards.

## File map — what each file is for

| File | Purpose |
|------|---------|
| **`index.html`** | Main interactive page. Contains structure and semantics: metadata, stylesheet/script includes, skip links, calculator inputs, dynamic equation mount, chart/table view toggle, table container, results container, and live regions used by JS announcements. |
| **`calculator.js`** | Main behavior module for `index.html`: input parsing/validation, series computation, dynamic MathML rendering + MathJax typesetting, chart/table rendering, view toggle behavior, responsive force-table behavior, skip-link handling, and accessibility announcements. |
| **`cfa-base.css`** | Shared base design system used across explorers. Includes color tokens, layout primitives, card styles (including **calculator card blue border** on `#calculator` / `#data-entry`), form controls, table styles, toggle button styles, validation summary styles, skip-link utilities, and responsive table/card behavior. Treat as shared infrastructure, not one-off page styling. |
| **`exemplar-specific.css`** | Page-specific overrides/extensions for this explorer only: input row layout, equation/visualizer sizing tweaks, results styling, **Canvas/LTI page chrome** (`--exemplar-embed-surface` on `body` — grey outside cards while `.card` stays white via `cfa-base`), visualizer table header on white for token-coloured variables, legend/label variable colours, noscript/input intro classes, and high-zoom table overflow handling. |
| **`formula.html`** | Standalone page with **only** the typeset equation (no prose, legend, or controls). Same MathJax setup as `index.html`. |
| **`README.md`** | Usage notes and conventions for copying this exemplar into new calculators. |

### Why one `calculator.js` here (no `utils.js`, `results.js`, …)

**On purpose.** The exemplar keeps everything in one module so the full pipeline is visible in one scroll and easy to copy into a new project. Production explorers (e.g. dividend) split **`modules/utils.js`**, **`validation.js`**, **`chart.js`**, **`table.js`**, **`results.js`**, **`equations.js`**, **`state.js`**, etc. when complexity warrants it.

**When to split:** multiple models, heavy chart logic, shared validation across files, or anything that makes a single file hard to review — then mirror the dividend layout: thin **`calculator.js`** entry that wires imports and subscriptions, with the same responsibilities moved into named modules.

## Beyond the four-card layout

The **four cards** are the standard **equation explorer** shape for Canvas: calculator → dynamic equation → visualization → results. They are **not** required for every interactive asset you build from this repo.

Use this folder as a **technical and design baseline** when the learning goal is different — e.g. an interactive **bar chart**, **scatterplot**, or **chart + table** with no live equation and no results card.

### What to keep (any variant)

| Keep | Why |
|------|-----|
| **`cfa-base.css`** + **`*-specific.css`** | Tokens, typography (18px root), cards, tables, embed chrome |
| **`PALETTE`** + **`CHART_FONT`** in JS | Brand-aligned Chart.js colours and minimum readable axis/tooltip size |
| **Chart.js hygiene** | Destroy/recreate instance, reduced motion, keyboard/tooltip patterns where applicable |
| **Live Server / Canvas embed** | Same hosting model; `body` embed surface in `*-specific.css` |
| **Charts and tables (learning design)** section below | Applies to **any** chart type — use the LDO job aid to judge fit (bar vs line vs table, etc.) |
| **Accessibility habits** | Focus visible, contrast on white cards, polite announcements when data updates, data table when learners need exact values |

### What you can omit

| Optional block | When to drop |
|----------------|--------------|
| **Equation card** + MathJax in `index.html` | No live formula on screen (static equation elsewhere, or chart-only) |
| **`formula.html`** | Nothing to embed as a standalone equation in Canvas |
| **Results card** | Headline answer lives in chart, table, or surrounding course text |
| **Calculator card** | Fixed dataset, or controls live in chart (click/hover) / minimal sliders elsewhere |
| **Chart ↔ table toggle** | Only one view needed — remove unused card HTML and `applyView` / toggle buttons |

Remove **HTML, CSS hooks, and JS** together so you do not leave dead IDs or `refreshAll` calls for missing blocks.

### Common slim layouts

| Layout | Typical use | Start from |
|--------|-------------|------------|
| **Chart only** | One interactive figure (line, bar, scatter, …) | Copy folder → one `.card` with `#chart` → strip other sections from `index.html` → simplify `refreshAll` to data + `renderChart` only |
| **Chart + table** | Pattern + exact values, no equation | Keep visualizer card (chart + table); drop equation and results cards |
| **Inputs + chart** | Learner changes one or two knobs, chart updates | Keep calculator (or a single control row) + visualizer; drop equation/results if not needed |
| **Table only** | Look-up / schedule, no chart | Keep `#table-container`; drop chart JS and Chart.js script tag if unused |

You do **not** need a different starter repo — duplicate an exemplar, delete unused cards, and narrow `calculator.js` to the pipeline you still run.

### Other chart types (not only lines)

This exemplar defaults to **line charts over time**. Branching out is normal:

- Change **`type`** and **`options`** in `renderChart` (bar, scatter, bubble, etc.) or add a separate render function.
- Re-read the **learning goal** in the LDO *Charts & Visual Aids* reference (comparison → bar; relationship → scatter; look-up → table).
- Keep **≤ 4–5 encodings**, direct labelling, and **typography/zoom** rules regardless of chart type.
- Unfamiliar types (waterfall, bullet, spider, …) need **extra annotation** or narration in self-paced use — same as static course figures.

`cfa-base.css` does not ship bar/scatter presets; topic styling stays in **`*-specific.css`** and Chart.js config.

### QA for slim builds

Same handoff mindset as full explorers:

1. **Learning design** — chart type fits the goal (job aid table + per-type checklist).
2. **Typography** — 18px UI text; `CHART_FONT` not smaller.
3. **Accessibility** — keyboard path to anything interactive; table or text alternative for precise values when the chart alone is not enough.
4. **No orphan contracts** — if you remove validation or equation code, remove matching HTML and skip links.

Full **equation explorer** course flow (A → B → C) still assumes all four cards. Slim layouts are for **other** products — document what you kept and dropped in your project README or handoff note.

## HTML/JS contract (important IDs)

**Full four-card explorers** rely on the IDs below. **Slim layouts** keep only the subset they still use; delete the rest from HTML and JS together. All IDs are defined against **this** `cfa-base.css` (copied from the shared dividend base). If you rename them, update CSS or JS accordingly.

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
7. **Cap numeric input length** — Do not allow unbounded typing or paste into calculator fields. `maxlength` on `type="number"` is not dependable; enforce a max raw string length in JS. **Default:** 6 characters for numeric fields; **10** for comma-formatted currency **text** inputs (principal, PMT, etc.) where commas add length.
8. **Small screens** — Long labels plus `nowrap` flex rows can force horizontal overflow and scrollbars. At narrow breakpoints, allow label/control to wrap or stack, keep `max-width: 100%` / `min-width: 0` on flex children as needed, and place block-level validation (e.g. summary) so the **whole** input group shifts consistently rather than individual rows reflowing oddly when errors appear.
9. **Calculator card border** — The learner-input card is framed with **`border: 2px solid var(--color-interactive)`** (`cfa-base.css` §5). Applies to **`#calculator`** (most explorers) or **`#data-entry`** (dividend, mortgage, and similar). **Do not** put this border on equation, visualizer, or results cards. When copying `cfa-base.css`, keep this rule; if an explorer uses a different inputs-section `id`, add a matching selector in **`*-specific.css`** only.

## Charts and tables (learning design)

**Four-card explorers** usually pair a **line chart** (pattern over time) with a **data table** (exact values). **Slim layouts** still use this section for whatever chart or table you ship. Match SME / curriculum numbers first; use this when reviewing work with Cursor or QA. Full cross-chart evaluation guidance lives in the CFA LDO *Charts & Visual Aids Evaluation Quick Reference*.

**Line chart (change over time)**

- Period on the x-axis; keep **≤ 4–5 series** (one line for simple models; more when Excel shows multiple series such as contributions vs balance).
- Series labels match curriculum / Excel meaning (not legacy placeholder wording).
- When two series are shown: use **line style** (solid vs dashed) as well as colour so meaning is not colour-only.
- **Area fill** under a line (if SME requests it): use a **zero baseline** and semi-transparent fill; ensure a dashed line crossing the fill still meets contrast rules.
- Non-zero y-axis is fine for lines; do not truncate the axis to exaggerate change.
- Avoid chart junk — tooltips and keyboard navigation carry period detail.

**Table (look-up)**

- Same schedule as the chart; column order matches Excel.
- One row per period; numbers aligned for scanning.
- Table view stays available (required on narrow screens via `force-table`).

**Typography and zoom (CFA LDO)**

- Learning products target **≥ 14pt (~18px) or 18px** for labels and readable text at **100% browser zoom**.
- **`cfa-base.css` sets `html` to 18px**; primary card copy, inputs, legend, results, and schedule tables use **`1rem` (= 18px)**. **Do not shrink** learner-facing text in `*-specific.css`.
- **`renderChart`** uses **`CHART_FONT` (`size: 16`)** for axis ticks and tooltips — the minimum practical size inside the canvas; axis **titles** use the same family at 16px bold. Do not go smaller when editing chart options.
- **Check at 100% and 200% zoom** — text stays readable; labels stay near the values they describe (no overlap or clipping). Chart and table toggle must remain usable.

**Wrong chart type in Excel** (e.g. pie for a time series) — flag for SME / learning design; builders implement the approved workbook.

## Quality review (EE QR checklist)

Production **Equation Explorers** are reviewed against the **EE QR Checklist** (content fidelity, interactivity, visual integrity, labeling consistency). Editorial also publishes the **Equation Explorers Style Sheet** (capitalization, formatting, variable labeling). Use both when building or reviewing — this section maps QR expectations to **this repo**, not a substitute for formal QR.

### EE components vs this folder

| QR component | In this zip | Notes |
|--------------|-------------|--------|
| Static equation | **`formula.html`** | Must match approved source equation; same variable symbols as dynamic math |
| Dynamic equation | **`#dynamic-mathml-equation`** + `buildMathML()` | Values update when inputs change; `mathcolor` hex matches `PALETTE` / `:root` |
| Calculator | **`index.html`** inputs + **`RULES`** in `calculator.js` | Each control maps to a variable in the equation |
| Visualization | Chart + table in visualizer card | Chart/table toggle; narrow screens force table |
| Results | **`#results-content`** (optional) | Omit card + `renderResults` for slim layouts |
| Exploration questions | **Canvas / Confluence wrapper** | Not in the LTI zip — authors add in course page |
| “More about this EE” | **Canvas / Confluence wrapper** | Expandable prose lives outside the explorer |

### 1. Content fidelity

- **Equations** in `formula.html`, `buildMathML()`, and any static copy must match the **approved spec / Excel / PDF**.
- **Variable definitions** (labels, units, min/max) in `index.html` and **`RULES`** must match source material.
- **Source constraints** (e.g. growth &lt; required return, r ≥ 0) must appear in UI copy where stated and be **enforced in `validateAll()`** — not only documented in README.
- Compare numeric output to SME reference (Excel) at **two+ input sets** before handoff.

### 2. Interactivity and functionality

- All inputs, toggles, skip links, and chart keyboard paths must produce **observable updates** via `refreshAll()` (or your slim pipeline).
- **Validation:** `#validation-summary`, per-field errors, live regions — clear messages; no silent failure.
- **Edge cases:** extreme but valid inputs must not clip chart labels, overflow cards, or show raw `NaN` / `Infinity` (see conventions §6).

### 3. Visual integrity and responsiveness

- Legible at **100% and 200% zoom**; no clipped axis labels, truncated tooltips, or overlapping legend (see Charts and tables § typography).
- Test **min/max inputs** and **narrow width** (`force-table`, wrapped calculator rows).
- Chart tooltips and keyboard focus indicators must stay **fully visible** inside the card.

### 4. Labeling consistency

- **Same variable names** everywhere: input labels, equation (static + dynamic), chart legend, axis titles, table headers, results labels, live-region announcements.
- **Colour cues** for a variable (e.g. **P**, **r**, **n**) must match across legend, `mathcolor`, and `.eq-var-*` / `.eq-chip-*` in HTML (white card surfaces only).
- **Currency:** ISO 4217 **codes**, not symbols — **EUR** ✓, **€** ✗; **USD** ✓, **$** ✗. Set **`CURRENCY_ISO`** and **`CURRENCY_SPEECH_LABEL`** once in `calculator.js`. **Tables:** put the ISO code in **column headers** (`<th>`) and matching **`data-label`** on cells; body values use **`fmtMoneyAmount`** only (do not repeat USD/EUR on every row). **Results** and **chart tooltips** use **`fmtMoneyVisual`** where there is no shared column header. Axis title pattern: **`Amount (USD)`**; tick labels stay numeric. See **`cfa-base.css` addendum § F**.
- **Chart vs table:** same periods and amounts for the same inputs — display mode must not change meaning.
- **Model / equation name** consistent in card titles and results copy.

### Pre-submit sweep (builders and LLMs)

1. Grep for `$`, `€`, `£` in `index.html`, `calculator.js`, and rendered strings — replace with ISO pattern.
2. Grep variable symbols — each input ID appears in `RULES`, equation, and at least one of chart/table/results.
3. Run defaults + one alternate input set; spot-check chart tooltip vs table row vs results headline.
4. Resize to mobile width; confirm table mode and no horizontal scroll on calculator.
5. Confirm `formula.html` still matches dynamic equation structure.

## Model used in this exemplar

**Compound interest:** **`A = P(1 + r)^n`**. Default principal **1,000**, rate **5%**, periods **10**. One chart series (amount **A** over time) and a two-column schedule table. Replace compute + MathML + chart/table/result rendering with your domain logic while keeping the same file boundaries and accessibility contracts above.

## For LLMs / codegen

When adding a new explorer, **copy this folder**, rename the specific CSS/JS, then:

1. Read this README end-to-end; skim **`cfa-base.css`** addenda (Canvas embed, MathML hex, **currency § F**) and **`:root`** before inventing colours.
2. Keep **structural** IDs (`#view-chart-btn`, `#validation-summary`, …) unless you also update `cfa-base.css`.
3. Put **topic-specific** styling and variables only in **`*-specific.css`**.
4. Follow **Quality review (EE QR checklist)** — especially **`CURRENCY_ISO`**, cross-surface labeling, and chart/table numeric parity.
5. Wire **`RULES`** to the approved spec; enforce stated constraints in validation, not copy alone.
6. After edits, run the **pre-submit sweep** in the QR section before claiming the build is QR-ready.
7. Keep the **calculator card blue border** — verify `cfa-base.css` §5 includes `#calculator.card` / `#data-entry.card`; confirm the inputs section in `index.html` uses one of those ids.
