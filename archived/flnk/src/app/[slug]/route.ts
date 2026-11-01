import { verifyPasswordFn } from '@cdlab/utils'
import { getCloudflareContext } from '@opennextjs/cloudflare'
import type { NextRequest } from 'next/server'
import type { Link } from '@/database/schema'
import { extractAccessLog, writeAccessLog } from '@/lib/analytics/analytics'
import {
  disableLinkOnVisitCap,
  isExpired,
  purgeLink,
  resolveLink,
  visitLimitReached,
} from '@/lib/data/links'
import { getConfig } from '@/lib/platform/env'
import { logger } from '@/lib/platform/logger'
import {
  clientIp,
  passwordAttemptsExceeded,
  recordPasswordFailure,
} from '@/lib/platform/rate-limit'
import { createGateToken, verifyGateToken } from '@/lib/redirect/gate-token'
import {
  ogPageHtml,
  passwordFormHtml,
  unsafeWarningHtml,
} from '@/lib/redirect/html'
import {
  isSocialCrawler,
  resolveDestination,
  resolveRedirectLocale,
} from '@/lib/redirect/redirect'
import { isReservedSlug } from '@/lib/redirect/reserve-slug'

const NO_STORE = { 'cache-control': 'no-store' } as const

type RouteContext = { params: Promise<{ slug: string }> }

function notFound(request: Request, env: CloudflareEnv): Response {
  const { notFoundRedirect } = getConfig(env)
  if (notFoundRedirect) {
    // Resolve against the request origin so a relative path (e.g. `/404`) is
    // accepted — Response.redirect() requires an absolute URL and would throw.
    return Response.redirect(
      new URL(notFoundRedirect, request.url).toString(),
      302,
    )
  }
  return new Response('Not found', { status: 404, headers: NO_STORE })
}

// Per-IP rate limit on the resolve path (Cloudflare native Rate Limiting
// binding — per-colo, in-memory, no D1/KV quota cost). Returns a 429 Response
// when the caller is over the threshold, else null to proceed. Fails open
// (returns null) when disabled, when the binding is absent (dev), when the IP
// is unknown, or on any limiter error — availability over strictness, matching
// the KV rate-limit policy.
async function resolveRateLimited(
  request: Request,
  env: CloudflareEnv,
): Promise<Response | null> {
  if (!getConfig(env).resolveRateLimitEnabled) return null
  const binding = env.RESOLVE_RATE_LIMIT
  if (!binding) return null
  const ip = clientIp(request)
  if (ip === 'unknown') return null
  try {
    const { success } = await binding.limit({ key: ip })
    if (!success) {
      logger.info(`Resolve rate limit exceeded for IP: ${ip}`)
      return new Response('Too many requests', {
        status: 429,
        headers: NO_STORE,
      })
    }
  } catch (error) {
    logger.warn(
      'Resolve rate limit error',
      error instanceof Error ? error.message : error,
    )
  }
  return null
}

function htmlResponse(body: string, status = 200): Response {
  return new Response(body, {
    status,
    headers: { 'content-type': 'text/html; charset=utf-8', ...NO_STORE },
  })
}

// Build the final redirect + fire the access log.
async function redirectTo(
  request: Request,
  env: CloudflareEnv,
  cf: IncomingRequestCfProperties | undefined,
  ctx: { waitUntil: (p: Promise<unknown>) => void },
  link: Link,
  slug: string,
  // When the redirect follows a form POST (password / unsafe confirm) we must
  // emit 303 See Other so the browser follows it with GET — otherwise the
  // configured 307/308 status preserves the method and re-POSTs to the external
  // destination, which answers 405.
  seeOther = false,
): Promise<Response> {
  const ua = request.headers.get('user-agent') || ''

  // Click-limit expiry: over the maxVisits cap → persist the disable to D1
  // (so the cap survives KV cache expiry/rebuild), then purge the cache and
  // serve not-found. Increments the counter on the side-effect path when still
  // under the cap. Social crawlers are still gated by the cap (a capped link is
  // disabled for them too), but they don't increment the counter: they fetch OG
  // metadata without a real user click, so counting them would burn the cap.
  const countVisit = !isSocialCrawler(ua)
  if (await visitLimitReached(env, link, ctx, countVisit)) {
    logger.info(`Slug visit limit reached: ${slug}`)
    await disableLinkOnVisitCap(env, link)
    await purgeLink(env, new URL(request.url).hostname, slug)
    return notFound(request, env)
  }

  const dest = resolveDestination(link, {
    ua,
    country: cf?.country,
    search: new URL(request.url).search,
    env,
  })

  // Defense in depth: never emit a non-http(s) Location. The stored url or a
  // geo/device override could carry a foreign scheme (javascript:, data:, …);
  // a malformed or non-http(s) dest must not become a redirect target.
  try {
    const proto = new URL(dest).protocol
    if (proto !== 'http:' && proto !== 'https:') {
      logger.info(`Blocked non-http(s) destination for slug: ${slug}`)
      return notFound(request, env)
    }
  } catch {
    logger.info(`Malformed destination for slug: ${slug}`)
    return notFound(request, env)
  }

  // Persist the owner's STORED destination, not the query-merged `dest` — the
  // latter can carry visitor-controlled query input, which would let a crafted
  // URL inject arbitrary data into the access-log blob. `dest` is used only for
  // the Location header below.
  ctx.waitUntil(
    Promise.resolve().then(() =>
      writeAccessLog(
        env,
        extractAccessLog(request, slug, link.url, cf, 'link', link.ownerId),
      ),
    ),
  )

  const status = seeOther ? 303 : getConfig(env).redirectStatusCode
  return new Response(null, {
    status,
    headers: { location: dest, ...NO_STORE },
  })
}

// Post-gate resolution shared by browser and programmatic (header-password)
// paths: cloaking serves the OG/cloaking page, social crawlers get the OG
// preview only when the link carries OG metadata, an unsafe link shows the
// confirm interstitial (unless already cleared), otherwise we redirect.
async function afterGate(
  request: NextRequest,
  env: CloudflareEnv,
  cf: IncomingRequestCfProperties | undefined,
  ctx: { waitUntil: (p: Promise<unknown>) => void },
  link: Link,
  slug: string,
  ua: string,
  opts: { unsafeCleared: boolean; seeOther?: boolean },
): Promise<Response> {
  if (link.config.cloaking) {
    return htmlResponse(ogPageHtml(link.url, link.config, { redirect: false }))
  }

  // A crawler only gets the OG HTML when there is something to preview;
  // otherwise it falls through to a normal redirect (matches upstream).
  const hasOg = Boolean(link.config.title || link.config.image)
  if (isSocialCrawler(ua) && hasOg) {
    return htmlResponse(ogPageHtml(link.url, link.config, { redirect: true }))
  }

  if (link.config.unsafe && !opts.unsafeCleared) {
    return htmlResponse(
      unsafeWarningHtml(slug, link.url, {
        locale: resolveRedirectLocale(request),
      }),
    )
  }

  return redirectTo(request, env, cf, ctx, link, slug, opts.seeOther)
}

export async function GET(
  request: NextRequest,
  { params }: RouteContext,
): Promise<Response> {
  const { slug } = await params
  const { env, cf, ctx } = getCloudflareContext()

  if (isReservedSlug(slug)) return notFound(request, env)

  const rateLimited = await resolveRateLimited(request, env)
  if (rateLimited) return rateLimited

  const domain = new URL(request.url).hostname
  const link = await resolveLink(env, domain, slug)

  if (!link) {
    logger.info(`Slug not found: ${slug} (domain=${domain})`)
    return notFound(request, env)
  }

  if (isExpired(link.expiresAt)) {
    logger.info(`Slug expired: ${slug}`)
    await purgeLink(env, domain, slug)
    return notFound(request, env)
  }

  if (link.config.disabled) {
    logger.info(`Slug disabled: ${slug}`)
    return notFound(request, env)
  }

  const ua = request.headers.get('user-agent') || ''

  // Password gate takes priority — it must run before the OG/cloaking branch,
  // otherwise a social crawler would receive the destination via `og:url` and
  // defeat the gate.
  if (link.config.passwordHash) {
    // Programmatic clients can pass the password (and unsafe confirmation) as
    // headers instead of the HTML form; failures return 403, not the form.
    const headerPassword = request.headers.get('x-link-password')
    if (headerPassword === null) {
      return htmlResponse(
        passwordFormHtml(slug, false, resolveRedirectLocale(request)),
      )
    }
    const ip = clientIp(request)
    if (await passwordAttemptsExceeded(env, ip, slug)) {
      logger.info(`Password attempts rate-limited for slug: ${slug}`)
      return new Response('Too many failed password attempts', {
        status: 429,
        headers: NO_STORE,
      })
    }
    const ok = await verifyPasswordFn(link.config.passwordHash, headerPassword)
    if (!ok) {
      logger.info(`Incorrect x-link-password for slug: ${slug}`)
      await recordPasswordFailure(env, ip, slug)
      return new Response('Incorrect password', {
        status: 403,
        headers: NO_STORE,
      })
    }
    if (
      link.config.unsafe &&
      request.headers.get('x-link-confirm') !== 'true'
    ) {
      return new Response(
        'Unsafe link: set the x-link-confirm: true header to proceed',
        { status: 403, headers: NO_STORE },
      )
    }
    return afterGate(request, env, cf, ctx, link, slug, ua, {
      unsafeCleared: true,
    })
  }

  return afterGate(request, env, cf, ctx, link, slug, ua, {
    unsafeCleared: false,
  })
}

export async function POST(
  request: NextRequest,
  { params }: RouteContext,
): Promise<Response> {
  const { slug } = await params
  const { env, cf, ctx } = getCloudflareContext()

  if (isReservedSlug(slug)) return notFound(request, env)

  const rateLimited = await resolveRateLimited(request, env)
  if (rateLimited) return rateLimited

  const domain = new URL(request.url).hostname
  const link = await resolveLink(env, domain, slug)

  if (!link || isExpired(link.expiresAt) || link.config.disabled)
    return notFound(request, env)

  const ua = request.headers.get('user-agent') || ''
  const form = await request.formData()
  const confirmed = String(form.get('confirm') || '') === 'true'

  if (link.config.passwordHash) {
    // The unsafe-confirm form carries a short-lived signed token instead of the
    // plaintext password; a valid token counts as password-verified. An
    // invalid or expired token falls back to the password form.
    const gateToken = String(form.get('gate') || '')
    if (gateToken) {
      const ip = clientIp(request)
      if (await verifyGateToken(env, slug, ip, gateToken)) {
        if (link.config.unsafe && !confirmed) {
          return htmlResponse(
            unsafeWarningHtml(slug, link.url, {
              locale: resolveRedirectLocale(request),
              gateToken,
            }),
          )
        }
        return afterGate(request, env, cf, ctx, link, slug, ua, {
          unsafeCleared: true,
          seeOther: true,
        })
      }
      logger.info(`Invalid or expired gate token for slug: ${slug}`)
      return htmlResponse(
        passwordFormHtml(slug, false, resolveRedirectLocale(request)),
        401,
      )
    }

    const ip = clientIp(request)
    if (await passwordAttemptsExceeded(env, ip, slug)) {
      logger.info(`Password attempts rate-limited for slug: ${slug}`)
      return new Response('Too many failed password attempts', {
        status: 429,
        headers: NO_STORE,
      })
    }

    const password = String(form.get('password') || '')
    const ok = await verifyPasswordFn(link.config.passwordHash, password)

    if (!ok) {
      logger.info(`Incorrect password for slug: ${slug}`)
      await recordPasswordFailure(env, ip, slug)
      return htmlResponse(
        passwordFormHtml(slug, true, resolveRedirectLocale(request)),
        401,
      )
    }

    // Password verified — an unsafe link still needs an explicit confirmation,
    // chained from the same submission via a signed gate token (the plaintext
    // password is never echoed back into HTML).
    if (link.config.unsafe && !confirmed) {
      return htmlResponse(
        unsafeWarningHtml(slug, link.url, {
          locale: resolveRedirectLocale(request),
          gateToken: await createGateToken(env, slug, ip),
        }),
      )
    }

    return afterGate(request, env, cf, ctx, link, slug, ua, {
      unsafeCleared: true,
      seeOther: true,
    })
  }

  // No password — only the unsafe interstitial uses POST.
  return afterGate(request, env, cf, ctx, link, slug, ua, {
    unsafeCleared: confirmed,
    seeOther: true,
  })
}
