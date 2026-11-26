"use client";

import { useEffect } from "react";

/** Registers /sw.js in production on secure origins (or localhost). Renders nothing. */
export function RegisterSW() {
  useEffect(() => {
    if (process.env.NODE_ENV !== "production") return;
    if (!("serviceWorker" in navigator)) return;
    const { protocol, hostname } = window.location;
    const local = hostname === "localhost" || hostname === "127.0.0.1" || hostname === "[::1]";
    if (protocol !== "https:" && !local) return;
    navigator.serviceWorker.register("/sw.js", { scope: "/" }).catch(() => {
      /* registration is best-effort */
    });
  }, []);
  return null;
}
