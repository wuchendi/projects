"use client";

import { createContext, use } from "react";
import type { ShellLabels } from "@cdlab/ui/shell/core/labels";
import { shellLabelsEn } from "@cdlab/ui/shell/core/labels";

export const ShellLabelsContext = createContext<ShellLabels>(shellLabelsEn);

/** The labels from the nearest `<AppShell>` (English outside one). */
export function useShellLabels(): ShellLabels {
  return use(ShellLabelsContext);
}
