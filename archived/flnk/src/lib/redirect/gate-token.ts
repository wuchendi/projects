// Short-lived signed token proving the password gate was already passed, so
// the unsafe-confirm form never re-carries the plaintext password. Format:
// `${expiresAtMs}.${hexSig}` where hexSig = HMAC-SHA-256(`${slug}:${ip}:${expiresAtMs}`)
// keyed by a token-specific key derived from BETTER_AUTH_SECRET via HKDF.
//
// The payload binds the client IP so a captured token can't be blindly replayed
// from another host for the whole TTL, and the signing key is separated from the
// raw auth secret so a gate-token leak never exposes the session-signing key.

const GATE_TOKEN_TTL_MS = 5 * 60 * 1000

// HKDF label — namespaces the derived key so it can never collide with any
// other use of BETTER_AUTH_SECRET.
const HKDF_INFO = 'flnk:gate-token:v1'

const encoder = new TextEncoder()

// Derive a dedicated HMAC key from BETTER_AUTH_SECRET instead of signing with
// the raw secret (key separation).
async function deriveSigningKey(secret: string): Promise<CryptoKey> {
  const ikm = await crypto.subtle.importKey(
    'raw',
    encoder.encode(secret),
    'HKDF',
    false,
    ['deriveKey'],
  )
  return crypto.subtle.deriveKey(
    {
      name: 'HKDF',
      hash: 'SHA-256',
      salt: new Uint8Array(0),
      info: encoder.encode(HKDF_INFO),
    },
    ikm,
    { name: 'HMAC', hash: 'SHA-256' },
    false,
    ['sign'],
  )
}

async function hmacHex(key: CryptoKey, payload: string): Promise<string> {
  const sig = await crypto.subtle.sign('HMAC', key, encoder.encode(payload))
  return Array.from(new Uint8Array(sig), (b) =>
    b.toString(16).padStart(2, '0'),
  ).join('')
}

export async function createGateToken(
  env: CloudflareEnv,
  slug: string,
  ip: string,
): Promise<string> {
  const expiresAtMs = Date.now() + GATE_TOKEN_TTL_MS
  const key = await deriveSigningKey(env.BETTER_AUTH_SECRET)
  const sig = await hmacHex(key, `${slug}:${ip}:${expiresAtMs}`)
  return `${expiresAtMs}.${sig}`
}

export async function verifyGateToken(
  env: CloudflareEnv,
  slug: string,
  ip: string,
  token: string,
): Promise<boolean> {
  const dot = token.indexOf('.')
  if (dot <= 0) return false
  const expiresAtMs = Number(token.slice(0, dot))
  if (!Number.isFinite(expiresAtMs) || expiresAtMs < Date.now()) return false
  const key = await deriveSigningKey(env.BETTER_AUTH_SECRET)
  const expected = await hmacHex(key, `${slug}:${ip}:${expiresAtMs}`)
  const given = token.slice(dot + 1)
  if (given.length !== expected.length) return false
  let diff = 0
  for (let i = 0; i < expected.length; i++) {
    diff |= given.charCodeAt(i) ^ expected.charCodeAt(i)
  }
  return diff === 0
}
