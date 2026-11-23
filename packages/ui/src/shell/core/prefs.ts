/** Name of the cookie holding the shell's UI preferences. */
export const SHELL_PREFS_COOKIE = "appshell";

const MAX_AGE = 60 * 60 * 24 * 365;

/** UI preferences kept in a cookie, so a server render matches the client. */
export interface ShellPrefs {
  /** Whether the space panel is shown beside the page. */
  panelOpen: boolean;
  /** Width of the open panel, in percent of the content card. */
  panelSize?: number | undefined;
}

/**
 * Reads the prefs from a `Cookie` header, `document.cookie` or Next's `cookies().toString()`;
 * missing or malformed values fall back to an open panel at its default width.
 */
export function readShellPrefs(cookies: string): ShellPrefs {
  const pair = cookies
    .split(";")
    .map(part => part.trim())
    .find(part => part.startsWith(`${SHELL_PREFS_COOKIE}=`));
  const value = pair?.slice(SHELL_PREFS_COOKIE.length + 1).replace(/%3A/gi, ":") ?? "";
  const [open, size] = value.split(":");
  const prefs: ShellPrefs = { panelOpen: open !== "0" };
  const panelSize = Number(size);
  if (size && panelSize > 0 && panelSize < 100) prefs.panelSize = panelSize;
  return prefs;
}

/** A `document.cookie` assignment that stores the prefs for a year. */
export function shellPrefsCookie(prefs: ShellPrefs): string {
  const value = `${prefs.panelOpen ? 1 : 0}${prefs.panelSize ? `:${prefs.panelSize}` : ""}`;
  return `${SHELL_PREFS_COOKIE}=${value}; Path=/; Max-Age=${MAX_AGE}; SameSite=Lax`;
}
