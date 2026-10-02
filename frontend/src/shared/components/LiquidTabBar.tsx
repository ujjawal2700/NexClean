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

/**
 * The pill's glide between tabs. Under-damped on purpose: it overshoots the tab
 * a little and settles back, like a drop of liquid that has momentum.
 */
// Damping ratio ≈ 0.68 → about a 5–6% overshoot, close to iOS tab-bar springs.
const GLIDE = { type: "spring", stiffness: 320, damping: 23, mass: 0.9 } as const;
/** Same move with Reduce Motion on: no overshoot, no hop. */
const GLIDE_CALM = { type: "spring", stiffness: 500, damping: 45 } as const;
/** How far the pill reaches past its tab on each side, so it sits on the bar rather than in it. */
const BLEED_X = 4;
/** How far a press may wander before it counts as a drag rather than a tap. */
const DRAG_SLOP_PX = 4;

/** How much the glass magnifies what's under it, at its centre and at its rim. */
const LENS_ZOOM = 1.22;
const RIM_ZOOM = 1.42;

/**
 * A tab's icon and label. Drawn twice: in the bar itself, and magnified inside
 * the glass pill — one definition keeps the two exactly aligned.
 */
function tabFace(tab: LiquidTab, highlighted: boolean, inLens = false) {
  const face = (
    <>
      <span className="relative">
        <tab.icon className="size-5" strokeWidth={highlighted ? 2.35 : 2} />
        {tab.locked && <Lock className="absolute -right-1.5 -top-1 size-2.5" />}
      </span>
      {tab.label}
    </>
  );
  if (!inLens) return face;
  return (
    <span className={cn("liquid-face relative flex w-full flex-col items-center gap-1 py-2", highlighted ? "text-primary" : "text-muted")}>
      {face}
    </span>
  );
}

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
  slideTransition = false,
}: {
  tabs: LiquidTab[];
  testId: string;
  ariaLabel: string;
  onLockedPress?: (to: string) => void;
  /** Slide the whole bar in/out when its parent mounts or removes it. */
  slideTransition?: boolean;
}) {
  const location = useLocation();
  const navigate = useNavigate();
  const reduceMotion = useReducedMotion();
  const activeIndex = activeIndexFor(tabs, location.pathname);

  const shellRef = useRef<HTMLDivElement>(null);
  const itemRefs = useRef<(HTMLElement | null)[]>([]);
  const [slots, setSlots] = useState<{ left: number; width: number }[]>([]);
  const [shellBox, setShellBox] = useState({ width: 0, height: 0 });

  // Pill position (px from the shell's left edge) and width.
  const x = useMotionValue(0);
  const width = useMotionValue(0);
  const [dragging, setDragging] = useState(false);
  const [hoverIndex, setHoverIndex] = useState(activeIndex);

  // Liquid feel: the faster the pill moves, the more it stretches along the
  // motion and thins across it — volume roughly conserved, like a drop.
  // The stretch spring is a little loose, so a fast move ends with a short
  // jelly wobble instead of snapping straight back to round.
  const velocity = useVelocity(x);
  const smoothVelocity = useSpring(velocity, { stiffness: 420, damping: 20 });
  const stretch = useTransform(smoothVelocity, [-2200, 0, 2200], reduceMotion ? [1, 1, 1] : [1.4, 1, 1.4]);
  const squash = useTransform(stretch, (s) => 1 / Math.sqrt(s));
  // Press: squish in. Drag: pop up and grow. Release: bounce back down.
  const lift = useSpring(1, { stiffness: 460, damping: 13 });
  const liftY = useSpring(0, { stiffness: 380, damping: 15 });
  // While gliding it rises off the bar a touch with speed, then lands.
  const hop = useTransform(smoothVelocity, (v) => (reduceMotion ? 0 : -Math.min(5, Math.abs(v) / 450)));
  const scaleX = useTransform(() => stretch.get() * lift.get());
  const scaleY = useTransform(() => squash.get() * lift.get());
  const y = useTransform(() => hop.get() + liftY.get());
  // The lens holds a copy of the tab row, moved opposite to the pill so the
  // copy stays lined up with the real row underneath while the pill travels.
  const lensX = useTransform(x, (v) => -v);
  const lensY = useTransform(y, (v) => -v);

  /** One magnified copy of the tab row, kept aligned under the moving pill. */
  const lensLayer = (zoom: number, className: string) => (
    <span className={cn("liquid-lens-zoom", className)} style={{ transform: `scale(${zoom})` }}>
      <motion.span className="liquid-lens-row" style={{ width: shellBox.width, height: shellBox.height, x: lensX, y: lensY }}>
        {tabs.map((tab, i) => (
          <span
            key={tab.to}
            className="mobile-bottom-nav-item relative flex flex-1 items-stretch justify-stretch rounded-2xl text-[10px] font-medium"
          >
            {tabFace(tab, i === (dragging ? hoverIndex : activeIndex), true)}
          </span>
        ))}
      </motion.span>
    </span>
  );

  const pillX = (slot: { left: number }) => slot.left - BLEED_X;
  const pillW = (slot: { width: number }) => slot.width + BLEED_X * 2;

  const measure = useCallback(() => {
    const shell = shellRef.current;
    if (!shell) return;
    setSlots(
      itemRefs.current.map((el) => (el ? { left: el.offsetLeft, width: el.offsetWidth } : { left: 0, width: 0 })),
    );
    setShellBox({ width: shell.clientWidth, height: shell.clientHeight });
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
    if (!placed.current) {
      x.jump(pillX(slot));
      width.jump(pillW(slot));
      placed.current = true;
      return;
    }
    // Re-measuring (e.g. on resize) shouldn't restart a glide that has nowhere to go.
    if (Math.abs(x.get() - pillX(slot)) < 0.5 && Math.abs(width.get() - pillW(slot)) < 0.5) return;
    animate(x, pillX(slot), reduceMotion ? GLIDE_CALM : GLIDE);
    animate(width, pillW(slot), reduceMotion ? GLIDE_CALM : GLIDE);
  }, [activeIndex, slots, dragging, reduceMotion, x, width]);

  /* ── press-and-drag the highlighted tab ───────────────────────────── */
  const drag = useRef<{ id: number; startX: number; originLeft: number; moved: boolean } | null>(null);
  const suppressClick = useRef(false);

  const nearestIndex = (left: number) => {
    let best = 0;
    let bestDist = Infinity;
    slots.forEach((s, i) => {
      const d = Math.abs(pillX(s) - left);
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
    if (!reduceMotion) lift.set(0.93); // pressed in
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
      if (!reduceMotion) {
        lift.set(1.16); // picked up: grows and rises off the bar
        liftY.set(-5);
      }
      shellRef.current?.setPointerCapture(e.pointerId);
    }
    const first = slots[0] ? pillX(slots[0]) : 0;
    const last = slots[slots.length - 1] ? pillX(slots[slots.length - 1]) : 0;
    // Rubber-band past the ends instead of a hard stop.
    let next = d.originLeft + dx;
    if (next < first) next = first - Math.sqrt(first - next) * 3;
    if (next > last) next = last + Math.sqrt(next - last) * 3;
    x.set(next);
    const i = nearestIndex(next);
    setHoverIndex(i);
    if (slots[i]) width.set(pillW(slots[i]));
  };

  const endDrag = (e: React.PointerEvent) => {
    const d = drag.current;
    if (!d || e.pointerId !== d.id) return;
    drag.current = null;
    // Let go: springs back to size and drops onto the bar with a bounce.
    lift.set(1);
    liftY.set(0);
    if (!d.moved) return; // a plain tap — let the link handle it
    suppressClick.current = true;
    setDragging(false);
    const i = nearestIndex(x.get());
    const slot = slots[i];
    if (slot) {
      animate(x, pillX(slot), reduceMotion ? GLIDE_CALM : GLIDE);
      animate(width, pillW(slot), reduceMotion ? GLIDE_CALM : GLIDE);
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
    <motion.nav
      data-testid={testId}
      aria-label={ariaLabel}
      className="mobile-bottom-nav fixed inset-x-0 bottom-0 z-30 md:hidden"
      initial={slideTransition ? { y: "110%" } : false}
      animate={{ y: 0 }}
      exit={slideTransition ? { y: "110%" } : undefined}
      transition={reduceMotion ? { duration: 0.12 } : { type: "spring", stiffness: 360, damping: 34 }}
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
              // Reaches past the bar's top and bottom edges: the pill rests on
              // the bar like a lens, rather than being drawn inside it.
              top: "-0.3rem",
              bottom: "-0.3rem",
              x,
              y,
              width,
              scaleX,
              scaleY,
            }}
          >
            {/* Clear glass: a magnified copy of the bar beneath. The rim layer
                magnifies harder, so content near the edge bends outward, and two
                faint tinted copies split the colour there, like real glass. */}
            <span className="liquid-lens">
              {lensLayer(LENS_ZOOM, "liquid-lens-core")}
              {lensLayer(RIM_ZOOM, "liquid-lens-rim")}
              {lensLayer(RIM_ZOOM, "liquid-lens-fringe liquid-lens-fringe-warm")}
              {lensLayer(RIM_ZOOM, "liquid-lens-fringe liquid-lens-fringe-cool")}
            </span>
            <span className="liquid-rim" />
          </motion.span>
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
              {tabFace(tab, highlighted)}
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
    </motion.nav>
  );
}
