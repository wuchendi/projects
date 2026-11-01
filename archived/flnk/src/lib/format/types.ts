// Shared repository/result types hoisted out of links.ts + launchpads.ts so a
// single definition backs both.

// Discriminated-union result for repository mutations. The success arm is spread
// from `TOk`, letting each repo keep its own payload key (`{ link }` /
// `{ launchpad }`); the failure arm is uniform.
export type RepoResult<TOk> =
  | ({ ok: true } & TOk)
  | { ok: false; status: number; error: string }

// Sort column shared by the link + launchpad list endpoints and their clients.
export type SortKey = 'createdAt' | 'updatedAt' | 'expiresAt'
