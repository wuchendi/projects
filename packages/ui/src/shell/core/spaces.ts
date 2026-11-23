import type { LucideIcon } from "lucide-react";

/** One rail entry: a top-level area of the app. */
export interface ShellSpace {
  key: string;
  href: string;
  /** Already translated. */
  label: string;
  icon: LucideIcon;
  /** Active only on `href` itself, not below it. */
  exact?: boolean;
  /** Extra path prefixes that belong to this space. */
  match?: string[];
  /** Shown at the rail foot as an icon only, above the account control. */
  footer?: boolean;
}

function under(pathname: string, prefix: string): boolean {
  return pathname === prefix || pathname.startsWith(`${prefix}/`);
}

/** Whether `pathname` belongs to an entry with an `href` (and optional `exact` / `match`). */
export function isActivePath(
  pathname: string,
  entry: { href: string; exact?: boolean; match?: string[] },
): boolean {
  if (entry.exact) return pathname === entry.href;
  return [entry.href, ...(entry.match ?? [])].some(p => under(pathname, p));
}

/** The first space `pathname` belongs to. */
export function spaceFor(spaces: readonly ShellSpace[], pathname: string): ShellSpace | undefined {
  return spaces.find(s => isActivePath(pathname, s));
}

/**
 * Whether a desktop rail click on the current space folds its panel instead of navigating: only a
 * space with a panel, on its own `href`. From a detail page the entry goes back to `href`.
 */
export function railEntryFolds(
  pathname: string,
  space: { href: string },
  hasPanel: boolean,
): boolean {
  return hasPanel && pathname === space.href;
}
