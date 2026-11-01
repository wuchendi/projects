import type { LinkConfig } from '@/database/schema'

// Interstitials are plain server-rendered HTML (no next-intl runtime), so they
// carry their own minimal en/zh string tables. `pickLocale` folds any locale
// tag down to a supported UI language.
type UiLocale = 'en' | 'zh'

function pickLocale(locale?: string): UiLocale {
  return locale?.toLowerCase().startsWith('zh') ? 'zh' : 'en'
}

const UNSAFE_STRINGS: Record<UiLocale, Record<string, string>> = {
  en: {
    title: 'Warning · external link',
    heading: '⚠️ You are leaving via an unverified link',
    body: 'This link was flagged as potentially unsafe. You are about to visit:',
    button: 'Continue anyway',
  },
  zh: {
    title: '警告 · 外部链接',
    heading: '⚠️ 您正在通过未经验证的链接离开',
    body: '该链接被标记为可能不安全。您即将访问：',
    button: '仍然继续',
  },
}

const PASSWORD_STRINGS: Record<UiLocale, Record<string, string>> = {
  en: {
    title: 'Protected link',
    heading: '🔒 This link is password protected',
    placeholder: 'Enter password',
    button: 'Unlock',
    error: 'Incorrect password. Try again.',
  },
  zh: {
    title: '受保护的链接',
    heading: '🔒 此链接受密码保护',
    placeholder: '输入密码',
    button: '解锁',
    error: '密码错误，请重试。',
  },
}

// Standalone interstitials can't use the React/Tailwind stack, so they inline a
// stylesheet that mirrors the app's shadcn design tokens (same oklch palette,
// `--radius`, primary / destructive colours) and follows the OS theme via
// `prefers-color-scheme` — keeping the password / unsafe pages visually in line
// with the rest of Flnk instead of a bespoke dark-only look.
const THEME_STYLE = `
*, *::before, *::after { box-sizing: border-box; }
:root {
  --background: oklch(1 0 0);
  --foreground: oklch(0.145 0 0);
  --card: oklch(1 0 0);
  --card-foreground: oklch(0.145 0 0);
  --primary: oklch(0.488 0.243 264.376);
  --primary-foreground: oklch(0.97 0.014 254.604);
  --muted-foreground: oklch(0.556 0 0);
  --destructive: oklch(0.58 0.22 27);
  --border: oklch(0.922 0 0);
  --input: oklch(0.922 0 0);
  --ring: oklch(0.708 0 0);
  --radius: 0.625rem;
}
@media (prefers-color-scheme: dark) {
  :root {
    --background: oklch(0.145 0 0);
    --foreground: oklch(0.985 0 0);
    --card: oklch(0.205 0 0);
    --card-foreground: oklch(0.985 0 0);
    --primary: oklch(0.42 0.18 266);
    --muted-foreground: oklch(0.708 0 0);
    --destructive: oklch(0.704 0.191 22.216);
    --border: oklch(1 0 0 / 10%);
    --input: oklch(1 0 0 / 15%);
    --ring: oklch(0.556 0 0);
  }
}
body {
  margin: 0;
  min-height: 100vh;
  display: flex;
  align-items: center;
  justify-content: center;
  padding: 1.5rem;
  font-family: system-ui, -apple-system, 'Segoe UI', Roboto, sans-serif;
  line-height: 1.5;
  background: var(--background);
  color: var(--foreground);
  -webkit-font-smoothing: antialiased;
}
.card {
  width: 100%;
  max-width: 28rem;
  padding: 2rem;
  background: var(--card);
  color: var(--card-foreground);
  border: 1px solid var(--border);
  border-radius: calc(var(--radius) + 4px);
  box-shadow: 0 1px 3px rgba(0, 0, 0, 0.06), 0 8px 24px rgba(0, 0, 0, 0.04);
}
.card h1 {
  margin: 0 0 0.5rem;
  font-size: 1.125rem;
  font-weight: 600;
  letter-spacing: -0.01em;
}
.card p {
  margin: 0.25rem 0;
  font-size: 0.9rem;
  color: var(--muted-foreground);
}
.url {
  margin-top: 0.75rem;
  padding: 0.6rem 0.75rem;
  border-radius: var(--radius);
  background: color-mix(in oklch, var(--foreground) 5%, transparent);
  font-family: ui-monospace, SFMono-Regular, Menlo, monospace;
  font-size: 0.8rem;
  color: var(--foreground);
  word-break: break-all;
}
.field {
  width: 100%;
  margin-top: 1rem;
  padding: 0.55rem 0.75rem;
  border: 1px solid var(--input);
  border-radius: var(--radius);
  background: transparent;
  color: var(--foreground);
  font-size: 0.9rem;
  outline: none;
}
.field:focus {
  border-color: var(--ring);
  box-shadow: 0 0 0 3px color-mix(in oklch, var(--ring) 30%, transparent);
}
.btn {
  width: 100%;
  margin-top: 0.75rem;
  padding: 0.6rem 1rem;
  border: none;
  border-radius: var(--radius);
  font-size: 0.9rem;
  font-weight: 500;
  cursor: pointer;
  transition: opacity 0.15s ease;
}
.btn:hover { opacity: 0.9; }
.btn-primary { background: var(--primary); color: var(--primary-foreground); }
.btn-danger { background: var(--destructive); color: oklch(0.985 0 0); }
.err { margin-top: 0.5rem; font-size: 0.8rem; color: var(--destructive); }
`

// Wrap interstitial body markup in the shared, theme-aware document shell.
function interstitialPage(lang: UiLocale, title: string, body: string): string {
  return `<!DOCTYPE html>
<html lang="${lang}">
  <head>
    <meta charset="UTF-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1.0" />
    <meta name="color-scheme" content="light dark" />
    <title>${escapeHtml(title)}</title>
    <meta name="robots" content="noindex, nofollow" />
    <style>${THEME_STYLE}</style>
  </head>
  <body>
    ${body}
  </body>
</html>`
}

export function escapeHtml(unsafe: string): string {
  return unsafe
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;')
}

// Only http(s) destinations may be rendered into an HTML page or a client-side
// navigation. Anything else (javascript:, data:, vbscript:, …) becomes
// about:blank so a malicious stored URL can't execute. Returns the *normalized*
// href, which percent-encodes `<`, `>`, `"` so it is also safe inside a
// `<script>` string literal.
export function safeExternalUrl(url: string): string {
  try {
    const u = new URL(url)
    if (u.protocol === 'http:' || u.protocol === 'https:') return u.href
  } catch {
    // unparseable — fall through to about:blank
  }
  return 'about:blank'
}

// Social-bot preview page. Renders OG/Twitter meta from the link config and
// (when not cloaking) bounces real browsers to the destination.
export function ogPageHtml(
  url: string,
  config: LinkConfig,
  options: { redirect: boolean } = { redirect: true },
): string {
  const target = safeExternalUrl(url)
  const safeUrl = escapeHtml(target)
  const title = escapeHtml(config.title || 'Flnk')
  const description = escapeHtml(config.description || '')
  const image = config.image ? escapeHtml(safeExternalUrl(config.image)) : ''
  // JSON.stringify yields a safe, double-quoted JS string literal; `target` is a
  // normalized http(s) href so it cannot contain `</script>`.
  const redirectScript = options.redirect
    ? `<script>window.location.replace(${JSON.stringify(target)});</script>
    <noscript><meta http-equiv="refresh" content="0;url=${safeUrl}" /></noscript>`
    : ''

  return `<!DOCTYPE html>
<html lang="en">
  <head>
    <meta charset="UTF-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1.0" />
    <title>${title}</title>
    <meta name="description" content="${description}" />
    <meta property="og:title" content="${title}" />
    <meta property="og:description" content="${description}" />
    <meta property="og:url" content="${safeUrl}" />
    <meta property="og:type" content="website" />
    ${image ? `<meta property="og:image" content="${image}" />` : ''}
    <meta name="twitter:card" content="summary_large_image" />
    <meta name="twitter:title" content="${title}" />
    <meta name="twitter:description" content="${description}" />
    ${image ? `<meta name="twitter:image" content="${image}" />` : ''}
    <meta name="robots" content="noindex, nofollow" />
    ${redirectScript}
  </head>
  <body>
    <p>Redirecting to <a href="${safeUrl}">${safeUrl}</a>…</p>
  </body>
</html>`
}

// Interstitial shown when a link is flagged unsafe. Confirming POSTs back to the
// slug with `confirm=true` (carrying a short-lived signed `gate` token when the
// link is also password-protected — never the plaintext password) so the route
// resolves geo/device targeting and writes the access log instead of bouncing
// straight to the destination.
export function unsafeWarningHtml(
  slug: string,
  url: string,
  options: { locale?: string; gateToken?: string } = {},
): string {
  const safeSlug = escapeHtml(slug)
  const safeUrl = escapeHtml(safeExternalUrl(url))
  const lang = pickLocale(options.locale)
  const s = UNSAFE_STRINGS[lang]
  const gateField = options.gateToken
    ? `<input type="hidden" name="gate" value="${escapeHtml(options.gateToken)}" />`
    : ''
  const body = `<form class="card" method="POST" action="/${safeSlug}">
      <h1>${escapeHtml(s.heading!)}</h1>
      <p>${escapeHtml(s.body!)}</p>
      <div class="url">${safeUrl}</div>
      <input type="hidden" name="confirm" value="true" />
      ${gateField}
      <button class="btn btn-danger" type="submit">${escapeHtml(s.button!)}</button>
    </form>`
  return interstitialPage(lang, s.title!, body)
}

// Password gate form. Submits back to the same slug via POST with the password.
export function passwordFormHtml(
  slug: string,
  error = false,
  locale?: string,
): string {
  const safeSlug = escapeHtml(slug)
  const lang = pickLocale(locale)
  const s = PASSWORD_STRINGS[lang]
  const body = `<form class="card" method="POST" action="/${safeSlug}">
      <h1>${escapeHtml(s.heading!)}</h1>
      <input class="field" type="password" name="password" placeholder="${escapeHtml(s.placeholder!)}" autofocus autocomplete="off" />
      <button class="btn btn-primary" type="submit">${escapeHtml(s.button!)}</button>
      ${error ? `<p class="err">${escapeHtml(s.error!)}</p>` : ''}
    </form>`
  return interstitialPage(lang, s.title!, body)
}
