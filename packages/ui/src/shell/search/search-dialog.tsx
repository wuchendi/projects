"use client";

import type { LucideIcon } from "lucide-react";
import { useEffect, useState } from "react";
import {
  Command,
  CommandDialog,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from "@cdlab/ui/components/command";
import { useShellLabels } from "@cdlab/ui/shell/core/labels-context";
import type { ShellSpace } from "@cdlab/ui/shell/core/spaces";
import { useShellNavigate } from "@cdlab/ui/shell/router";

/** One hit of the host's search. */
export interface ShellSearchResult {
  id: string;
  label: string;
  /** Muted text on the right, e.g. a short URL. */
  detail?: string;
  icon?: LucideIcon;
  onSelect: () => void;
}

/**
 * Cmd/Ctrl+K dialog: the host's `search` results (debounced, aborted when superseded) and a
 * "Go to" list of the spaces, filtered by the query.
 */
export function SearchDialog({
  open,
  onOpenChange,
  spaces,
  search,
  resultsLabel,
  limit = 8,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  spaces: ShellSpace[];
  search?: (query: string, signal: AbortSignal) => Promise<ShellSearchResult[]>;
  /** Heading of the results group. */
  resultsLabel?: string;
  limit?: number;
}) {
  const labels = useShellLabels();
  const navigate = useShellNavigate();
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<ShellSearchResult[]>([]);
  const [pending, setPending] = useState(false);
  const [failed, setFailed] = useState(false);

  useEffect(() => {
    if (!open) setQuery("");
  }, [open]);

  useEffect(() => {
    const q = query.trim();
    setFailed(false);
    if (!search || !q) {
      setResults([]);
      setPending(false);
      return;
    }
    setPending(true);
    const controller = new AbortController();
    const id = setTimeout(() => {
      search(q, controller.signal)
        .then(r => {
          if (!controller.signal.aborted) setResults(r.slice(0, limit));
        })
        .catch(() => {
          if (controller.signal.aborted) return;
          setResults([]);
          setFailed(true);
        })
        .finally(() => {
          if (!controller.signal.aborted) setPending(false);
        });
    }, 200);
    return () => {
      clearTimeout(id);
      controller.abort();
    };
  }, [query, search, limit]);

  const go = (run: () => void) => {
    onOpenChange(false);
    run();
  };
  const q = query.trim().toLowerCase();

  return (
    <CommandDialog
      open={open}
      onOpenChange={onOpenChange}
      title={labels.search}
      description={labels.searchPlaceholder}
    >
      <Command shouldFilter={false}>
        <CommandInput
          value={query}
          onValueChange={setQuery}
          placeholder={labels.searchPlaceholder}
        />
        <CommandList>
          {results.length === 0 && (pending || failed) ? (
            <div role="status" className="py-3 text-center text-sm text-muted-foreground">
              {pending ? labels.loading : labels.searchFailed}
            </div>
          ) : (
            <CommandEmpty>{labels.searchEmpty}</CommandEmpty>
          )}
          {results.length > 0 && (
            <CommandGroup heading={resultsLabel}>
              {results.map(r => {
                const Icon = r.icon;
                return (
                  <CommandItem key={r.id} value={`result:${r.id}`} onSelect={() => go(r.onSelect)}>
                    {Icon && <Icon />}
                    <span className="truncate">{r.label}</span>
                    {r.detail && (
                      <span className="ml-auto truncate font-mono text-xs text-muted-foreground">
                        {r.detail}
                      </span>
                    )}
                  </CommandItem>
                );
              })}
            </CommandGroup>
          )}
          <CommandGroup heading={labels.goTo}>
            {spaces
              .filter(s => s.label.toLowerCase().includes(q))
              .map(s => {
                const Icon = s.icon;
                return (
                  <CommandItem
                    key={s.key}
                    value={`space:${s.key}`}
                    onSelect={() => go(() => navigate(s.href))}
                  >
                    <Icon />
                    {s.label}
                  </CommandItem>
                );
              })}
          </CommandGroup>
        </CommandList>
      </Command>
    </CommandDialog>
  );
}
