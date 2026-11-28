"use client";

import * as React from "react";
import { Moon, Sun } from "lucide-react";
import { haptic } from "@/shared/lib/feel/haptics";
import { applyTheme, readTheme, type Theme } from "@/shared/lib/feel/theme";
import { cn } from "@/shared/lib/utils";

function useTheme(): Theme {
  return React.useSyncExternalStore(
    (notify) => {
      window.addEventListener("ps:theme", notify);
      return () => window.removeEventListener("ps:theme", notify);
    },
    readTheme,
    () => "dark",
  );
}

/** Round button that flips dark / light. `label` shows the target theme's name next to the icon. */
export function ThemeToggle({ className, label = false }: { className?: string; label?: boolean }) {
  const theme = useTheme();
  const next: Theme = theme === "dark" ? "light" : "dark";
  return (
    <button
      type="button"
      onClick={() => {
        haptic("select");
        applyTheme(next);
      }}
      aria-label={`Switch to ${next} mode`}
      className={cn(
        "pressable inline-flex h-10 items-center justify-center gap-2 rounded-full bg-secondary text-sm font-semibold text-secondary-foreground transition-colors hover:bg-muted",
        label ? "px-4" : "w-10",
        className,
      )}
    >
      {theme === "dark" ? <Sun aria-hidden className="size-4" /> : <Moon aria-hidden className="size-4" />}
      {label ? <span>{next === "light" ? "Light mode" : "Dark mode"}</span> : null}
    </button>
  );
}
