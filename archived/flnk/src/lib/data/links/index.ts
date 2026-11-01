// Barrel re-exporting the previous public surface of `@/lib/data/links`, which was a
// single module before being split by concern into cache/resolve/repo/tags.
export { linkCacheKey, purgeLink } from '@/lib/data/links/cache'
export type {
  ImportReport,
  LinkStatus,
  ListOptions,
  RepoResult,
  SortKey,
} from '@/lib/data/links/repo'
export {
  countLinks,
  createLink,
  deleteLink,
  getLinkById,
  getLinkRowsByIds,
  importLinks,
  listCreators,
  listLinks,
  searchLinks,
  updateLink,
  upsertLink,
} from '@/lib/data/links/repo'
export {
  disableLinkOnVisitCap,
  isExpired,
  normalizeSlug,
  resolveLink,
  visitLimitReached,
} from '@/lib/data/links/resolve'
export { bulkTagLinks, listTags, setLinkTags } from '@/lib/data/links/tags'
