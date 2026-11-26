"use client";

import * as React from "react";
import { Plus } from "lucide-react";
import { ToggleChip } from "./ui";

/**
 * Multi-select from a fixed list (nothing is free text). Selected values show as
 * black chips; "+ Add" reveals the rest. `inline` shows every option at once.
 */
export function ChipPicker<T extends string>({
  label,
  options,
  selected,
  onChange,
  inline = false,
}: {
  label: string;
  options: readonly T[];
  selected: T[];
  onChange: (next: T[]) => void;
  inline?: boolean;
}) {
  const [open, setOpen] = React.useState(false);
  const toggle = (value: T) => onChange(selected.includes(value) ? selected.filter((v) => v !== value) : [...selected, value]);
  const remaining = options.filter((o) => !selected.includes(o));

  return (
    <div role="group" aria-label={label} className="flex flex-wrap gap-2">
      {inline
        ? options.map((o) => (
            <ToggleChip key={o} selected={selected.includes(o)} onClick={() => toggle(o)}>
              {o}
            </ToggleChip>
          ))
        : selected.map((o) => (
            <ToggleChip key={o} selected onClick={() => toggle(o)}>
              {o}
            </ToggleChip>
          ))}
      {!inline && remaining.length > 0 ? (
        <button
          type="button"
          aria-expanded={open}
          onClick={() => setOpen((v) => !v)}
          className="inline-flex items-center gap-1 rounded-full border border-border px-4 py-2 text-sm font-semibold text-muted-foreground hover:bg-muted focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
        >
          <Plus className="size-4" /> Add
        </button>
      ) : null}
      {!inline && open ? (
        <div className="mt-1 flex max-h-48 w-full flex-wrap gap-2 overflow-y-auto rounded-xl bg-muted p-3">
          {remaining.map((o) => (
            <ToggleChip key={o} selected={false} onClick={() => toggle(o)}>
              {o}
            </ToggleChip>
          ))}
        </div>
      ) : null}
    </div>
  );
}
