"use client";

import * as React from "react";
import { Eye, EyeOff } from "lucide-react";
import { cn } from "@/shared/lib/utils";
import { haptic } from "@/shared/lib/feel/haptics";

export const inputClass =
  "h-12 w-full rounded-lg border-2 border-border bg-background px-4 text-base text-foreground placeholder:text-muted-foreground transition-colors hover:border-input focus-visible:border-accent focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring/40";

export function Field({
  label,
  hint,
  htmlFor,
  aside,
  children,
}: {
  label: string;
  hint?: string;
  htmlFor: string;
  /** Right-aligned extra on the label row (e.g. "Forgot password?"). */
  aside?: React.ReactNode;
  children: React.ReactNode;
}) {
  return (
    <div className="flex flex-col gap-2">
      <div className="flex items-baseline justify-between gap-3">
        <label htmlFor={htmlFor} className="text-sm font-bold">
          {label}
          {hint && <span className="font-normal text-muted-foreground"> · {hint}</span>}
        </label>
        {aside}
      </div>
      {children}
    </div>
  );
}

/** Password input with a show/hide toggle. */
export function PasswordInput({
  id,
  value,
  onChange,
  autoComplete,
  minLength,
  required,
}: {
  id: string;
  value: string;
  onChange: (value: string) => void;
  autoComplete: "current-password" | "new-password";
  minLength?: number;
  required?: boolean;
}) {
  const [shown, setShown] = React.useState(false);
  return (
    <div className="relative">
      <input
        id={id}
        type={shown ? "text" : "password"}
        className={cn(inputClass, "pr-14")}
        autoComplete={autoComplete}
        minLength={minLength}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        required={required}
      />
      <button
        type="button"
        onClick={() => {
          haptic("select");
          setShown((s) => !s);
        }}
        aria-label={shown ? "Hide password" : "Show password"}
        aria-pressed={shown}
        aria-controls={id}
        className="absolute right-1.5 top-1/2 grid size-11 md:size-9 -translate-y-1/2 place-items-center rounded-full text-muted-foreground transition-colors hover:bg-muted hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
      >
        {shown ? <EyeOff aria-hidden className="size-4" /> : <Eye aria-hidden className="size-4" />}
      </button>
    </div>
  );
}

/** Pill chips from a fixed list. single = radio behaviour (role), otherwise multi-select (interests). */
export function ChipGroup<T extends string>({
  legend,
  options,
  value,
  onChange,
  single,
}: {
  legend: string;
  options: readonly T[];
  value: T[];
  onChange: (next: T[]) => void;
  single?: boolean;
}) {
  return (
    <fieldset className="flex flex-col gap-3">
      <legend className="mb-3 text-sm font-bold">{legend}</legend>
      <div className="flex flex-wrap gap-2">
        {options.map((option) => {
          const selected = value.includes(option);
          return (
            <button
              key={option}
              type="button"
              role={single ? "radio" : "checkbox"}
              aria-checked={selected}
              onClick={() => {
                haptic("select");
                onChange(single ? [option] : selected ? value.filter((v) => v !== option) : [...value, option]);
              }}
              className={cn(
                "pressable h-10 rounded-lg border-2 px-4 text-sm font-semibold transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-card",
                selected
                  ? "border-accent bg-accent text-accent-foreground"
                  : "border-border bg-transparent text-muted-foreground hover:border-input hover:text-foreground",
              )}
            >
              {option}
            </button>
          );
        })}
      </div>
    </fieldset>
  );
}

export function FormError({ message }: { message: string | null }) {
  if (!message) return null;
  return (
    <p role="alert" className="rounded-2xl bg-warning-soft px-4 py-3 text-sm font-semibold text-warning">
      {message}
    </p>
  );
}

/** Polite status line (e.g. "Sent again"). Always mounted so screen readers hear changes. */
export function FormNote({ message }: { message: string | null }) {
  return (
    <p role="status" aria-live="polite" className={cn("text-sm font-semibold text-accent", !message && "sr-only")}>
      {message ?? ""}
    </p>
  );
}

/** Inline text link styled for the auth screens. */
export const textLinkClass =
  "font-bold text-foreground underline underline-offset-4 decoration-2 decoration-accent/70 hover:decoration-accent rounded-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-card";
