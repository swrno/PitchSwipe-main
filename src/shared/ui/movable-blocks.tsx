"use client";

import * as React from "react";
import { GripVertical } from "lucide-react";
import {
  closestCenter,
  DndContext,
  DragOverlay,
  KeyboardSensor,
  MouseSensor,
  TouchSensor,
  useSensor,
  useSensors,
  type Announcements,
  type DragEndEvent,
  type DragStartEvent,
} from "@dnd-kit/core";
import {
  arrayMove,
  rectSortingStrategy,
  SortableContext,
  sortableKeyboardCoordinates,
  useSortable,
} from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";

import { cn } from "@/shared/lib/utils";

/** Width on the 4-column grid from md up; on phones every card is full width. */
export type MovableSize = "full" | "half" | "quarter";

export type MovableBlock = {
  id: string;
  label: string;
  node: React.ReactNode;
  /** Default "full". */
  size?: MovableSize;
  /** Extra classes on the card wrapper (e.g. hide on phone). */
  className?: string;
};

const SPAN: Record<MovableSize, string> = {
  full: "md:col-span-4",
  half: "md:col-span-2",
  quarter: "md:col-span-1",
};

/** Saved ids that still exist, in saved order; anything new keeps its default place at the end. */
function mergeOrder(saved: unknown, defaults: string[]): string[] {
  const known = Array.isArray(saved)
    ? saved.filter((x): x is string => typeof x === "string" && defaults.includes(x))
    : [];
  const unique = known.filter((x, i) => known.indexOf(x) === i);
  return [...unique, ...defaults.filter((x) => !unique.includes(x))];
}

function usePrefersReducedMotion() {
  const [reduced, setReduced] = React.useState(false);
  React.useEffect(() => {
    const mq = window.matchMedia("(prefers-reduced-motion: reduce)");
    const sync = () => setReduced(mq.matches);
    sync();
    mq.addEventListener("change", sync);
    return () => mq.removeEventListener("change", sync);
  }, []);
  return reduced;
}

function Card({
  block,
  reduced,
}: {
  block: MovableBlock;
  reduced: boolean;
}) {
  const { attributes, listeners, setNodeRef, setActivatorNodeRef, transform, transition, isDragging } =
    useSortable({ id: block.id });
  return (
    <div
      ref={setNodeRef}
      style={{
        transform: CSS.Translate.toString(transform),
        transition: reduced ? undefined : transition,
      }}
      className={cn(
        "group/block relative min-w-0",
        SPAN[block.size ?? "full"],
        isDragging && "opacity-40",
        block.className,
      )}
    >
      <button
        type="button"
        ref={setActivatorNodeRef}
        {...attributes}
        {...listeners}
        data-block-handle={block.id}
        aria-label={`Move ${block.label}`}
        title={`Move ${block.label} (drag, or press Space then arrow keys)`}
        className={cn(
          "absolute right-2 top-2 z-20 flex size-7 cursor-grab touch-none items-center justify-center rounded-md border border-border bg-card text-muted-foreground opacity-0 transition-opacity active:cursor-grabbing",
          "group-hover/block:opacity-100 focus-visible:opacity-100 focus-visible:text-accent focus-visible:outline-2 focus-visible:outline-accent [@media(hover:none)]:opacity-100",
        )}
      >
        <GripVertical className="size-4" aria-hidden />
      </button>
      {block.node}
    </div>
  );
}

/**
 * Sortable grid of page cards: each card moves on its own. The order is remembered in
 * localStorage (read after mount so server and first client render match).
 */
export function MovableBlocks({
  blocks,
  storageKey,
  groupClassName,
}: {
  blocks: MovableBlock[];
  storageKey: string;
  /** Replaces the default grid classes. */
  groupClassName?: string;
}) {
  const defaults = blocks.map((b) => b.id);
  const key = defaults.join("|");
  const [order, setOrder] = React.useState<string[]>(defaults);
  const [ready, setReady] = React.useState(false);
  const [announce, setAnnounce] = React.useState("");
  const [activeId, setActiveId] = React.useState<string | null>(null);
  const reduced = usePrefersReducedMotion();
  const dndId = React.useId();
  const byId = new Map(blocks.map((b) => [b.id, b]));
  const label = (id: unknown) => byId.get(String(id))?.label ?? "card";

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

  const sensors = useSensors(
    useSensor(MouseSensor, { activationConstraint: { distance: 6 } }),
    useSensor(TouchSensor, { activationConstraint: { delay: 120, tolerance: 8 } }),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates }),
  );

  const pos = (id: unknown) => `position ${current.indexOf(String(id)) + 1} of ${current.length}`;
  const announcements: Announcements = {
    onDragStart: ({ active }) => `Picked up ${label(active.id)}, ${pos(active.id)}.`,
    onDragOver: ({ active, over }) =>
      over ? `${label(active.id)} is over ${label(over.id)}, ${pos(over.id)}.` : undefined,
    onDragEnd: ({ active, over }) =>
      over ? `${label(active.id)} dropped at ${pos(over.id)}.` : `${label(active.id)} dropped where it was.`,
    onDragCancel: ({ active }) => `Move cancelled. ${label(active.id)} returned to ${pos(active.id)}.`,
  };

  const onDragStart = (e: DragStartEvent) => setActiveId(String(e.active.id));
  const onDragEnd = (e: DragEndEvent) => {
    setActiveId(null);
    const { active, over } = e;
    if (!over || active.id === over.id) return;
    const from = current.indexOf(String(active.id));
    const to = current.indexOf(String(over.id));
    if (from < 0 || to < 0) return;
    save(arrayMove(current, from, to));
    requestAnimationFrame(() =>
      document.querySelector<HTMLElement>(`[data-block-handle="${String(active.id)}"]`)?.focus(),
    );
  };

  const changed = ready && current.some((id, i) => id !== defaults[i]);
  const active = activeId ? byId.get(activeId) : undefined;
  return (
    <div className="space-y-4">
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
      <DndContext
        id={dndId}
        sensors={sensors}
        collisionDetection={closestCenter}
        accessibility={{ announcements }}
        onDragStart={onDragStart}
        onDragEnd={onDragEnd}
        onDragCancel={() => setActiveId(null)}
      >
        <SortableContext items={current} strategy={rectSortingStrategy}>
          <div className={groupClassName ?? "grid grid-cols-1 gap-3 md:grid-cols-4 md:gap-4"}>
            {current.map((id) => (
              <Card key={id} block={byId.get(id)!} reduced={reduced} />
            ))}
          </div>
        </SortableContext>
        <DragOverlay dropAnimation={reduced ? null : undefined}>
          {active ? (
            <div className="cursor-grabbing rounded-2xl shadow-lg ring-2 ring-accent/40">{active.node}</div>
          ) : null}
        </DragOverlay>
      </DndContext>
      <div aria-live="polite" role="status" className="sr-only">
        {announce}
      </div>
    </div>
  );
}
