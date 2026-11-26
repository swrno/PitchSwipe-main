"use client";

import * as React from "react";
import { ChevronDown } from "lucide-react";
import { INDUSTRIES, ROLES, STATES, type Industry, type Role, type State } from "@/lib/lists";
import { haptic } from "@/lib/feel/haptics";
import { cn } from "@/lib/utils";
import type { ProfileFields } from "./types";

const inputClass =
  "h-12 w-full rounded-2xl border-2 border-border bg-background px-4 text-base font-medium text-foreground outline-none transition-colors placeholder:text-muted-foreground focus-visible:border-ring focus-visible:ring-2 focus-visible:ring-ring/40 disabled:cursor-not-allowed disabled:opacity-60";

/** Name, role, state and interests. Every list value comes from src/lib/lists; nothing is free text except the name. */
export function ProfileFieldsEditor({
  value,
  onChange,
  disabled = false,
  idPrefix,
}: {
  value: ProfileFields;
  onChange: (next: ProfileFields) => void;
  disabled?: boolean;
  idPrefix: string;
}) {
  const set = <K extends keyof ProfileFields>(key: K, v: ProfileFields[K]) => onChange({ ...value, [key]: v });

  function toggle(industry: Industry) {
    haptic("select");
    set("interests", value.interests.includes(industry) ? value.interests.filter((i) => i !== industry) : [...value.interests, industry]);
  }

  return (
    <div className="space-y-5">
      <div className="space-y-2">
        <label htmlFor={`${idPrefix}-name`} className="text-sm font-bold">
          Name
        </label>
        <input
          id={`${idPrefix}-name`}
          name="name"
          autoComplete="name"
          maxLength={80}
          required
          disabled={disabled}
          value={value.name}
          onChange={(e) => set("name", e.target.value)}
          className={inputClass}
        />
      </div>

      <div className="grid gap-5 md:grid-cols-2">
        <Select
          id={`${idPrefix}-role`}
          label="What do you do?"
          value={value.role}
          options={ROLES}
          placeholder="Pick your role"
          disabled={disabled}
          onChange={(v) => set("role", v as Role | "")}
        />
        <Select
          id={`${idPrefix}-state`}
          label="State"
          value={value.state}
          options={STATES}
          placeholder="Pick your state"
          disabled={disabled}
          onChange={(v) => set("state", v as State | "")}
        />
      </div>

      <fieldset className="space-y-2" disabled={disabled}>
        <legend className="text-sm font-bold">
          Interests <span className="font-normal text-muted-foreground">· optional, pick any</span>
        </legend>
        <div className="flex flex-wrap gap-2 pt-1">
          {INDUSTRIES.map((industry) => {
            const on = value.interests.includes(industry);
            return (
              <button
                key={industry}
                type="button"
                aria-pressed={on}
                onClick={() => toggle(industry)}
                className={cn(
                  "pressable rounded-full border-2 px-3.5 py-1.5 text-sm font-semibold transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-60",
                  on ? "border-highlight bg-highlight text-highlight-foreground" : "border-border bg-transparent text-foreground hover:bg-muted",
                )}
              >
                {industry}
              </button>
            );
          })}
        </div>
      </fieldset>
    </div>
  );
}

function Select({
  id,
  label,
  value,
  options,
  placeholder,
  disabled,
  onChange,
}: {
  id: string;
  label: string;
  value: string;
  options: readonly string[];
  placeholder: string;
  disabled: boolean;
  onChange: (value: string) => void;
}) {
  return (
    <div className="space-y-2">
      <label htmlFor={id} className="text-sm font-bold">
        {label}
      </label>
      <div className="relative">
        <select
          id={id}
          required
          disabled={disabled}
          value={value}
          onChange={(e) => onChange(e.target.value)}
          className={cn(inputClass, "appearance-none pr-10", !value && "text-muted-foreground")}
        >
          <option value="" disabled>
            {placeholder}
          </option>
          {options.map((o) => (
            <option key={o} value={o}>
              {o}
            </option>
          ))}
        </select>
        <ChevronDown aria-hidden className="pointer-events-none absolute right-4 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
      </div>
    </div>
  );
}

/** A plain-language problem with the fields, or null when they can be saved. */
export function fieldsProblem(f: ProfileFields): string | null {
  const name = f.name.trim();
  if (name.length < 1) return "Enter your name.";
  if (name.length > 80) return "Keep your name under 80 characters.";
  if (!f.role) return "Pick what you do.";
  if (!f.state) return "Pick your state.";
  return null;
}
