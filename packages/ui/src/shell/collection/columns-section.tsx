"use client";

import type { ShellColumn } from "@cdlab/ui/shell/collection/columns";
import { columnLabel, hideableColumns } from "@cdlab/ui/shell/collection/columns";
import { useShellLabels } from "@cdlab/ui/shell/core/labels-context";
import { MenuSection, MenuSwitch } from "@cdlab/ui/shell/menus/menus";

/** The display menu's column switches for a `CollectionTable`. */
export function ColumnsSection<T>({
  columns,
  hidden,
  onToggle,
}: {
  columns: ShellColumn<T>[];
  hidden: readonly string[];
  onToggle: (key: string) => void;
}) {
  const labels = useShellLabels();
  return (
    <MenuSection label={labels.columns}>
      {hideableColumns(columns).map(c => (
        <MenuSwitch
          key={c.key}
          label={columnLabel(c)}
          checked={!hidden.includes(c.key)}
          onChange={() => onToggle(c.key)}
        />
      ))}
    </MenuSection>
  );
}
