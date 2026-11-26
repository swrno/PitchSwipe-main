"use client";

import * as React from "react";
import { Moon, Sun, Vibrate } from "lucide-react";
import { Segmented } from "@/components/decks/segmented";
import { haptic, hapticsEnabled, hapticsSupported, setHapticsEnabled } from "@/lib/feel/haptics";
import { applyTheme, readTheme, type Theme } from "@/lib/feel/theme";

/** Theme and haptics, kept in this browser (not in the account). Shown on the Profile screen. */
export function Preferences() {
  const [theme, setTheme] = React.useState<Theme>("dark");
  const [buzz, setBuzz] = React.useState<"on" | "off">("on");
  const [canBuzz, setCanBuzz] = React.useState(false);

  // Read the browser's state after mount (the server renders the defaults).
  React.useEffect(() => {
    /* eslint-disable react-hooks/set-state-in-effect -- one read of browser-only state after hydration */
    setTheme(readTheme());
    setBuzz(hapticsEnabled() ? "on" : "off");
    setCanBuzz(hapticsSupported());
    /* eslint-enable react-hooks/set-state-in-effect */
  }, []);

  return (
    <section aria-labelledby="prefs" className="space-y-4 rounded-3xl bg-card p-5 md:p-6">
      <h2 id="prefs" className="text-xl">
        Appearance and feel
      </h2>
      <div className="space-y-2">
        <p className="flex items-center gap-2 text-sm font-bold">
          {theme === "dark" ? <Moon aria-hidden className="size-4" /> : <Sun aria-hidden className="size-4" />} Theme
        </p>
        <Segmented<Theme>
          label="Theme"
          value={theme}
          options={[
            { value: "dark", label: "Dark" },
            { value: "light", label: "Light" },
          ]}
          onChange={(t) => {
            setTheme(t);
            applyTheme(t);
          }}
        />
      </div>
      {canBuzz ? (
        <div className="space-y-2">
          <p className="flex items-center gap-2 text-sm font-bold">
            <Vibrate aria-hidden className="size-4" /> Haptics
          </p>
          <Segmented<"on" | "off">
            label="Haptics"
            value={buzz}
            options={[
              { value: "on", label: "On" },
              { value: "off", label: "Off" },
            ]}
            onChange={(v) => {
              setBuzz(v);
              setHapticsEnabled(v === "on");
              if (v === "on") haptic("success");
            }}
          />
          <p className="text-xs text-muted-foreground">Short taps when you swipe, answer and claim. Saved on this device.</p>
        </div>
      ) : null}
    </section>
  );
}
