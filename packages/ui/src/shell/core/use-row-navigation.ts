"use client";

import type { RefObject } from "react";
import { useEffect } from "react";
import { isBareKeyBlocked } from "@cdlab/ui/shell/core/is-typing";

/** Rows are the elements carrying this attribute (and a `tabIndex`). */
export const SHELL_ROW_ATTR = "data-shell-row";

/**
 * J/K and the arrow keys move focus between the rows inside `container`. From outside the list
 * they start at the first row while nothing else has focus; never while typing.
 */
export function useRowNavigation(container: RefObject<HTMLElement | null>): void {
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.metaKey || e.ctrlKey || e.altKey || e.defaultPrevented) return;
      const step =
        e.key === "j" || e.key === "ArrowDown" ? 1 : e.key === "k" || e.key === "ArrowUp" ? -1 : 0;
      if (!step || isBareKeyBlocked(e)) return;
      const root = container.current;
      if (!root) return;
      const rows = Array.from(root.querySelectorAll<HTMLElement>(`[${SHELL_ROW_ATTR}]`));
      if (rows.length === 0) return;
      const active = document.activeElement;
      const index = rows.indexOf(active as HTMLElement);
      const idle = !active || active === document.body;
      if (index < 0 && !idle) return;
      e.preventDefault();
      const next =
        index >= 0 ? rows[Math.min(rows.length - 1, Math.max(0, index + step))] : rows[0];
      next?.focus();
      next?.scrollIntoView?.({ block: "nearest" });
    };
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [container]);
}
