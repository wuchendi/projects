# dropply-web — Design

> A local-first browser encryption tool with optional sharing. All encryption
> and decryption happen **in the browser** (a Web Worker running
> `@cdlab/cipher`); sharing uploads the **finished ciphertext** to
> [`dropply-api`](../dropply-api) and returns an 8-character retrieval code —
> no key material ever appears in a URL or a request. The app is a **static
> export** (`output: 'export'`) with no server of its own.

This is the authoritative design spec; the implementation follows it. Section
numbers are stable anchors — source comments and reviews reference them as
`design §N`. The paired API's design is out of scope here; this document covers
the browser client only.

**Contents**

1. [Background & goals](#1-background--goals)
2. [Architecture](#2-architecture)
3. [The crypto engine](#3-the-crypto-engine)
4. [The key manager](#4-the-key-manager)
5. [Share (model A)](#5-share-model-a)
6. [Retrieve (back into the tool)](#6-retrieve-back-into-the-tool)
7. [Client state & storage](#7-client-state--storage)
8. [Security model](#8-security-model)
9. [Internationalization & theming](#9-internationalization--theming)
10. [Configuration & deployment](#10-configuration--deployment)

---

## 1. Background & goals

Earlier iterations were "a file-drop with client-side crypto": encryption
existed to serve the upload. The current app inverts that — it is an
**encryption tool first** (fully offline-capable), and sharing is an optional
action applied to an already-encrypted result.

- **G1 — Local by default.** Encrypt/decrypt requires no network, no account,
  no config. The API being unreachable degrades *sharing only*; the tool keeps
  working.
- **G2 — Zero-knowledge sharing.** What uploads is a sealed ciphertext under a
  neutral name; the password / private key is exchanged out-of-band by humans
  and never appears in a URL, a request body, or an email.
- **G3 — No mode switches.** Encrypt vs decrypt is *derived from the input*:
  ciphertext is recognized by its magic bytes (`@cdlab/cipher detect()`),
  which also reveal whether it needs a password or a private key. The user
  never picks a tab.
- **G4 — Keys are a first-class object.** A built-in key manager owns BIP39
  mnemonic key pairs and contacts' public keys, so public-key mode is usable
  by non-cryptographers.
- **G5 — No server of its own.** The deployed artifact is static assets; the
  only backend dependency is `dropply-api`, and only for share/retrieve.

### Non-goals

- **Not a key-exchange channel.** Neither the share link nor the share email
  carries key material — only the retrieval code.
- **Not a server runtime.** No SSR data fetching, no API routes, no edge/node
  functions — static export only (§2, §10).
- **Not key recovery.** Losing the password / mnemonic means the data is
  unrecoverable by design; the server holds only ciphertext.

---

## 2. Architecture

```
                      browser (static assets from ./out)
 ┌────────────────────────────────────────────────────────────────┐
 │ [locale]/page.tsx — ScrollArea shell                           │
 │   AppHeader (history · retrieve · keys · lang · theme)         │
 │   Hero ─ embeds ─ LocalCryptoPanel (the tool)                  │
 │   Features / HowItWorks / FAQ · AppFooter                      │
 │                                                                │
 │ useCryptoProcessor (one shared engine)                         │
 │   └─ workers/cryptoWorker.ts (@cdlab/cipher)   ← crypto here   │
 │ LocalResultCard ── Share ──► lib/share-blob.ts ─┐              │
 │ RetrieveEntry ─── code ────► lib/api.ts ────────┤ ciphertext   │
 └─────────────────────────────────────────────────┼──────────────┘
                                                   ▼  only
                                    dropply-api (storage, password gate, email)
```

**Static export.** `next.config.ts` sets `output: 'export'`: `next build`
prerenders everything to static HTML/JS in `./out`. There is no Next.js server.
`src/middleware.ts` (next-intl locale middleware) and `generateMetadata` run
only during dev/build; the shipped artifact is plain files.
`generateStaticParams` in `[locale]/layout.tsx` emits `en` and `zh`.

**Entry points.**

- `src/app/layout.tsx` — trivial root layout (a root `not-found.tsx` exists).
- `src/app/page.tsx` — root page, `redirect('/en')`.
- `src/app/[locale]/layout.tsx` — the real layout: Geist fonts, EN + ZH SEO
  metadata (`generateMetadata`), JSON-LD blocks, `NextIntlClientProvider`,
  `ClientProviders`, `Toaster`. Imports `../dropply.css` (app keyframes).
- `src/app/[locale]/page.tsx` — the page shell (`'use client'`): a shared
  `ScrollArea` wraps header + landing + footer so scrollbars are consistent;
  a scroll listener on the ScrollArea viewport drives the header's
  transparent→solid transition. Reads `?code=` via `useSearchParams`
  (`Suspense`-wrapped) and passes it to the header's `RetrieveEntry`.

**One engine.** `useCryptoProcessor` is instantiated once in `page.tsx` and
passed down to the tool, the header (retrieve + history) and the result cards —
so a retrieved ciphertext lands in the *same* state the tool uses.

---

## 3. The crypto engine

### 3.1 Worker

`src/workers/cryptoWorker.ts` runs all crypto off the main thread. It speaks a
small message protocol (`encrypt` / `decrypt` × file / text) and reports chunk
progress back for the result card's progress bar.

| Input | Mode | Backing call |
| --- | --- | --- |
| file, password | encrypt | `streamCrypto.encrypt.withPassword` |
| file, receiver public key | encrypt | `streamCrypto.encrypt.withPublicKey` |
| file (magic `ns1`), password | decrypt | `streamCrypto.decrypt.withPassword` |
| file (magic `ns0`), private key | decrypt | `streamCrypto.decrypt.withPrivateKey` |
| text ± password / keys | either | `textCrypto.encrypt` / `textCrypto.decrypt` |

`@cdlab/cipher` = XChaCha20-Poly1305 stream cipher; password mode derives the
key with Argon2id, public-key mode is ECIES over secp256k1. The original
filename is stored inside the encrypted header and restored on decrypt.

### 3.2 Auto-detection (no tabs)

`useCryptoProcessor.handleFileSelect` / text input runs `detect()` from
`@cdlab/cipher` on the input:

- `'pwd'` / `'pubk'` → the input is ciphertext → mode flips to **decrypt**,
  and `encryptionMode` is preset to `password` or `publickey` accordingly.
- `'unencrypted'` → mode is **encrypt**.

The key input accepts several shapes, classified by `lib/keys.ts` helpers:
a mnemonic phrase (`isMnemonicPhrase` → derive private key), a 64-hex private
key (`isHexString`), or a base58 public key (`validateBase58PublicKey`).

### 3.3 Results

Each operation appends a `ProcessResult` (`src/types/crypto.ts`) to
`useProcessStore`: `{ id, mode, inputMode, data: ArrayBuffer, text?, fileInfo?,
status, progress, stage, downloadUrl? }`. Local row IDs come from
`@cdlab/driftflake` (`lib/genid.ts`). Cards render download / view / copy /
share / remove actions; message results open in `LocalResultDialog`.

---

## 4. The key manager

`components/keys/KeyManagerDialog.tsx`, opened from the header key icon.

- **Own key pairs.** `generateMnemonic()` (BIP39, 128-bit) →
  `deriveKeyPair(mnemonic)`: seed → BIP32 HD node at `m/44'/0'/0'/0/0` →
  secp256k1. Private key = 32-byte hex; public key = base58 of the compressed
  33-byte point (`lib/keys.ts`). Import accepts an existing mnemonic.
- **Contacts.** A list of saved recipient public keys (base58) with notes, fed
  into public-key encrypt mode as the receiver.
- **PIN gate.** An optional PIN protects the manager UI: `lib/pin.ts` stores
  `saltHex:hashHex` where hash = Argon2id(pin, salt). `PinInput` collects it.
- **Persistence caveat (§8).** The store persists to `localStorage`
  (`dropply-keys`) through `store/keys-storage.ts`, which base64-encodes the
  JSON — **obfuscation, not encryption** (it defeats shoulder-surfing and
  naive greps, nothing more). Only the mnemonic is persisted; private keys are
  re-derived on demand. Encrypting the keystore with a PIN-derived key is a
  known deferred hardening (D2).

---

## 5. Share (model A)

Sharing operates on a **finished encrypted result** — it never encrypts, never
re-wraps, and never sees a key.

**Entry:** the share button on an encrypted `LocalResultCard` →
`lib/share-blob.ts shareEncryptedBlob(blob, password?)`:

```
1. api.getConfig()                  → { requirePassword, emailShareEnabled, maxFileSize }
2. size check                       → ShareTooLargeError before any upload
3. api.createChest(password?)       → { sessionId, uploadToken }
4. upload the blob as `share.enc` (application/octet-stream)
     small → direct form upload | >20MB → multipart (20MB parts, ≤3 concurrent, 3 retries)
5. api.completeUpload(...)          → { retrievalCode }        (8-char)
6. link = `${origin}${pathname}?code=${retrievalCode}`
```

**Opaque metadata.** The uploaded name is always `share.enc` and the MIME is
always `application/octet-stream`; the real filename lives inside the
encrypted header and reappears when the recipient decrypts locally. The server
learns nothing from the upload beyond size and expiry.

**Share-password gate.** When the server sets `SHARE_PASSWORD`,
`config.requirePassword` is true and `createChest` must carry the password —
`api.ts` hashes it with `hashPasswordFn` (Argon2id) before sending, so the
plaintext never leaves the tab; the API verifies the hash against
`SHARE_PASSWORD`:

- First share → a password dialog on the card; success caches it in
  `useAuthStore` (`sessionStorage`, tab-scoped).
- A later `401` (password rotated server-side) clears the cache, re-opens the
  dialog with an error state, and retries from scratch.
- There is no dedicated verify endpoint — `createChest` doubles as the check.

**Email share.** When `config.emailShareEnabled`, the share dialog offers
`EmailShare` → `POST /api/email/share`. The email contains the retrieval code
and a link — never a key; copy in the dialog says exactly that.

The share dialog shows the code + link with copy actions; the result of a
share is cached per card so re-opening it doesn't re-upload.

---

## 6. Retrieve (back into the tool)

There is no retrieve screen. `components/retrieve/RetrieveEntry.tsx` is a
header icon + dialog:

```
1. user enters the 6–8 char code (or a ?code= deep link auto-opens the dialog)
2. api.getConfig()                  → maxFileSize
3. api.retrieveChest(code)          → { files, chestToken }
4. per file: api.downloadFile(fileId, chestToken)   (Authorization: Bearer header)
     oversized files are skipped with a toast
5. wrap blobs as File objects → crypto.handleFileSelect(files)
6. detect() sees ciphertext → the tool switches to decrypt (§3.2)
```

The recipient then enters the password / private key they received
out-of-band. Multi-file shares retrieve every file in one pass; an empty chest
or a fully-skipped list surfaces as an error toast instead of a silent no-op.

---

## 7. Client state & storage

Three Zustand stores; there is **no backend DB in this app**. API type
contracts live in `src/types/index.ts`.

| Store | Shape | Persistence | Security rule |
| --- | --- | --- | --- |
| `useProcessStore` | `ProcessResult[]` history | IndexedDB `dropply/stores`, row `dropply-process-results` (metadata **and** `ArrayBuffer` payloads) via `@cdlab/zustand-idb` | `partialize` keeps only **completed** results; payload bytes never enter `localStorage`. |
| `useKeysStore` | own `KeyPair[]` (mnemonic + note), contact `PublicKey[]`, `passwordHash` | `localStorage` `dropply-keys` via base64-obfuscating `keys-storage.ts` | Only mnemonics persist (private keys re-derived); PIN stored as Argon2id hash. See §4 caveat. |
| `useAuthStore` | `{ sharePassword }` | **`sessionStorage`** `dropply-auth` | The share password is **tab-scoped**, not durable — closing the tab forgets it. |

**Hydration.** IndexedDB is browser-only, so `useProcessStore` sets
`skipHydration: true` and calls `persist.rehydrate()` on the client. Payload
bytes come back with the row (structured clone); `onRehydrateStorage` only
rebuilds the session-only `downloadUrl` object URLs.

**History.** `HistoryDialog` (header icon, shown only when history is
non-empty) lists past results from the same store; removing a result drops its
payload with the row.

---

## 8. Security model

- **Local-first crypto (G1).** All encryption/decryption happens in a Web
  Worker in the tab; plaintext never leaves the browser.
- **No key material in transit or URLs (G2).** Share links carry only
  `?code=`. The share email carries only the code. `createChest` carries the
  *share password* (an access-control credential for the server's paid
  storage), never an encryption key.
- **Opaque uploads.** `share.enc` + `application/octet-stream` + encrypted
  header ⇒ the server cannot learn filenames or content types.
- **Keystore at rest.** `dropply-keys` is base64-obfuscated, not encrypted —
  a device compromise exposes stored mnemonics. The PIN gates the *UI*, not
  the data (its hash cannot decrypt anything). D2 (encrypt keystore with a
  PIN-derived key) is deferred, documented, and should be assumed absent.
- **Tab-scoped share password.** `sessionStorage` only; a 401 from a rotated
  server password clears it immediately.
- **Result history is plaintext-adjacent.** Decrypt results (plaintext bytes)
  persist to IndexedDB so history survives reload — deliberate UX; users who
  decrypt secrets on shared machines should remove those rows.
- **Static-export caveat.** `nodejs_compat` in `wrangler.jsonc` serves the
  build path only — **do not assume Node APIs exist** in the client bundle.

Trust boundary: everything the server sees (retrieval code, chest token,
ciphertext, size, expiry, share password) is either non-secret or a revocable
access credential. Confidentiality rests entirely on the out-of-band
password / private key.

---

## 9. Internationalization & theming

- **i18n:** next-intl. `src/i18n/routing.ts` declares locales `['en','zh']`,
  default `en`; `request.ts` loads `messages/{locale}.json`; `navigation.ts`
  gives locale-aware `Link`/router. `LanguageSelector` sits in the header.
  `messages/en.d.json.ts` (typed messages) is generated and gitignored.
- **Theming:** `ClientProviders` wraps `ThemeProvider` (default **`dark`**,
  `enableSystem={false}`), a `TooltipProvider`, a plain `bg-background`
  surface, and `IKVersionInfo` (name/version + `BUILD_TIME`). `ThemeToggle`
  lives in the header. `dropply.css` adds the hero shine keyframes.

---

## 10. Configuration & deployment

### 10.1 Config

The only build-time env var is `NEXT_PUBLIC_API_URL` (read in `api.ts`,
default `''` = same-origin relative `/api`, which nsl serves in dev;
`.env.example` points it at a Worker URL for production). It is inlined into
the static bundle at build time — changing it requires a rebuild. All
*behavioral* config (`requirePassword`, `emailShareEnabled`, `maxFileSize`) is
fetched at share/retrieve time from `GET /api/config`, so the deployed bundle
adapts to the server without a rebuild.

Hardcoded tuning (in `src/lib/api.ts`): `CHUNK_SIZE = 20 MB`, part
`concurrencyLimit = min(3, totalParts)`, `MAX_RETRIES = 3` (linear
`1000ms × attempt`).

### 10.2 Build

`next build` produces a static `out/` because of `output: 'export'`. Images
are `unoptimized`. `BUILD_TIME` is injected at build via `next.config.ts`
`env`; `allowedDevOrigins` whitelists the tunneled dev origin.

### 10.3 Deploy

- **Static assets (primary).** `wrangler.jsonc` serves `./out` directly
  (`assets.directory`, `not_found_handling: "404-page"`). Live at
  `dropply.pages.dev`.
- **`next-on-pages`.** Cloudflare Pages builds with `NEXT_ENABLE_ADAPTER=0 npx --legacy-peer-deps @cloudflare/next-on-pages@1`
  (output `.vercel/output/static`).

There are **no Cloudflare bindings** — no KV/R2/D1/DO. The app is a static
asset deployment whose only backend dependency is a reachable `dropply-api`.

### 10.4 Commands

```bash
pnpm dev:dropply                             # web + api → http://dropply.localhost:3355
pnpm --filter @cdlab/dropply-web typecheck   # tsc --noEmit
pnpm --filter @cdlab/dropply-web build       # next build
```

No test script and no test files exist in this app.
