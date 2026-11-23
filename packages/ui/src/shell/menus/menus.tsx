"use client";

import { cn } from "cn";
import { Filter, Search, SlidersHorizontal, X } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import { Button } from "@cdlab/ui/components/button";
import { Popover, PopoverContent, PopoverTrigger } from "@cdlab/ui/components/popover";
import { Switch } from "@cdlab/ui/components/switch";
import { ToggleGroup, ToggleGroupItem } from "@cdlab/ui/components/toggle-group";
import { isBareKeyBlocked } from "@cdlab/ui/shell/core/is-typing";
import { formatLabel } from "@cdlab/ui/shell/core/labels";
import { useShellLabels } from "@cdlab/ui/shell/core/labels-context";

// A chip in a menu's toggle group: pressed reads as the primary tint.
const CHIP =
  "h-7 gap-1.5 px-2 text-[12px] aria-pressed:border-primary/40 aria-pressed:bg-primary/10 aria-pressed:text-primary dark:aria-pressed:border-primary/70 dark:aria-pressed:bg-primary/30 dark:aria-pressed:text-foreground";

// List header controls: "Filter" (what is shown; an icon that carries the
// active count) and "Display" (layout, sort, columns), each a titled popover,
// plus reset and an expanding search.

export function FilterMenu({
  count,
  onReset,
  className,
  children,
}: {
  count: number;
  onReset: () => void;
  className?: string;
  children: React.ReactNode;
}) {
  const labels = useShellLabels();
  const active = count > 0;
  return (
    <Popover>
      <PopoverTrigger
        render={
          <Button
            variant="ghost"
            size="sm"
            aria-label={active ? formatLabel(labels.filterActive, { count }) : labels.filter}
            title={labels.filter}
            className={cn(
              "h-7 min-w-7 shrink-0 gap-1.5 px-1.5 text-muted-foreground",
              active && "text-foreground",
            )}
          />
        }
      >
        <Filter />
        {active && (
          <span className="rounded-sm bg-primary/10 px-1 text-[11px] font-medium text-primary tabular-nums dark:bg-primary/30 dark:text-foreground">
            {count}
          </span>
        )}
      </PopoverTrigger>
      <PopoverContent align="start" className={cn("w-80 gap-1 p-3", className)}>
        <h4 className="text-[13px] font-semibold">{labels.filter}</h4>
        {children}
        <div className="mt-2 flex justify-end">
          <Button size="sm" disabled={!active} onClick={onReset}>
            {labels.reset}
          </Button>
        </div>
      </PopoverContent>
    </Popover>
  );
}

export function DisplayMenu({ children }: { children: React.ReactNode }) {
  const labels = useShellLabels();
  return (
    <Popover>
      <PopoverTrigger
        render={
          <Button
            variant="ghost"
            size="icon-sm"
            aria-label={labels.display}
            title={labels.display}
            className="shrink-0 text-muted-foreground"
          />
        }
      >
        <SlidersHorizontal />
      </PopoverTrigger>
      <PopoverContent align="end" className="w-80 gap-1 p-3">
        <h4 className="text-[13px] font-semibold">{labels.display}</h4>
        {children}
      </PopoverContent>
    </Popover>
  );
}

// A labelled block: the label (and an optional control) over its content.
export function MenuSection({
  label,
  action,
  children,
}: {
  label: string;
  action?: React.ReactNode;
  children: React.ReactNode;
}) {
  return (
    <div className="flex flex-col gap-1.5 py-1">
      <div className="flex min-h-6 items-center justify-between gap-3">
        <span className="text-[13px] text-muted-foreground">{label}</span>
        {action}
      </div>
      {children}
    </div>
  );
}

// Label left, control right.
export function MenuRow({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="flex min-h-8 items-center justify-between gap-3 text-[13px]">
      <span className="text-muted-foreground">{label}</span>
      {children}
    </div>
  );
}

// Chips picking one value, or several when `multiple`.
export function Chips<T extends string>({
  value,
  options,
  onChange,
  multiple = false,
}: {
  value: T[];
  options: { value: T; label: React.ReactNode }[];
  onChange: (next: T[]) => void;
  multiple?: boolean;
}) {
  return (
    <ToggleGroup
      variant="outline"
      size="sm"
      spacing={1}
      multiple={multiple}
      className="flex-wrap"
      value={value}
      onValueChange={next => onChange(next as T[])}
    >
      {options.map(o => (
        <ToggleGroupItem key={o.value} value={o.value} className={CHIP}>
          {o.label}
        </ToggleGroupItem>
      ))}
    </ToggleGroup>
  );
}

export function ChipCount({ count }: { count: number }) {
  return <span className="text-[11px] text-muted-foreground tabular-nums">{count}</span>;
}

// Clears the filters and search; render it only while one is on.
export function ResetButton({ onClick }: { onClick: () => void }) {
  const labels = useShellLabels();
  return (
    <Button
      variant="ghost"
      size="sm"
      className="h-7 shrink-0 px-2 text-muted-foreground"
      onClick={onClick}
    >
      {labels.reset}
    </Button>
  );
}

// A label-left switch row, e.g. a column toggle.
export function MenuSwitch({
  label,
  checked,
  onChange,
}: {
  label: string;
  checked: boolean;
  onChange: (next: boolean) => void;
}) {
  return (
    <MenuRow label={label}>
      <Switch checked={checked} onCheckedChange={onChange} aria-label={label} />
    </MenuRow>
  );
}

// Header search: an icon until used, then a field. "/" opens it; Esc or the
// clear button empties and closes it. A query keeps it open.
export function HeaderSearch({
  value,
  onChange,
  placeholder,
}: {
  value: string;
  onChange: (value: string) => void;
  // Hint shown in the open field; the control itself is named "Search".
  placeholder: string;
}) {
  const labels = useShellLabels();
  const label = labels.search;
  const [open, setOpen] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);
  const expanded = open || value !== "";

  useEffect(() => {
    if (open) inputRef.current?.focus();
  }, [open]);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key !== "/" || e.metaKey || e.ctrlKey || e.altKey) return;
      if (e.defaultPrevented || isBareKeyBlocked(e)) return;
      e.preventDefault();
      setOpen(true);
      inputRef.current?.focus();
    };
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, []);

  function close() {
    onChange("");
    setOpen(false);
  }

  if (!expanded) {
    return (
      <Button
        variant="ghost"
        size="icon-sm"
        aria-label={label}
        title={`${label} (/)`}
        className="shrink-0 text-muted-foreground"
        onClick={() => setOpen(true)}
      >
        <Search />
      </Button>
    );
  }
  return (
    <div className="relative flex h-7 min-w-32 max-w-60 flex-1 items-center">
      <Search className="pointer-events-none absolute left-2 size-3.5 text-muted-foreground" />
      <input
        ref={inputRef}
        value={value}
        aria-label={label}
        placeholder={placeholder}
        autoComplete="off"
        spellCheck={false}
        onChange={e => onChange(e.target.value)}
        onBlur={() => setOpen(false)}
        onKeyDown={e => {
          if (e.key !== "Escape") return;
          e.preventDefault();
          close();
          e.currentTarget.blur();
        }}
        className="h-7 w-full rounded-md border border-input bg-transparent pr-7 pl-7 text-[13px] outline-none placeholder:text-muted-foreground focus-visible:border-ring focus-visible:ring-2 focus-visible:ring-ring/40 dark:bg-input/30"
      />
      {value && (
        <button
          type="button"
          aria-label={labels.clearSearch}
          onMouseDown={e => e.preventDefault()}
          onClick={close}
          className="absolute right-1.5 rounded text-muted-foreground hover:text-foreground"
        >
          <X className="size-3.5" />
        </button>
      )}
    </div>
  );
}
