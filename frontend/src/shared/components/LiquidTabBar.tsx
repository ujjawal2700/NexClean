import { useCallback, useEffect, useLayoutEffect, useRef, useState, type ComponentType } from "react";
import { Link, useLocation, useNavigate } from "react-router-dom";
import {
  animate,
  motion,
  useMotionValue,
  useReducedMotion,
  useSpring,
  useTransform,
  useVelocity,
} from "motion/react";
import { Lock } from "lucide-react";
import { cn } from "@shared/lib/utils";

export type LiquidTab = {
  to: string;
  label: string;
  icon: ComponentType<{ className?: string; strokeWidth?: number }>;
  /** Match the path exactly (for an index route like "/app"). */
  end?: boolean;
  /** Shown with a lock; pressing it calls onLockedPress instead of navigating. */
  locked?: boolean;
};

/** The pill's glide between tabs — soft enough to read as liquid, quick enough not to lag. */
const GLIDE = { type: "spring", stiffness: 420, damping: 34, mass: 0.8 } as const;
/** How far a press may wander before it counts as a drag rather than a tap. */
const DRAG_SLOP_PX = 4;

function activeIndexFor(tabs: LiquidTab[], pathname: string): number {
  const path = pathname.replace(/\/+$/, "") || "/";
  // Longest match wins, so "/app/plans" beats "/app".
  let best = -1;
  let bestLen = -1;
  tabs.forEach((t, i) => {
    const hit = t.end ? path === t.to : path === t.to || path.startsWith(`${t.to}/`);
    if (hit && t.to.length > bestLen) {
      best = i;
      bestLen = t.to.length;
    }
  });
  return best;
}

/**
 * Mobile bottom tab bar with an iOS "liquid glass" selection pill.
 *
 * Tap a tab and the pill glides there on a spring. Press and hold the
 * highlighted tab and the pill lifts and follows your finger — stretching with
 * speed like a drop of liquid — and on release it settles on the nearest tab
 * and opens it. Long-press link previews and drag ghosts are suppressed so
 * holding a tab never pops the browser's link menu.
 */
export function LiquidTabBar({
  tabs,
  testId,
  ariaLabel,
  onLockedPress,
}: {
  tabs: LiquidTab[];
  testId: string;
  ariaLabel: string;
  onLockedPress?: (to: string) => void;
}) {
  const location = useLocation();
  const navigate = useNavigate();
  const reduceMotion = useReducedMotion();
  const activeIndex = activeIndexFor(tabs, location.pathname);

  const shellRef = useRef<HTMLDivElement>(null);
  const itemRefs = useRef<(HTMLElement | null)[]>([]);
  const [slots, setSlots] = useState<{ left: number; width: number }[]>([]);

  // Pill position (px from the shell's left edge) and width.
  const x = useMotionValue(0);
  const width = useMotionValue(0);
  const [dragging, setDragging] = useState(false);
  const [hoverIndex, setHoverIndex] = useState(activeIndex);

  // Liquid feel: the faster the pill moves, the more it stretches along the
  // motion and thins across it — volume roughly conserved, like a drop.
  const velocity = useVelocity(x);
  const smoothVelocity = useSpring(velocity, { stiffness: 300, damping: 30 });
  const stretch = useTransform(smoothVelocity, [-2400, 0, 2400], reduceMotion ? [1, 1, 1] : [1.32, 1, 1.32]);
  const squash = useTransform(stretch, (s) => 1 / Math.sqrt(s));
  const lift = useSpring(1, { stiffness: 500, damping: 28 });
  const scaleX = useTransform(() => stretch.get() * lift.get());
  const scaleY = useTransform(() => squash.get() * lift.get());

  const measure = useCallback(() => {
    const shell = shellRef.current;
    if (!shell) return;
    setSlots(
      itemRefs.current.map((el) => (el ? { left: el.offsetLeft, width: el.offsetWidth } : { left: 0, width: 0 })),
    );
  }, []);

  useLayoutEffect(() => {
    measure();
    const shell = shellRef.current;
    if (!shell || typeof ResizeObserver === "undefined") return;
    const ro = new ResizeObserver(measure);
    ro.observe(shell);
    return () => ro.disconnect();
  }, [measure, tabs.length]);

  // Glide to the active tab whenever the route changes (or on first measure, jump).
  const placed = useRef(false);
  // Tab a drag was dropped on, until the route catches up with it.
  const pendingIndex = useRef<number | null>(null);
  useEffect(() => {
    const slot = slots[activeIndex];
    if (!slot || dragging) return;
    // The router can apply the navigation a beat after the drag ends; don't
    // glide back to the old tab in between, only to glide forward again.
    if (pendingIndex.current !== null && pendingIndex.current !== activeIndex) return;
    pendingIndex.current = null;
    setHoverIndex(activeIndex);
    if (!placed.current || reduceMotion) {
      x.jump(slot.left);
      width.jump(slot.width);
      placed.current = true;
      return;
    }
    // Re-measuring (e.g. on resize) shouldn't restart a glide that has nowhere to go.
    if (Math.abs(x.get() - slot.left) < 0.5 && Math.abs(width.get() - slot.width) < 0.5) return;
    animate(x, slot.left, GLIDE);
    animate(width, slot.width, GLIDE);
  }, [activeIndex, slots, dragging, reduceMotion, x, width]);

  /* ── press-and-drag the highlighted tab ───────────────────────────── */
  const drag = useRef<{ id: number; startX: number; originLeft: number; moved: boolean } | null>(null);
  const suppressClick = useRef(false);

  const nearestIndex = (left: number) => {
    let best = 0;
    let bestDist = Infinity;
    slots.forEach((s, i) => {
      const d = Math.abs(s.left - left);
      if (d < bestDist) {
        best = i;
        bestDist = d;
      }
    });
    return best;
  };

  const onPointerDown = (e: React.PointerEvent, index: number) => {
    if (index !== activeIndex || !slots[index]) return;
    if (e.pointerType === "mouse" && e.button !== 0) return;
    drag.current = { id: e.pointerId, startX: e.clientX, originLeft: x.get(), moved: false };
  };

  const onPointerMove = (e: React.PointerEvent) => {
    const d = drag.current;
    if (!d || e.pointerId !== d.id) return;
    const dx = e.clientX - d.startX;
    if (!d.moved) {
      if (Math.abs(dx) < DRAG_SLOP_PX) return;
      d.moved = true;
      // A glide still in flight would keep pulling the pill back to its old tab
      // every frame — set() doesn't cancel a running animation, stop() does.
      x.stop();
      width.stop();
      setDragging(true);
      lift.set(reduceMotion ? 1 : 1.12);
      shellRef.current?.setPointerCapture(e.pointerId);
    }
    const first = slots[0]?.left ?? 0;
    const last = slots[slots.length - 1]?.left ?? 0;
    // Rubber-band past the ends instead of a hard stop.
    let next = d.originLeft + dx;
    if (next < first) next = first - Math.sqrt(first - next) * 3;
    if (next > last) next = last + Math.sqrt(next - last) * 3;
    x.set(next);
    const i = nearestIndex(next);
    setHoverIndex(i);
    if (slots[i]) width.set(slots[i].width);
  };

  const endDrag = (e: React.PointerEvent) => {
    const d = drag.current;
    if (!d || e.pointerId !== d.id) return;
    drag.current = null;
    if (!d.moved) return; // a plain tap — let the link handle it
    suppressClick.current = true;
    setDragging(false);
    lift.set(1);
    const i = nearestIndex(x.get());
    const slot = slots[i];
    if (slot) {
      animate(x, slot.left, GLIDE);
      animate(width, slot.width, GLIDE);
    }
    const tab = tabs[i];
    if (!tab || i === activeIndex) return;
    if (tab.locked) {
      onLockedPress?.(tab.to);
      return;
    }
    pendingIndex.current = i;
    navigate(tab.to);
  };

  return (
    <nav
      data-testid={testId}
      aria-label={ariaLabel}
      className="mobile-bottom-nav fixed inset-x-0 bottom-0 z-30 md:hidden"
    >
      <motion.div
        ref={shellRef}
        className="mobile-bottom-nav-shell no-callout mx-auto flex max-w-md items-center justify-around"
        initial={{ opacity: 0, scale: 0.96 }}
        animate={{ opacity: 1, scale: 1 }}
        transition={{ type: "spring", stiffness: 340, damping: 28, mass: 0.75 }}
        onPointerMove={onPointerMove}
        onPointerUp={endDrag}
        onPointerCancel={endDrag}
        onClickCapture={(e) => {
          // The click that ends a drag must not also re-open the tab it started on.
          if (suppressClick.current) {
            suppressClick.current = false;
            e.preventDefault();
            e.stopPropagation();
          }
        }}
        onContextMenu={(e) => e.preventDefault()}
      >
        {activeIndex >= 0 && (
          <motion.span
            aria-hidden
            data-testid={`${testId}-pill`}
            className={cn("mobile-bottom-nav-active liquid-pill absolute", dragging && "is-dragging")}
            style={{
              left: 0,
              top: "0.375rem",
              bottom: "0.375rem",
              x,
              width,
              scaleX,
              scaleY,
            }}
          />
        )}

        {tabs.map((tab, i) => {
          const highlighted = i === (dragging ? hoverIndex : activeIndex);
          const content = (
            <motion.span
              className="relative z-10 flex w-full flex-col items-center gap-1 py-2"
              whileTap={dragging ? undefined : { scale: 0.9 }}
              animate={{ scale: dragging && highlighted ? 1.08 : 1 }}
              transition={{ type: "spring", stiffness: 500, damping: 30 }}
            >
              <span className="relative">
                <tab.icon className="size-5" strokeWidth={highlighted ? 2.35 : 2} />
                {tab.locked && <Lock className="absolute -right-1.5 -top-1 size-2.5" />}
              </span>
              {tab.label}
            </motion.span>
          );
          const className = cn(
            "mobile-bottom-nav-item relative flex flex-1 items-stretch justify-stretch rounded-2xl text-[10px] font-medium",
            highlighted ? "text-primary" : "text-muted",
            i === activeIndex && "touch-none",
          );
          const shared = {
            ref: (el: HTMLElement | null) => {
              itemRefs.current[i] = el;
            },
            className,
            draggable: false,
            onPointerDown: (e: React.PointerEvent) => onPointerDown(e, i),
          };
          return tab.locked ? (
            <button
              key={tab.to}
              type="button"
              {...shared}
              onClick={() => onLockedPress?.(tab.to)}
              aria-label={`${tab.label} — login required`}
            >
              {content}
            </button>
          ) : (
            <Link key={tab.to} to={tab.to} {...shared} aria-current={i === activeIndex ? "page" : undefined}>
              {content}
            </Link>
          );
        })}
      </motion.div>
    </nav>
  );
}
