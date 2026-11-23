"use client";

import { cn } from "cn";
import type { LucideIcon } from "lucide-react";
import type { ComponentProps } from "react";
import { Button } from "@cdlab/ui/components/button";
import { Tooltip, TooltipContent, TooltipTrigger } from "@cdlab/ui/components/tooltip";

function Keys({ keys }: { keys: string[] }) {
  return (
    <span className="flex gap-0.5">
      {keys.map(k => (
        <kbd
          key={k}
          data-slot="kbd"
          className="rounded-sm bg-background/20 px-1 font-sans text-[11px] leading-4"
        >
          {k}
        </kbd>
      ))}
    </span>
  );
}

/** An icon-only control whose name lives in its tooltip, with optional key caps. */
export function IconButton({
  label,
  icon: Icon,
  keys,
  side = "bottom",
  className,
  ...props
}: Omit<ComponentProps<typeof Button>, "children"> & {
  label: string;
  icon: LucideIcon;
  keys?: string[];
  side?: "bottom" | "right";
}) {
  return (
    <Tooltip>
      <TooltipTrigger
        render={
          <Button
            variant="ghost"
            size="icon-sm"
            aria-label={label}
            className={cn("shrink-0 text-muted-foreground", className)}
            {...props}
          />
        }
      >
        <Icon />
      </TooltipTrigger>
      <TooltipContent side={side}>
        {label}
        {keys && <Keys keys={keys} />}
      </TooltipContent>
    </Tooltip>
  );
}
