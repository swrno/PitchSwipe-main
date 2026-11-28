"use client";

import * as React from "react";
import { BreadcrumbProvider } from "./breadcrumb";
import { Sidebar } from "./navigation";

const KEY = "ps:sidebar-collapsed";

/** Wraps the shell: owns the sidebar's collapsed state and publishes --sidebar-width for the layout padding. */
export function ShellFrame({ children }: { children: React.ReactNode }) {
  const [collapsed, setCollapsed] = React.useState(false);

  React.useEffect(() => {
    const id = window.setTimeout(() => {
      try {
        if (window.localStorage.getItem(KEY) === "1") setCollapsed(true);
      } catch {
        // storage unavailable: stay expanded
      }
    }, 0);
    return () => window.clearTimeout(id);
  }, []);

  const toggle = () =>
    setCollapsed((c) => {
      try {
        window.localStorage.setItem(KEY, c ? "0" : "1");
      } catch {
        // ignore
      }
      return !c;
    });

  return (
    <div
      className="min-h-app overflow-x-clip bg-background transition-[padding] duration-200 md:bg-canvas md:pl-[var(--sidebar-width)] md:pr-[var(--chat-width,0px)] [html[data-resizing]_&]:transition-none"
      style={{ ["--sidebar-width" as string]: collapsed ? "4rem" : "13.5rem" }}
    >
      <BreadcrumbProvider>
        <Sidebar collapsed={collapsed} onToggle={toggle} />
        {children}
      </BreadcrumbProvider>
    </div>
  );
}
