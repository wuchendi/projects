"use client";

import { useEffect, useState } from "react";
import { useShellLabels } from "@cdlab/ui/shell/core/labels-context";
import { useShellNavigating } from "@cdlab/ui/shell/router";

/** A thin bar along the top of the content card while a navigation is pending, after a short delay. */
export function NavigationProgress() {
  const labels = useShellLabels();
  const loading = useShellNavigating();
  const [visible, setVisible] = useState(false);
  useEffect(() => {
    if (!loading) {
      setVisible(false);
      return;
    }
    const id = setTimeout(setVisible, 150, true);
    return () => clearTimeout(id);
  }, [loading]);
  if (!visible) return null;
  return (
    <div
      role="progressbar"
      aria-label={labels.loading}
      className="pointer-events-none absolute inset-x-0 top-0 z-30 h-0.5 overflow-hidden"
    >
      <div className="h-full w-1/3 animate-[shell-nav-progress_1.1s_ease-in-out_infinite] bg-primary" />
    </div>
  );
}
