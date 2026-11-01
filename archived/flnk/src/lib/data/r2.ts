// R2 is optional. The binding may be absent (not configured) — callers must
// gate on getR2() and degrade gracefully, like the analytics endpoints do.
export function getR2(env: CloudflareEnv): R2Bucket | null {
  return (env as { R2?: R2Bucket }).R2 ?? null
}

export function isR2Enabled(env: CloudflareEnv): boolean {
  return getR2(env) !== null
}

export const IMAGE_ALLOWED_TYPES = new Set([
  'image/jpeg',
  'image/png',
  'image/webp',
  'image/gif',
])
export const IMAGE_MAX_SIZE = 5 * 1024 * 1024 // 5 MB
