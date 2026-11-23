"use client";

import type { LucideIcon } from "lucide-react";
import { createContext } from "react";

/** What `<AppShell>` tells every page header: the space icon and whether a panel can be brought back. */
export const ShellPageContext = createContext<{ icon?: LucideIcon; hasPanel: boolean }>({
  hasPanel: false,
});

/** The gutter the header and the page body below it share. */
export const PAGE_GUTTER = "px-4 md:px-6";
/** Pulls the sticky header across `PAGE_GUTTER`. */
export const PAGE_GUTTER_BLEED = "-mx-4 md:-mx-6";
/** The page's top padding in the shell's scroll area. */
export const PAGE_TOP = "pt-4 md:pt-5";
/** Pulls the sticky header up over `PAGE_TOP`. */
export const PAGE_TOP_BLEED = "-mt-4 md:-mt-5";
