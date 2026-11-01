#!/usr/bin/env node
// Redirect-path benchmark for Flnk.
//
// Measures latency / throughput of the edge resolve path (`/[slug]`) with
// `redirect: manual`, so it times the Worker's slug resolution — KV positive
// cache, negative cache, or D1 fallback — rather than the destination site.
//
// Scenarios (run any subset via --scenario):
//   hit    reuse one EXISTING slug             → KV positive-cache path
//   miss   reuse one MISSING slug              → negative-cache path (after the
//                                                first request seeds the tombstone)
//   cold   a fresh random missing slug each    → D1 penetration with NO negative-
//          request                               cache reuse (the baseline the
//                                                negative cache is meant to beat)
//
// Usage:
//   node scripts/bench.mjs \
//     --url http://flnk.localhost:3355 \
//     --slug existing-hot-slug \
//     --requests 2000 --concurrency 50 \
//     --scenario hit,miss,cold
//
// `--slug` is only needed for the `hit` scenario (an existing link). The miss /
// cold scenarios synthesize their own non-existent slugs.

const args = parseArgs(process.argv.slice(2))
const BASE_URL = (args.url ?? 'http://flnk.localhost:3355').replace(/\/$/, '')
const HOT_SLUG = args.slug ?? ''
const TOTAL = Number(args.requests ?? 2000)
const CONCURRENCY = Number(args.concurrency ?? 50)
const TIMEOUT_MS = Number(args.timeout ?? 10000)
const SCENARIOS = (args.scenario ?? 'hit,miss,cold')
  .split(',')
  .map((s) => s.trim())
  .filter(Boolean)

function parseArgs(argv) {
  const out = {}
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i]
    if (a.startsWith('--')) {
      const key = a.slice(2)
      const next = argv[i + 1]
      if (next && !next.startsWith('--')) {
        out[key] = next
        i++
      } else {
        out[key] = 'true'
      }
    }
  }
  return out
}

// A slug guaranteed not to exist (random suffix), used by miss/cold scenarios.
function randomMissingSlug() {
  return `bench-missing-${Math.random().toString(36).slice(2, 14)}`
}

// One timed request against `/{slug}`. Returns { ms, status } or { ms, error }.
async function timeOne(slug) {
  const ctrl = new AbortController()
  const t = setTimeout(() => ctrl.abort(), TIMEOUT_MS)
  const start = performance.now()
  try {
    const res = await fetch(`${BASE_URL}/${slug}`, {
      method: 'GET',
      redirect: 'manual',
      signal: ctrl.signal,
    })
    // Drain the body so the connection can be reused.
    await res.arrayBuffer().catch(() => {})
    return { ms: performance.now() - start, status: res.status }
  } catch (err) {
    return { ms: performance.now() - start, error: err?.name ?? 'error' }
  } finally {
    clearTimeout(t)
  }
}

function percentile(sortedAsc, p) {
  if (sortedAsc.length === 0) return 0
  const idx = Math.min(
    sortedAsc.length - 1,
    Math.ceil((p / 100) * sortedAsc.length) - 1,
  )
  return sortedAsc[Math.max(0, idx)]
}

async function runScenario(name) {
  // Per-scenario slug supplier.
  let nextSlug
  if (name === 'hit') {
    if (!HOT_SLUG) {
      console.error(`  ! scenario "hit" needs --slug <existing-slug>; skipping`)
      return null
    }
    nextSlug = () => HOT_SLUG
  } else if (name === 'miss') {
    const fixed = randomMissingSlug()
    nextSlug = () => fixed // same missing slug → negative-cache reuse
  } else if (name === 'cold') {
    nextSlug = () => randomMissingSlug() // fresh miss every time → D1 each call
  } else {
    console.error(`  ! unknown scenario "${name}"; skipping`)
    return null
  }

  // Warm up once (seeds KV positive/negative cache where relevant).
  await timeOne(nextSlug())

  const latencies = []
  const statuses = new Map()
  let errors = 0
  let issued = 0

  const wallStart = performance.now()
  async function worker() {
    while (issued < TOTAL) {
      issued++
      const r = await timeOne(nextSlug())
      latencies.push(r.ms)
      if (r.error) {
        errors++
        statuses.set(r.error, (statuses.get(r.error) ?? 0) + 1)
      } else {
        statuses.set(r.status, (statuses.get(r.status) ?? 0) + 1)
      }
    }
  }
  await Promise.all(
    Array.from({ length: Math.min(CONCURRENCY, TOTAL) }, () => worker()),
  )
  const wallMs = performance.now() - wallStart

  latencies.sort((a, b) => a - b)
  const sum = latencies.reduce((acc, v) => acc + v, 0)
  return {
    name,
    count: latencies.length,
    rps: (latencies.length / wallMs) * 1000,
    mean: sum / latencies.length,
    p50: percentile(latencies, 50),
    p90: percentile(latencies, 90),
    p99: percentile(latencies, 99),
    max: latencies[latencies.length - 1] ?? 0,
    errors,
    statuses: Object.fromEntries(statuses),
  }
}

function fmt(n) {
  return n.toFixed(1)
}

async function main() {
  console.log(`Flnk redirect benchmark`)
  console.log(`  target      ${BASE_URL}`)
  console.log(`  requests    ${TOTAL}  concurrency ${CONCURRENCY}`)
  console.log(`  scenarios   ${SCENARIOS.join(', ')}\n`)

  const results = []
  for (const name of SCENARIOS) {
    process.stdout.write(`running ${name} ... `)
    const r = await runScenario(name)
    if (r) {
      results.push(r)
      console.log(`done (${r.count} reqs, ${fmt(r.rps)} rps)`)
    }
  }
  if (results.length === 0) return

  console.log(
    `\nscenario | reqs |   rps  | mean | p50  | p90  | p99  |  max  | errors`,
  )
  console.log(
    `---------|------|--------|------|------|------|------|-------|-------`,
  )
  for (const r of results) {
    console.log(
      `${r.name.padEnd(8)} | ${String(r.count).padStart(4)} | ` +
        `${fmt(r.rps).padStart(6)} | ${fmt(r.mean).padStart(4)} | ` +
        `${fmt(r.p50).padStart(4)} | ${fmt(r.p90).padStart(4)} | ` +
        `${fmt(r.p99).padStart(4)} | ${fmt(r.max).padStart(5)} | ${r.errors}`,
    )
  }
  console.log(`\n(latencies in ms; statuses: ${dumpStatuses(results)})`)
}

function dumpStatuses(results) {
  return results
    .map((r) => `${r.name}=${JSON.stringify(r.statuses)}`)
    .join('  ')
}

main().catch((err) => {
  console.error(err)
  process.exit(1)
})
