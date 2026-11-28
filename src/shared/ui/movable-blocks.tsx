"use client";

import * as React from "react";
import { GripVertical } from "lucide-react";
import { Reorder, useDragControls, useReducedMotion } from "framer-motion";

import { cn } from "@/shared/lib/utils";

export type MovableBlock = { id: string; label: string; node: React.ReactNode; /** Extra classes on the draggable wrapper (e.g. hide on phone). */ className?: string };

/** Saved ids that still exist, in saved order; anything new keeps its default place at the end. */
function mergeOrder(saved: unknown, defaults: string[]): string[] {
  const known = Array.isArray(saved)
    ? saved.filter(
        (x): x is string => typeof x === "string" && defaults.includes(x),
      )
    : [];
  const unique = known.filter((x, i) => known.indexOf(x) === i);
  return [...unique, ...defaults.filter((x) => !unique.includes(x))];
}

function Block({
  block,
  index,
  total,
  onMove,
}: {
  block: MovableBlock;
  index: number;
  total: number;
  onMove: (id: string, delta: number) => void;
}) {
  const controls = useDragControls();
  const reduced = useReducedMotion();
  return (
    <Reorder.Item
      value={block.id}
      as="div"
      dragListener={false}
      dragControls={controls}
      transition={reduced ? { duration: 0 } : undefined}
      whileDrag={reduced ? undefined : { scale: 1.01, zIndex: 10 }}
      className={cn("group/block relative", block.className)}
    >
      <button
        type="button"
        data-block-handle={block.id}
        aria-label={`Move ${block.label}`}
        title={`Move ${block.label} (drag, or Alt+Arrow Up/Down)`}
        onPointerDown={(e) => {
          e.preventDefault();
          controls.start(e);
        }}
        onKeyDown={(e) => {
          if (e.key === "ArrowUp" || e.key === "ArrowDown") {
            e.preventDefault();
            onMove(block.id, e.key === "ArrowUp" ? -1 : 1);
          }
        }}
        className={cn(
          "absolute right-2 top-2 z-20 flex size-7 cursor-grab touch-none items-center justify-center rounded-md border border-border bg-card text-muted-foreground opacity-0 transition-opacity active:cursor-grabbing",
          "group-hover/block:opacity-100 focus-visible:opacity-100 focus-visible:text-accent focus-visible:outline-2 focus-visible:outline-accent [@media(hover:none)]:opacity-100",
        )}
      >
        <GripVertical className="size-4" aria-hidden />
      </button>
      <span className="sr-only">{`Block ${index + 1} of ${total}`}</span>
      {block.node}
    </Reorder.Item>
  );
}

/** Draggable stack of page blocks. The order is remembered in localStorage and only read after mount. */
export function MovableBlocks({
  blocks,
  storageKey,
  groupClassName,
}: {
  blocks: MovableBlock[];
  storageKey: string;
  /** Classes for the list wrapper; default is a single spaced column. */
  groupClassName?: string;
}) {
  const defaults = blocks.map((b) => b.id);
  const key = defaults.join("|");
  const [order, setOrder] = React.useState<string[]>(defaults);
  const [ready, setReady] = React.useState(false);
  const [announce, setAnnounce] = React.useState("");
  const refocus = React.useRef<string | null>(null);
  const byId = new Map(blocks.map((b) => [b.id, b]));

  React.useEffect(() => {
    let saved: unknown = null;
    try {
      saved = JSON.parse(localStorage.getItem(storageKey) ?? "null");
    } catch {}
    // Read after mount so server and first client render match.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setOrder(mergeOrder(saved, key.split("|")));
    setReady(true);
  }, [key, storageKey]);

  const current = mergeOrder(order, defaults);
  const save = (next: string[]) => {
    setOrder(next);
    try {
      localStorage.setItem(storageKey, JSON.stringify(next));
    } catch {}
  };
  const move = (id: string, delta: number) => {
    const from = current.indexOf(id);
    const to = from + delta;
    if (to < 0 || to >= current.length) return;
    const next = [...current];
    next.splice(to, 0, next.splice(from, 1)[0]);
    refocus.current = id;
    save(next);
    setAnnounce(
      `${byId.get(id)?.label} moved to position ${to + 1} of ${next.length}`,
    );
  };
  React.useEffect(() => {
    const id = refocus.current;
    if (!id) return;
    refocus.current = null;
    document.querySelector<HTMLElement>(`[data-block-handle="${id}"]`)?.focus();
  });

  const changed = ready && current.some((id, i) => id !== defaults[i]);
  return (
    <div className="space-y-5 md:space-y-6">
      {changed && (
        <div className="flex justify-end">
          <button
            type="button"
            onClick={() => {
              save(defaults);
              setAnnounce("Layout reset to default");
            }}
            className="text-sm text-muted-foreground underline-offset-4 hover:text-foreground hover:underline"
          >
            Reset layout
          </button>
        </div>
      )}
      <Reorder.Group
        as="div"
        axis="y"
        values={current}
        onReorder={(next: string[]) => save(next)}
        className={groupClassName ?? "space-y-5 md:space-y-6"}
      >
        {current.map((id, i) => (
          <Block
            key={id}
            block={byId.get(id)!}
            index={i}
            total={current.length}
            onMove={move}
          />
        ))}
      </Reorder.Group>
      <div aria-live="polite" role="status" className="sr-only">
        {announce}
      </div>
    </div>
  );
}
