"use client";

import * as React from "react";
import { animate, useReducedMotion } from "framer-motion";
import { formatRs } from "@/lib/utils";

/**
 * A rupee amount that counts from its old value to its new one when it changes, and always ends on the
 * exact value it was given. The first value shows as is (nothing to count from), and reduced motion
 * shows every change at once. Pair with the `tnum` class so the digits do not jiggle while counting.
 */
export function AnimatedAmount({ value, className }: { value: number; className?: string }) {
  const reduce = useReducedMotion();
  const [shown, setShown] = React.useState(value);
  const from = React.useRef(value);

  React.useEffect(() => {
    const start = from.current;
    from.current = value;
    if (reduce || start === value) {
      setShown(value);
      return;
    }
    const controls = animate(start, value, {
      duration: 0.6,
      ease: [0.22, 1, 0.36, 1],
      onUpdate: (v) => setShown(Math.round(v * 100) / 100),
      onComplete: () => setShown(value),
    });
    return () => controls.stop();
  }, [value, reduce]);

  return <span className={className}>{formatRs(shown)}</span>;
}
