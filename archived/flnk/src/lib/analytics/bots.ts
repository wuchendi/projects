// Union of the two historical user-agent lists — the generic-bot patterns from
// analytics and the social-crawler patterns from redirect — merged as a
// superset so neither detector loses an entry it matched before. Both original
// call sites matched case-insensitively by substring (`.includes`), so a single
// matcher backs both exported predicates without changing either site's
// matching semantics.
const BOT_USER_AGENTS = [
  'bot',
  'crawler',
  'spider',
  'scraper',
  'facebook',
  'twitter',
  'linkedin',
  'telegram',
  'whatsapp',
  'discord',
  'slack',
  'googlebot',
  'bingbot',
  'yahoobot',
  'facebookexternalhit',
  'twitterbot',
  'linkedinbot',
  'applebot',
  'discordbot',
  'facebot',
  'linkexpanding',
  'mastodon',
  'pinterest',
  'skypeuripreview',
  'slackbot',
  'slackbot-linkexpanding',
  'snapchat',
  'telegrambot',
  'tiktok',
] as const

// Narrower crawler-only token list backing `isBot`. Deliberately excludes the
// bare social-brand names ('facebook', 'tiktok', 'pinterest', 'snapchat', …)
// from BOT_USER_AGENTS: those match human clicks from in-app browsers (the
// Facebook/TikTok/etc. WebView), so counting them as bots would undercount real
// traffic when DISABLE_BOT_ACCESS_LOG is on. Only true crawler/bot tokens here.
const ANALYTICS_BOT_USER_AGENTS = [
  'bot',
  'crawler',
  'spider',
  'scraper',
  'googlebot',
  'bingbot',
  'yahoobot',
  'facebookexternalhit',
  'twitterbot',
  'linkedinbot',
  'applebot',
  'discordbot',
  'facebot',
  'skypeuripreview',
  'slackbot',
  'slackbot-linkexpanding',
  'telegrambot',
] as const

function matchesList(list: readonly string[], userAgent: string): boolean {
  const ua = userAgent.toLowerCase()
  return list.some((pattern) => ua.includes(pattern))
}

// Generic bot/crawler detection for analytics (was analytics.ts `isBot`). Uses
// the NARROW crawler-only list so real human clicks from social in-app browsers
// aren't dropped from analytics when DISABLE_BOT_ACCESS_LOG is on (default is
// off — see env.ts `disableBotAccessLog`). isBot = undercount-avoidance;
// isSocialCrawler = OG-serving superset (still matches the full union below).
export function isBot(userAgent: string): boolean {
  return matchesList(ANALYTICS_BOT_USER_AGENTS, userAgent)
}

// Social-crawler detection for OG serving on redirects (was redirect.ts
// `isSocialCrawler`). Keeps the broad union list + substring match so OG serving
// still triggers for every brand crawler it matched before.
export function isSocialCrawler(ua: string): boolean {
  return matchesList(BOT_USER_AGENTS, ua)
}
