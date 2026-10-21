# values — Design

> A client-only, statically-exported purchasing-power converter. Crypto, fiat,
> and fixed-price products share one board; typing an amount into any field
> re-prices every other field. Live rates are fetched in the browser and
> cross-rated through USD into an N×N matrix, with a bundled snapshot as an
> offline fallback. There is no backend, no database, and no persistence.

This is the authoritative design spec; the implementation follows it. Section
numbers are stable anchors — reviews and doc-comments reference them as
`design §N`.

**Contents**

1. [Background & goals](#1-background--goals)
2. [Architecture](#2-architecture)
3. [The catalog](#3-the-catalog)
4. [Rate fetching & fallback](#4-rate-fetching--fallback)
5. [Cross-rate math](#5-cross-rate-math)
6. [The conversion hook](#6-the-conversion-hook)
7. [UI composition](#7-ui-composition)
8. [Configuration & deployment](#8-configuration--deployment)

---

## 1. Background & goals

Numbers in different units don't compare in the head: "is 0.5 BTC a lot?"
depends on what a salary, a car, or a phone costs, each in its own currency.
Standard converters do one pair at a time and never mix in a physical good.
`values` reframes crypto, fiat, and real-world products as a single unit
system on one board.

Goals:

- **G1 — One unit system.** Crypto, fiat, and products are all "currencies." A
  product is just an asset with a fixed home-currency price, normalized to USD
  like anything else.
- **G2 — Multi-way conversion.** Editing any field re-prices *all* other
  fields at once — no source/target pair, no swap button.
- **G3 — Zero infrastructure.** The whole app is a static bundle: no server, no
  DB, no API keys, no accounts. Rate APIs are keyless and called from the
  browser.
- **G4 — Never a dead board.** A blocked or rate-limited fetch must degrade to a
  bundled snapshot, never surface an error to the user mid-typing.

### Non-goals

- **Not a trading / decision tool** — rates are indicative, refreshed only on
  load or manual refresh, and may be a stale bundled snapshot.
- **Not persistent** — no database or localStorage; field state is ephemeral
  React state and resets on reload.
- **Not runtime-extensible** — the product catalog and its prices are hardcoded;
  adding an asset is a code change, not configuration.

---

## 2. Architecture

A `output: 'export'` Next.js App Router app — prerendered to static HTML/JS with
**no server runtime** (no route handlers, no `app/api`, no middleware). The
entire application is one client page driven by two React hooks.

```
                          browser (static bundle)
  ┌──────────────────────────────────────────────────────────────┐
  │ src/app/page.tsx ('use client')                              │
  │                                                              │
  │  useExchangeRates() ──► rates, loading, refreshRates         │
  │        │  fetch (CoinGecko + exchangerate-api, parallel)     │
  │        │  fallback → defaultRates (src/lib/rates.ts)         │
  │        ▼                                                     │
  │  useCurrencyConverter(rates) ──► fields, handlers           │
  │        │                                                     │
  │        ▼                                                     │
  │  CurrencySelector + AmountInput  (one pair per board row)   │
  └──────────────────────────────────────────────────────────────┘
        ExchangeRate (src/lib/exchangeRate.ts) — only file that hits network
```

`page.tsx` wires the two hooks: `useExchangeRates` owns the rate matrix (fetch,
fallback, refresh); `useCurrencyConverter(rates)` owns the board state (per-field
currency + amount) and the conversion. All other files are the static catalog
(`currencies.ts`), the math (`exchangeRate.ts`), the fallback (`rates.ts`), types,
and two presentational components.

Because the app is static-exported, `page.tsx` is `'use client'` and all rate
fetching happens in the browser — subject to CORS on the two public APIs.

---

## 3. The catalog

`src/lib/currencies.ts` — `CURRENCY_CONFIG` is the single static source of truth,
three categories:

| Category | `value`s | Extra fields |
| --- | --- | --- |
| `crypto` | BTC, ETH, SOL, BNB, OKB | `id` (CoinGecko coin id), `symbol` |
| `fiat` | USD, CNY, JPY, KRW, SGD, AED, HKD, MYR | `symbol` (display glyph) |
| `products` | IPHONE17, MACBOOK, XIAOMISU7, PORSCHE, FERRARI | `price` + `currency` (fixed home-currency price) |

`DEFAULT_FIELDS` seeds six board rows (BTC / ETH / SOL / USD / CNY / HKD), each
`{ currency, amount: '', id }`. Types are in `src/types/currency.ts`
(`CurrencyConfig`, `CurrencyCategories`, `ConverterField`).

Everything downstream derives from this catalog: `ExchangeRate.getCryptoIds()`
builds the CoinGecko query from crypto `id`s; the selector groups rows by these
three categories; `AmountInput` looks up the trailing symbol here. Adding an
asset means editing this file (and, for correctness, `rates.ts` §4.3).

---

## 4. Rate fetching & fallback

`src/hooks/useExchangeRates.ts` owns `{ rates, loading, error, refreshRates }`.

### 4.1 Fetch path

`loadRates()` calls `ExchangeRate.fetchExchangeRates()`, which runs both network
calls in parallel:

```
Promise.all([
  fetchCryptoPrices(),   // GET coingecko simple/price?ids=<crypto ids>&vs_currencies=usd
  fetchFiatRates(),      // GET exchangerate-api v4/latest/USD
])
→ getProductPrices(fiatData.rates)   // fixed price ÷ home fiat rate = USD price
→ calculateCrossRates(...)           // build the full N×N matrix (§5)
```

Both APIs are **keyless** and called directly from the browser. `loadRates` runs
once on mount (`useEffect([])`) and again on `refreshRates()` (the card's refresh
icon). There is **no caching, retry, or debounce** — every refresh re-fetches
everything.

### 4.2 Fallback

`fetchExchangeRates` catches, logs, and rethrows; `loadRates` catches the throw,
sets `error`, and `setRates(defaultRates)`. So any failure (CORS, rate-limit,
network) silently swaps in the bundled `src/lib/rates.ts` matrix — the board
keeps converting with stale numbers rather than erroring.

### 4.3 Fallback-matrix drift (maintenance trap)

`defaultRates` is a **hand-maintained** static matrix, independent of the live
math and the catalog. It currently contains **retired assets not in the catalog**
(`ZHUJIAO`, `KFC`, `IN11`, `ROLEX`) and its `MACBOOK.USD` (999) even disagrees
with the catalog's product price (1599). It is pure static fallback and will
drift from live values. When adding/removing a catalog asset, update this file by
hand or the fallback will be missing rows (blank cells §6) or serve dead assets.

---

## 5. Cross-rate math

`src/lib/exchangeRate.ts` — a static `ExchangeRate` class; the **only** file that
touches the network. `calculateCrossRates` builds a dense matrix over
`[...cryptos, 'USD', ...otherFiats, ...products]`: `rates[from][to]` for every
ordered pair, `1` on the diagonal.

### 5.1 USD is the pivot

Every rate is expressed via USD. `calculateRate(from, to, …)` is a cascade of
typed cases:

- **crypto↔crypto** — `cryptoPrices[from] / cryptoPrices[to]`.
- **crypto↔USD** — the crypto's USD price (or its reciprocal).
- **crypto↔fiat** — crypto USD price × the target fiat rate (fiat rates are
  USD-based, so multiply to go USD→fiat, reciprocal to reverse).
- **USD↔fiat / fiat↔fiat** — ratios of the USD-based fiat rates.
- **product↔{USD, fiat, crypto, product}** — using `productPrices[x]`, the
  product's **USD price** from `getProductPrices` (fixed price ÷ home fiat rate,
  or the price directly when the home currency is USD).

### 5.2 Missing pairs return 0

Any pair the cascade doesn't match returns `0`. This is load-bearing: the
converter (§6) treats a `0`/absent rate as "no conversion" and renders a blank or
zero cell rather than `NaN` or an error. A missing fallback row (§4.3) surfaces
the same way.

---

## 6. The conversion hook

`src/hooks/useCurrencyConverter.ts` owns board state:
`{ fields, getUsedCurrencies, handleAmountChange, handleCurrencyChange }`.

### 6.1 State

- `fields: ConverterField[]` — per-row `{ currency, amount (string), id }`,
  seeded from `DEFAULT_FIELDS`.
- `updating: boolean` — a re-entrancy guard.
- `lastInputIndex: number` — the row the user last edited (so rate arrivals and
  currency changes re-convert from the right source).

### 6.2 Conversion (`convert`)

`convert(sourceIndex, currentFields?)`:

1. Early-return if `updating` is true (guard), else set `updating`.
2. Read the source field; `parseAmount` strips commas and `parseFloat`s.
3. Empty source ⇒ clear every *other* field. `NaN` source ⇒ bail.
4. For each other row: if same currency, copy the amount; else if
   `rates[from][to]` exists, `amount × rate`; else `0`. Format to 2 decimals via
   `toLocaleString` (`formatAmount`).

### 6.3 Deferred, fresh-state dispatch

`handleAmountChange` and `handleCurrencyChange` update `fields` via `setFields`,
then schedule `convert(..., newFields)` inside `setTimeout(…, 0)` — passing the
**freshly-computed** `newFields` so the conversion runs against the updated board
rather than a stale closure. `handleAmountChange` also records `lastInputIndex`.

A `useEffect` keyed on `rates` re-converts `lastInputIndex` when a new matrix
arrives (mount fetch or refresh), so filled fields reprice against live data. The
effect deliberately depends only on `rates` (Biome `useExhaustiveDependencies`
suppressed) to avoid re-triggering on every conversion.

### 6.4 Distinct-currency enforcement

`getUsedCurrencies(excludeIndex)` returns the currencies used by all *other*
rows; `page.tsx` passes it to each `CurrencySelector` as `excludeCurrencies`,
which disables those options — so no two rows can hold the same currency.

---

## 7. UI composition

- **`src/app/layout.tsx`** — root layout. Metadata + two JSON-LD blocks, Google
  Analytics (`G-FPHG7CDDVQ`), the `IKHeader`/`IKFooter` kit, and a full-screen
  **`BackgroundEffects`**: a `Plasma` shader plus a 400-particle `Particles`
  field, both `fixed inset-0`, mounted on every render (a real GPU/CPU cost at
  load). Default theme is `dark`.
- **`src/app/page.tsx`** — the board. `IKPageContainer` → a `Card` with the
  refresh control (spins while `loading`) → one `SpotlightCard` per field pairing
  `CurrencySelector` + `AmountInput`.
- **`src/components/AmountInput.tsx`** — text input with the trailing currency
  symbol; `fontSize: '16px'` inline to stop iOS from zooming on focus.
- **`src/components/CurrencySelector.tsx`** — grouped shadcn `Select` (Crypto /
  Fiat / Products), disabling `excludeCurrencies`.
- **`src/components/layout/`** — `ClientProviders` (next-themes `ThemeProvider`
  default dark + `TooltipProvider` + `IKVersionInfo` showing pkg name/version and
  `BUILD_TIME`), plus a `theme-provider` wrapper and an (exported but unused on
  the page) `theme-toggle`.
- **`src/app/error.tsx`** — the error boundary. **Note:** its copy still reads
  "an issue with our storefront" — leftover template text, not tailored to this
  app.

Visual layer comes from `@cdlab/ui`: shadcn primitives, reactbits effects
(`Plasma`, `Particles`, `GradientText`, `ShinyText`, `SpotlightCard`), the `IK*`
layout kit, `globals.css`, and Tailwind CSS v4.

---

## 8. Configuration & deployment

### 8.1 Config

There is **no runtime config and no secrets** — the app is a static bundle. The
only build input is `BUILD_TIME`, injected in `next.config.ts` (`env`) and read
in `client-providers.tsx` for the footer version badge. Rate API URLs, the GA id,
the Google site-verification token, and the OG image URLs are all hardcoded in
source. `next.config.ts` also sets `images.unoptimized` and whitelists remote
image hosts (`res.cloudinary.com`, `wcd.pages.dev`).

### 8.2 Static export

The page is fully client-side: `page.tsx` is `'use client'`
and rate fetching runs in the browser, so it is **CORS-dependent** on the two
public APIs. `build` runs plain `next build`.

### 8.3 Deploy

Cloudflare Pages builds with `NEXT_ENABLE_ADAPTER=0 npx --legacy-peer-deps @cloudflare/next-on-pages@1` (output `.vercel/output/static`); the
live site is <https://values.pages.dev/> (also the `metadataBase`). There is no
`wrangler.jsonc`, no Cloudflare bindings, and no test suite.

### 8.4 Tooling note

The `removeConsole` compiler option is commented out in `next.config.ts`, so the
`console.log`/`console.error` calls in `useExchangeRates.ts` ship to production.
Lint runs `next lint`, but the source uses **Biome** ignore directives
(`biome-ignore …`) — mixed tooling; keep both happy when editing.
