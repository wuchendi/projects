const BYPLAY_URL = 'https://byplay.pages.dev'

/** Link that opens a stream in the ByPlay player. */
export const byplayLink = (locale: string, url: string) =>
  `${BYPLAY_URL}/${locale}?url=${encodeURIComponent(url.trim())}`
