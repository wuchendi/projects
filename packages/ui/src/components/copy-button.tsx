"use client";

import * as React from "react";
import { CheckIcon, CopyIcon } from "lucide-react";
import { Button } from "@cdlab/ui/components/button";
import { cn } from "@cdlab/ui/lib/utils";

interface CopyButtonProps extends React.ComponentProps<typeof Button> {
  value?: string;
}

const CopyButton = React.forwardRef<HTMLButtonElement, CopyButtonProps>(
  ({ value, size = "icon", className, onClick, ...props }, ref) => {
    const [copied, setCopied] = React.useState(false);

    const handleCopy: CopyButtonProps["onClick"] = (event) => {
      if (value) {
        navigator.clipboard.writeText(value).catch(() => {});
      }
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
      onClick?.(event);
    };

    return (
      <Button
        ref={ref}
        variant="ghost"
        size={size}
        aria-label={copied ? "Copied" : "Copy to clipboard"}
        disabled={copied}
        className={cn("relative active:scale-[0.97]", className)}
        onClick={handleCopy}
        {...props}
      >
        <div
          className={cn(
            "transition-all duration-200",
            copied
              ? "scale-100 opacity-100 blur-none"
              : "scale-70 opacity-0 blur-[2px]",
          )}
        >
          <CheckIcon strokeWidth={2} aria-hidden="true" />
        </div>
        <div
          className={cn(
            "absolute transition-all duration-200",
            copied
              ? "scale-0 opacity-0 blur-[2px]"
              : "scale-100 opacity-100 blur-none",
          )}
        >
          <CopyIcon strokeWidth={2} aria-hidden="true" />
        </div>
      </Button>
    );
  },
);

CopyButton.displayName = "CopyButton";

export { CopyButton };
export type { CopyButtonProps };
