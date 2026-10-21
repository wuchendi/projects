# dropply-web

Local-first encryption tool with optional sharing — encrypt or decrypt files
and messages **entirely in the browser** (XChaCha20-Poly1305 via
`@cdlab/cipher`), then optionally upload the finished ciphertext to
[`dropply-api`](../dropply-api) and hand out an 8-character retrieval code. The
key or password is **never** part of a URL and never leaves the tab. A single
Next.js app **statically exported** to Cloudflare Pages, with no server of its
own.

Preview: <https://dropply.pages.dev/>

There are no mode tabs: the tool detects what you gave it. Plain input is
encrypted; input that carries the `@cdlab/cipher` magic bytes is decrypted, and
the header even tells the UI whether it needs a password or a private key.

## Why

Most "secure" file-drop tools still upload plaintext and ask you to trust the
operator. `dropply-web` inverts the order of operations: encryption is the
*product*, sharing is an optional afterthought applied to an already-sealed
blob.

- **Local by default.** Encrypt/decrypt works fully offline — no account, no
  upload, no network. The API being down only disables sharing.
- **The server can't read anything.** What gets uploaded is a finished
  ciphertext under a neutral name (`share.enc`, `application/octet-stream`);
  the real filename lives *inside* the encrypted header. The password / private
  key travels out-of-band, chosen and exchanged by the humans involved.
- **Two encryption modes.** Password (Argon2id-derived key) or public-key
  (ECIES over secp256k1) — the built-in key manager generates BIP39 mnemonic
  key pairs and stores contacts' public keys.
- **No key on disk.** Share links carry only the retrieval code (`?code=`).
  Process history persists results, not secrets.
- **No backend to run here.** `output: 'export'` — the deployed artifact is
  plain HTML/JS assets; all logic is client-side React.

## Quick start

`dropply-web` is part of the [`@cdlab/projects-monorepo`](../../README.md); run
everything from the repo root. Sharing needs a running
[`dropply-api`](../dropply-api); encryption does not.

```bash
pnpm install                              # builds workspace packages too
pnpm dev:dropply                          # web + api together -> http://dropply.localhost:3355
```

nsl serves the backend at the same origin under `/api`
(`http://dropply.localhost:3355/api`), so no `NEXT_PUBLIC_API_URL` is needed in
dev — the client uses a relative `/api` base.

## Using it

**Encrypt.** Drop files or type a message, enter a password (or pick a
recipient's public key from the key manager), done. Results appear as cards —
download them, or hit **Share** on any encrypted result.

**Share.** Sharing uploads the ciphertext as-is (no re-encryption) and returns
an 8-char code + a `?code=` link. If the server is configured with
`SHARE_PASSWORD`, a password prompt gates the upload (cached for the session).
When the server enables it, the code can also be emailed from the app — the
email contains only the code, never a key.

**Retrieve.** The download icon in the header (or opening a `?code=` link)
fetches the shared ciphertext and drops it straight into the tool, which
auto-detects it and switches to decrypt. Enter the password / your private key
— which you received out-of-band — and the original files come back.

**Keys.** The key icon opens the key manager: generate a BIP39 mnemonic key
pair (secp256k1, path `m/44'/0'/0'/0/0`), import an existing mnemonic or
private key, and keep a list of contacts' public keys. An optional PIN
(Argon2id-hashed) gates the manager UI.

## How a share resolves

```
Encrypt (local, in a Web Worker)
  file/text ──► streamCrypto/textCrypto.encrypt ──► result card (ciphertext)

Share (optional, ciphertext only)
  1. GET  /api/config                → { requirePassword, emailShareEnabled, maxFileSize }
  2. POST /api/chest                 → { sessionId, uploadToken }     (body carries the share password when required)
  3. upload ciphertext as share.enc  → small direct | >20MB multipart (20MB parts, 3 concurrent)
  4. POST /api/chest/:id/complete    → { retrievalCode }              (8-char)
  5. link: …/?code=<retrievalCode>   (no key material anywhere in the URL)

Retrieve (back into the tool)
  1. GET /api/retrieve/:code         → { files, chestToken }
  2. GET /api/download/:fileId       → ciphertext blob (Authorization: Bearer)
  3. feed into the tool              → detect() → decrypt with password / private key
```

The full model — the crypto engine, the key manager, the share/retrieve
contract, and the client-storage security rules — is in
[`DESIGN.md`](DESIGN.md).

## Configuration

The only build/runtime knob is one public env var (baked into the static
bundle at build time). Everything else — max file size, whether a share
password is required, whether email share is on — is fetched from the server
when sharing is invoked, via `GET /api/config`.

| Var | Default | Meaning |
| --- | --- | --- |
| `NEXT_PUBLIC_API_URL` | `''` (relative `/api`) | Base URL of the `dropply-api` backend. Empty = same-origin `/api` (nsl in dev); production points it at the Worker URL (`.env.example`). |

Server-driven runtime config:

| Field | Effect |
| --- | --- |
| `requirePassword` | Gate sharing behind a password prompt (validated by attempting `createChest`; a 401 clears the cached password and re-prompts). |
| `emailShareEnabled` | Show the "email the code" action on the share dialog. |
| `maxFileSize` | Share/retrieve size cap; oversized shares fail client-side before any upload. |

Hardcoded upload tuning (in `src/lib/api.ts`): `CHUNK_SIZE = 20 MB`, part
`concurrencyLimit = min(3, totalParts)`, `MAX_RETRIES = 3` (linear backoff).

There are **no Cloudflare bindings** — no KV/R2/D1/DO. `wrangler.jsonc` only
serves `./out` as static assets. Storage, the share-password check, rate
limiting, and email delivery all live in `dropply-api`.

## Backend endpoints

All HTTP goes through `PocketChestAPI` (`src/lib/api.ts`) to `dropply-api`. The
envelope is `{ code, message, data }`; success is `code === 0`.

| Method | Route | Purpose |
| --- | --- | --- |
| `GET` | `/api/config` | Runtime config (`requirePassword`, `emailShareEnabled`, `maxFileSize`). |
| `POST` | `/api/chest` | Create a chest → `{ sessionId, uploadToken }` (body carries `password` when gated). |
| `POST` | `/api/chest/:sessionId/upload` | Direct upload of the ciphertext file. |
| `POST` | `/api/chest/:sessionId/multipart/create` | Start a large-file multipart upload (`uploadId` is itself a JWT). |
| `PUT` | `/api/chest/:sessionId/multipart/:fileId/part/:n` | Upload one 20 MB part. |
| `POST` | `/api/chest/:sessionId/multipart/:fileId/complete` | Finalize a multipart file. |
| `POST` | `/api/chest/:sessionId/complete` | Seal the chest → `{ retrievalCode }`. |
| `GET` | `/api/retrieve/:code` | Resolve a code → `{ files, chestToken }`. |
| `GET` | `/api/download/:fileId` | Download one ciphertext blob (`Authorization: Bearer` header only). |
| `POST` | `/api/email/share` | Email the retrieval code (server-side send). |

## Project structure

```
src/
  app/
    layout.tsx                trivial root layout (root not-found.tsx exists)
    page.tsx                  root → redirect('/en')
    dropply.css               app-specific keyframes (hero shine)
    [locale]/layout.tsx       fonts, SEO metadata + JSON-LD, providers
    [locale]/page.tsx         ScrollArea shell: AppHeader + Hero(tool) + Features + HowItWorks + AppFooter
  components/
    landing.tsx               Hero (tool host), Features, HowItWorks, FAQ
    layout/                   AppHeader (scroll-aware; history/retrieve/keys/lang/theme icons), AppFooter, providers
    local-crypto/             LocalCryptoPanel + LocalInputPanel + LocalResultCard + LocalResultDialog + HistoryDialog
    keys/                     KeyManagerDialog + PinInput
    retrieve/RetrieveEntry.tsx  code dialog → download → feed into the tool
    EmailShare.tsx            email-the-code dialog (server-gated)
  hooks/useCryptoProcessor.ts one shared engine: input state, worker calls, auto-detect
  workers/cryptoWorker.ts     @cdlab/cipher in a Web Worker (streamCrypto + textCrypto + progress)
  lib/
    api.ts                    PocketChestAPI — the sole HTTP client to dropply-api
    share-blob.ts             model-A share: upload a finished ciphertext, return code + link
    keys.ts                   BIP39 → BIP32 (m/44'/0'/0'/0/0) → secp256k1; base58 public keys
    pin.ts                    Argon2id PIN hash/verify for the key manager
  store/
    useProcessStore.ts        encrypt/decrypt result history (persisted to IndexedDB, payloads included)
    useKeysStore.ts           key pairs + contact public keys ('dropply-keys', base64-obfuscated localStorage)
    useAuthStore.ts           cached share password ('dropply-auth', sessionStorage)
  i18n/                       next-intl routing/request/navigation (en, zh)
  middleware.ts               next-intl locale middleware (inert in static export; present for dev)
DESIGN.md                     architecture + crypto / share / storage security spec
llms.txt                      agent-oriented usage guide
```

## Build, lint & deploy

```bash
pnpm --filter @cdlab/dropply-web typecheck  # tsc --noEmit
pnpm --filter @cdlab/dropply-web build       # next build → static out/
```

There is no test script and no test files in this app. `next build` produces a
static `out/` (because of `output: 'export'`); `wrangler.jsonc` serves that
directory as static assets, and `dropply.pages.dev` is the live deployment.

## Non-goals

- **Not a key-exchange channel.** The password / private key is exchanged
  out-of-band by design — the share link and email carry only the retrieval
  code.
- **No server logic here.** Static export means no SSR data fetching, no API
  routes, no edge/node functions. `middleware.ts` and `generateMetadata` run at
  dev/build only; the shipped artifact is plain files.
- **Not a key-recovery service.** Lose the password / mnemonic and the data is
  unrecoverable by design — the server can't help.

## Design

[`DESIGN.md`](DESIGN.md) is the authoritative spec — the worker-based crypto
engine, auto-detection, the key manager and its storage caveats, the model-A
share contract, and the client-storage security rules. Read it before changing
the share flow, key persistence, or the detect() dispatch.

## License

[MIT](../../LICENSE) © 2025-PRESENT [wudi](https://github.com/WuChenDi)
