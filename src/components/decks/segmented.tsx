"use client";

import * as React from "react";
import { motion, useReducedMotion } from "framer-motion";
import { haptic } from "@/lib/feel/haptics";
import { SPRING_SNAPPY } from "@/lib/feel/motion";
import { cn } from "@/lib/utils";

/** Two-option segmented control (Arjun Sen / Anonymous; Find the best price / Test framing). The white thumb slides to the chosen option. */
export function Segmented<T extends string>({
  value,
  options,
  onChange,
  label,
}: {
  value: T;
  options: { value: T; label: React.ReactNode }[];
  onChange: (value: T) => void;
  label: string;
}) {
  const id = React.useId();
  const reduce = useReducedMotion();
  return (
    <div role="radiogroup" aria-label={label} className="flex rounded-xl bg-muted p-1">
      {options.map((o) => {
        const on = value === o.value;
        return (
          <button
            key={o.value}
            type="button"
            role="radio"
            aria-checked={on}
            onClick={() => {
              if (!on) haptic("select");
              onChange(o.value);
            }}
            className={cn(
              "relative min-h-11 flex-1 rounded-lg px-3 py-1.5 text-sm font-semibold leading-tight transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring",
              on ? "text-foreground" : "text-muted-foreground",
            )}
          >
            {on ? (
              <motion.span
                layoutId={`segmented-thumb-${id}`}
                transition={reduce ? { duration: 0 } : SPRING_SNAPPY}
                aria-hidden
                className="absolute inset-0 rounded-lg bg-background shadow-sm"
              />
            ) : null}
            <span className="relative">{o.label}</span>
          </button>
        );
      })}
    </div>
  );
}
