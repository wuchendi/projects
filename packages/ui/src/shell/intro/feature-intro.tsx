"use client";

import type { LucideIcon } from "lucide-react";
import { ArrowDown } from "lucide-react";
import type { ReactNode } from "react";

/**
 * First-run page for a list with nothing in it yet: what the feature is, its one action and a
 * static picture of it. It replaces the empty state, so it goes away once the first item exists.
 */
export function FeatureIntro({
  icon: Icon,
  label,
  title,
  description,
  action,
  art,
}: {
  icon: LucideIcon;
  label: string;
  title: string;
  description: string;
  action: ReactNode;
  art: ReactNode;
}) {
  return (
    <div className="grid items-center gap-10 py-10 lg:grid-cols-[minmax(0,1fr)_minmax(0,26rem)] lg:py-16">
      <div className="max-w-xl space-y-4">
        <span className="inline-flex items-center gap-1.5 rounded-md bg-primary/10 px-2 py-1 text-xs font-medium text-primary dark:bg-primary/25 dark:text-foreground">
          <Icon className="size-3.5" />
          {label}
        </span>
        <h2 className="text-2xl font-semibold tracking-tight sm:text-3xl">{title}</h2>
        <p className="text-muted-foreground">{description}</p>
        <div className="pt-2">{action}</div>
      </div>
      <div aria-hidden="true" className="rounded-xl bg-muted/50 p-5 ring-1 ring-border/60">
        {art}
      </div>
    </div>
  );
}

/** A card in an intro picture. */
export function IntroArtCard({ children }: { children: ReactNode }) {
  return (
    <div className="rounded-lg bg-background p-3 text-[13px] shadow-sm ring-1 ring-border/60">
      {children}
    </div>
  );
}

/** A down arrow between two intro cards. */
export function IntroArtArrow() {
  return (
    <div className="flex justify-center py-1.5 text-muted-foreground/60">
      <ArrowDown className="size-4" />
    </div>
  );
}
