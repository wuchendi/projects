"use client";

import { createContext, use } from "react";

/** True inside `<PageBody fill>`: the body has a definite height and children scroll on their own. */
export const ShellPageFillContext = createContext(false);

/** Whether the caller sits in a fill page body. */
export function usePageFill(): boolean {
  return use(ShellPageFillContext);
}
