"use client";

import * as React from "react";

/**
 * The landing page's only motion script. Renders nothing; it
 *  - turns on the scroll reveal (globals.css: html.reveal-ready) and marks [data-reveal] elements data-shown as they
 *    enter the viewport (once each);
 *  - moves [data-parallax] elements with the scroll (data-parallax = pixels of travel over one viewport height).
 * With reduced motion it does neither, so everything stays in place and visible.
 */
export function LandingMotion() {
  React.useEffect(() => {
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;
    const root = document.documentElement;

    const revealables = Array.from(document.querySelectorAll<HTMLElement>("[data-reveal]"));
    // Anything already on screen at load shows at once (no flash of hidden content above the fold).
    const inView = (el: HTMLElement) => {
      const r = el.getBoundingClientRect();
      return r.top < window.innerHeight * 0.92 && r.bottom > 0;
    };
    root.classList.add("reveal-ready");
    const observer = new IntersectionObserver(
      (entries) => {
        for (const entry of entries) {
          if (!entry.isIntersecting) continue;
          entry.target.setAttribute("data-shown", "");
          observer.unobserve(entry.target);
        }
      },
      { rootMargin: "0px 0px -8% 0px", threshold: 0.12 },
    );
    for (const el of revealables) {
      if (inView(el)) el.setAttribute("data-shown", "");
      else observer.observe(el);
    }

    const movers = Array.from(document.querySelectorAll<HTMLElement>("[data-parallax]"));
    let frame = 0;
    const move = () => {
      frame = 0;
      const vh = window.innerHeight;
      for (const el of movers) {
        const travel = Number(el.dataset.parallax) || 0;
        const r = el.getBoundingClientRect();
        // -1 when the element's centre is a viewport below the centre of the screen, +1 a viewport above it.
        const p = Math.max(-1, Math.min(1, (vh / 2 - (r.top + r.height / 2)) / vh));
        el.style.transform = `translate3d(0, ${(-p * travel).toFixed(1)}px, 0)`;
      }
    };
    const onScroll = () => {
      if (!frame) frame = requestAnimationFrame(move);
    };
    if (movers.length) {
      move();
      window.addEventListener("scroll", onScroll, { passive: true });
      window.addEventListener("resize", onScroll);
    }

    return () => {
      observer.disconnect();
      window.removeEventListener("scroll", onScroll);
      window.removeEventListener("resize", onScroll);
      if (frame) cancelAnimationFrame(frame);
      root.classList.remove("reveal-ready");
    };
  }, []);
  return null;
}
