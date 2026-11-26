"use client";

import * as React from "react";

/**
 * Last-resort error page: replaces the root layout when it fails, so globals.css, fonts and providers may be missing.
 * Everything here is inline and dependency-free. Dark by default (like the app); the saved light theme is honoured.
 * The thrown value is logged, never shown.
 */
const CSS = `
:root{--bg:#000;--fg:#f5f4f7;--muted:#a3a1ab;--card:#161616;--lime:#c8f35e;--ink:#111;--ring:#b9a0ff}
:root[data-theme="light"]{--bg:#f6f5f1;--fg:#111;--muted:#5d5b63;--card:#fff}
*{box-sizing:border-box}
html,body{margin:0;min-height:100%;background:var(--bg);color:var(--fg);font-family:"DM Sans",ui-sans-serif,system-ui,-apple-system,"Segoe UI",Roboto,Arial,sans-serif;-webkit-font-smoothing:antialiased}
.ge-wrap{min-height:100dvh;display:flex;align-items:center;justify-content:center;padding:24px 16px}
.ge-tile{width:100%;max-width:560px;background:var(--lime);color:var(--ink);border-radius:24px;padding:28px 24px}
.ge-tag{display:inline-block;background:var(--ink);color:#fff;border-radius:999px;padding:4px 12px;font-size:12px;font-weight:700}
.ge-tile h1{font-size:34px;line-height:1.05;margin:14px 0 0;font-weight:800;letter-spacing:-0.02em}
.ge-tile p{margin:12px 0 0;font-size:16px;line-height:1.5;opacity:.8}
.ge-row{display:flex;flex-wrap:wrap;gap:12px;margin-top:24px}
.ge-btn{appearance:none;border:2px solid var(--ink);border-radius:999px;height:52px;padding:0 24px;font:inherit;font-size:16px;font-weight:700;cursor:pointer;text-decoration:none;display:inline-flex;align-items:center;justify-content:center}
.ge-primary{background:var(--ink);color:#fff}
.ge-secondary{background:transparent;color:var(--ink)}
.ge-btn:focus-visible{outline:3px solid var(--ring);outline-offset:3px}
.ge-ref{margin-top:16px !important;font-size:12px !important;font-weight:600;word-break:break-all}
@media (min-width:768px){.ge-tile{padding:40px}.ge-tile h1{font-size:48px}}
`;

export default function GlobalError({ error, retry }: { error: unknown; retry: () => void }) {
  React.useEffect(() => {
    console.error(error);
    try {
      if (window.localStorage.getItem("ps:theme") === "light") document.documentElement.setAttribute("data-theme", "light");
    } catch {
      // Storage blocked: stay dark.
    }
  }, [error]);

  const digest =
    error && typeof error === "object" && "digest" in error && typeof (error as { digest?: unknown }).digest === "string"
      ? (error as { digest: string }).digest
      : null;

  return (
    <html lang="en">
      <head>
        <meta charSet="utf-8" />
        <meta name="viewport" content="width=device-width, initial-scale=1" />
        <title>Something went wrong · PitchSwipe</title>
        <style dangerouslySetInnerHTML={{ __html: CSS }} />
      </head>
      <body>
        <main className="ge-wrap">
          <section className="ge-tile" role="alert" aria-labelledby="ge-title">
            <span className="ge-tag">PitchSwipe</span>
            <h1 id="ge-title">Something went wrong.</h1>
            <p>PitchSwipe could not load. Try again; if it keeps happening, come back in a few minutes.</p>
            <div className="ge-row">
              <button type="button" className="ge-btn ge-primary" onClick={() => retry()}>
                Try again
              </button>
              {/* A full page load on purpose: the app shell itself failed. */}
              {/* eslint-disable-next-line @next/next/no-html-link-for-pages */}
              <a className="ge-btn ge-secondary" href="/">
                Go home
              </a>
            </div>
            {digest ? <p className="ge-ref">Reference: {digest}</p> : null}
          </section>
        </main>
      </body>
    </html>
  );
}
