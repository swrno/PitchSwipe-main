"use client";

import * as React from "react";
import { syncSystemBars } from "@/lib/feel/theme";

/** Once on start: the Android status-bar icons follow the saved theme (the boot script already set the page). */
export function ThemeSync() {
  React.useEffect(() => syncSystemBars(), []);
  return null;
}
