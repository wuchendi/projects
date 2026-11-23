"use client";

import { createContext, use } from "react";

export interface ShellPanelState {
  /** Whether the space panel is shown beside the page. */
  open: boolean;
  toggle: () => void;
  setOpen: (open: boolean) => void;
}

/** Provided by `<AppShell>`, which keeps the state in its prefs cookie. */
export const ShellPanelContext = createContext<ShellPanelState>({
  open: true,
  toggle: () => {},
  setOpen: () => {},
});

/** The space panel's open state and its setters. */
export function useShellPanel(): ShellPanelState {
  return use(ShellPanelContext);
}
