# Prompt: Replicate NexClean Liquid Glass Bottom Navigation Bar

> **How to use this prompt:**  
> Copy and paste the entire content below into Cursor, ChatGPT, Claude, or any AI coding assistant to replicate the exact floating liquid-glass bottom navigation bar in any other web or mobile app.

---

```markdown
You are an expert mobile frontend engineer. Please implement a high-end, native-feeling "Liquid Glass" floating bottom navigation bar in our React/TypeScript web app.

This navigation bar must replicate the exact mobile experience of NexClean:
1. Full adaptation to Native Mobile Navigation:
   - When the user has Android 3-button navigation active, the bar must automatically lift up above the system buttons.
   - When the user has iOS/Android gesture/swipe navigation active, it must seat comfortably above the gesture bar using dynamic safe-area insets.
   - It must handle native back navigation (iOS edge swipe back or Android hardware back) smoothly without double-slide animation or visual jitter.
   - It must eliminate browser long-press link callouts ("Open in new tab", "Copy link") and drag ghosts on mobile.
2. Fluid Liquid-Glass Physics:
   - Under-damped spring glide with momentum overshoot (~5–6%).
   - Drag-to-switch tab interaction with rubber-banding at boundaries and pointer capture.
   - Liquid physics: stretching along the motion vector with physical volume conservation (squash = 1 / sqrt(stretch)), elevation hop, and lift squish.
   - Optical glass lens effect: dual-layer magnification core with an edge refraction rim and chromatic aberration (warm & cool fringing).
3. Theming: Use CSS variables so the color palette (primary brand color, background blur, accents, border glow) matches our app's theme.

Below are the exact packages, HTML configurations, utility scripts, CSS, and React component code required.

---

### Step 1: Install Required Dependencies

Install the following packages:
```bash
npm install motion clsx tailwind-merge lucide-react react-router-dom
```
*(Note: If your project uses `framer-motion` instead of `motion`, replace `import ... from "motion/react"` with `import ... from "framer-motion"`).*

---

### Step 2: Configure HTML Viewport (`index.html`)

Crucial: To enable `env(safe-area-inset-bottom)` to properly detect Android 3-button navigation bars and iOS home bars in edge-to-edge mode, ensure your `<meta name="viewport">` includes `viewport-fit=cover`:

```html
<meta
  name="viewport"
  content="width=device-width, initial-scale=1.0, maximum-scale=1.0, user-scalable=no, viewport-fit=cover"
/>
```

---

### Step 3: Native Mobile Utilities

Create the following two utilities to handle native OS navigation events and touch interactions:

#### A. Native Back Navigation Detector (`src/shared/lib/nativeBack.ts`)
*Detects whether a history POP came from the OS (edge swipe or hardware button) or an in-app button tap. This prevents re-animating/jittering an entrance when the OS already rendered the transition.*

```typescript
const IN_APP_WINDOW_MS = 800;

let lastInteraction = -Infinity;
let lastPopWasNative = false;
let installed = false;

export function installNativeBackDetection() {
  if (installed || typeof window === "undefined") return;
  installed = true;
  const mark = () => {
    lastInteraction = performance.now();
  };
  window.addEventListener("click", mark, true);
  window.addEventListener("keydown", mark, true);

  window.addEventListener(
    "popstate",
    (e) => {
      // Set by Safari 18+ / Chrome 123+ when the browser has already animated the page back
      const uaTransition = (e as PopStateEvent & { hasUAVisualTransition?: boolean }).hasUAVisualTransition;
      lastPopWasNative = uaTransition === true || performance.now() - lastInteraction > IN_APP_WINDOW_MS;
    },
    true,
  );
}

export function wasNativeBack() {
  return lastPopWasNative;
}
```

#### B. Touch Callout & Drag Ghost Blocker (`src/shared/lib/noLongPressMenus.ts`)
*Prevents mobile browsers from opening context menus on long-press while dragging tabs.*

```typescript
const INTERACTIVE = 'a, button, img, [role="button"]';

export function installNoLongPressMenus(): void {
  if (typeof window === "undefined") return;
  const touch = window.matchMedia?.("(pointer: coarse)");
  const onContextMenu = (e: Event) => {
    if (!touch?.matches) return;
    if ((e.target as Element | null)?.closest?.(INTERACTIVE)) e.preventDefault();
  };
  const onDragStart = (e: DragEvent) => {
    if ((e.target as Element | null)?.closest?.("a, img")) e.preventDefault();
  };
  document.addEventListener("contextmenu", onContextMenu);
  document.addEventListener("dragstart", onDragStart);
}
```

Initialize both in your application entry point (`main.tsx` or `index.tsx`):
```typescript
import { installNativeBackDetection } from "./shared/lib/nativeBack";
import { installNoLongPressMenus } from "./shared/lib/noLongPressMenus";

installNativeBackDetection();
installNoLongPressMenus();
```

---

### Step 4: Theme & Safe Area CSS (`src/shared/theme/navbar.css`)

Add the following CSS rules. Customize the CSS variables (`--color-primary`, `--navbar-bg`, etc.) to match your app's brand theme:

```css
:root {
  /* Theme tokens - customize to your app's brand */
  --color-primary: #4F7CFF;          /* Primary highlight color */
  --color-line: rgba(226, 232, 240, 0.8);
  --color-muted: #64748B;

  /* System Bottom calculation:
     Automatically accounts for Android 3-Button navigation bar height,
     gesture pill insets, and iOS home bar, with a 0.75rem safe fallback */
  --mobile-system-bottom: max(
    env(safe-area-inset-bottom, 0px),
    env(safe-area-max-inset-bottom, 0px),
    0.75rem
  );
}

@media (display-mode: standalone) and (max-width: 767px) {
  :root {
    --mobile-system-bottom: max(
      env(safe-area-inset-bottom, 0px),
      env(safe-area-max-inset-bottom, 0px),
      1rem
    );
  }
}

/* Outer floating navigation wrapper:
   Leaves touch events free to pass through outside the capsule */
.mobile-bottom-nav {
  pointer-events: none;
  padding:
    0 max(0.75rem, env(safe-area-inset-right, 0px))
    calc(var(--mobile-system-bottom) + 0.75rem)
    max(0.75rem, env(safe-area-inset-left, 0px));
}

/* Glass capsule container */
.mobile-bottom-nav-shell {
  pointer-events: auto;
  position: relative;
  isolation: isolate;
  overflow: visible;
  min-height: 4.25rem;
  padding: 0.375rem;
  border: 1px solid color-mix(in srgb, #ffffff 78%, var(--color-line));
  border-radius: 1.75rem;
  background: linear-gradient(145deg, rgba(255, 255, 255, 0.88), rgba(244, 248, 255, 0.72));
  box-shadow:
    0 18px 44px -16px rgba(26, 31, 54, 0.38),
    0 6px 18px -8px color-mix(in srgb, var(--color-primary) 35%, transparent),
    inset 0 1px 0 rgba(255, 255, 255, 0.95);
  -webkit-backdrop-filter: blur(26px) saturate(185%);
  backdrop-filter: blur(26px) saturate(185%);
}

.mobile-bottom-nav-shell::before {
  content: "";
  position: absolute;
  z-index: -1;
  inset: 0;
  border-radius: inherit;
  background:
    radial-gradient(circle at 18% -30%, rgba(255, 255, 255, 0.96), transparent 52%),
    radial-gradient(circle at 82% 135%, color-mix(in srgb, var(--color-primary) 20%, transparent), transparent 52%);
  pointer-events: none;
}

.mobile-bottom-nav-item {
  -webkit-tap-highlight-color: transparent;
  outline-offset: 2px;
  transition: color 220ms ease;
}

/* Page content bottom padding so nothing hides behind the floating bar */
.mobile-content-with-nav {
  padding-bottom: calc(7.25rem + var(--mobile-system-bottom));
}

/* Liquid Pill & Glass Lens */
.liquid-pill {
  z-index: 20;
  transform-origin: center;
  will-change: transform, width;
  pointer-events: none;
  border: 0;
  border-radius: 1.6rem;
  background: transparent;
  overflow: visible;
  box-shadow:
    0 12px 24px -12px rgba(28, 46, 110, 0.45),
    0 3px 8px -3px rgba(28, 46, 110, 0.2);
  transition: box-shadow 260ms ease;
}

.liquid-lens {
  position: absolute;
  inset: 0;
  overflow: hidden;
  border-radius: inherit;
  background: #f2f6fe;
}

.liquid-lens-zoom {
  position: absolute;
  inset: 0;
  transform-origin: center;
}

.liquid-lens-row {
  position: absolute;
  left: 0;
  top: 0.3rem;
  display: flex;
  align-items: center;
  justify-content: space-around;
  padding: 0.375rem;
  border-radius: 1.75rem;
  background: linear-gradient(145deg, #fdfdff, #edf2ff);
}

/* Rim refraction: mask isolates edges */
.liquid-lens-rim,
.liquid-lens-fringe {
  -webkit-mask-image: radial-gradient(closest-side, transparent 64%, #000 96%);
  mask-image: radial-gradient(closest-side, transparent 64%, #000 96%);
}

/* Chromatic fringing on the rim */
.liquid-lens-fringe .liquid-lens-row {
  background: transparent;
}
.liquid-lens-fringe {
  mix-blend-mode: multiply;
  opacity: 0.75;
}
.liquid-lens-fringe-warm { translate: -2px 0; }
.liquid-lens-fringe-cool { translate: 2px 0; }
.liquid-lens-fringe-warm .liquid-face { color: rgb(255 70 140); }
.liquid-lens-fringe-cool .liquid-face { color: rgb(40 200 255); }

.liquid-rim {
  position: absolute;
  inset: 0;
  border-radius: inherit;
  pointer-events: none;
  background:
    radial-gradient(80% 55% at 28% 0%, rgba(255, 255, 255, 0.55), transparent 62%),
    radial-gradient(60% 45% at 80% 100%, rgba(255, 255, 255, 0.25), transparent 65%);
  box-shadow:
    inset 0 0 0 1px rgba(255, 255, 255, 0.85),
    inset 0 1.5px 1px rgba(255, 255, 255, 1),
    inset 0 -1px 2px rgba(28, 46, 110, 0.1),
    inset 5px 0 8px -6px rgba(255, 255, 255, 0.95),
    inset -5px 0 8px -6px rgba(255, 255, 255, 0.95);
}

.liquid-pill.is-dragging {
  box-shadow:
    0 22px 34px -14px rgba(28, 46, 110, 0.5),
    0 8px 16px -8px color-mix(in srgb, var(--color-primary) 50%, transparent);
}

.no-callout {
  -webkit-touch-callout: none;
  -webkit-user-select: none;
  user-select: none;
}
```

---

### Step 5: The Component (`src/shared/components/LiquidTabBar.tsx`)

```tsx
import { useCallback, useEffect, useLayoutEffect, useRef, useState, type ComponentType } from "react";
import { Link, useLocation, useNavigate, useNavigationType } from "react-router-dom";
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
import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";
import { wasNativeBack } from "../lib/nativeBack";

function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

export type LiquidTab = {
  to: string;
  label: string;
  icon: ComponentType<{ className?: string; strokeWidth?: number }>;
  end?: boolean;
  locked?: boolean;
};

// Physics constants
const GLIDE = { type: "spring", stiffness: 320, damping: 23, mass: 0.9 } as const;
const GLIDE_CALM = { type: "spring", stiffness: 500, damping: 45 } as const;
const BLEED_X = 4;
const DRAG_SLOP_PX = 4;
const LENS_ZOOM = 1.22;
const RIM_ZOOM = 1.42;

function tabFace(tab: LiquidTab, highlighted: boolean, inLens = false) {
  const face = (
    <>
      <span className="relative">
        <tab.icon className="size-5" strokeWidth={highlighted ? 2.35 : 2} />
        {tab.locked && <Lock className="absolute -right-1.5 -top-1 size-2.5" />}
      </span>
      <span>{tab.label}</span>
    </>
  );
  if (!inLens) return face;
  return (
    <span
      className={cn(
        "liquid-face relative flex w-full flex-col items-center gap-1 py-2",
        highlighted ? "text-primary" : "text-muted"
      )}
    >
      {face}
    </span>
  );
}

function activeIndexFor(tabs: LiquidTab[], pathname: string): number {
  const path = pathname.replace(/\/+$/, "") || "/";
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

export function LiquidTabBar({
  tabs,
  testId = "mobile-nav",
  ariaLabel = "Navigation",
  onLockedPress,
  slideTransition = false,
}: {
  tabs: LiquidTab[];
  testId?: string;
  ariaLabel?: string;
  onLockedPress?: (to: string) => void;
  slideTransition?: boolean;
}) {
  const location = useLocation();
  const navigate = useNavigate();
  const reduceMotion = useReducedMotion();
  const activeIndex = activeIndexFor(tabs, location.pathname);

  // If entering via native OS gesture back / Android hardware back, skip slide-in
  const navigationType = useNavigationType();
  const [enterInPlace] = useState(() => navigationType === "POP" && wasNativeBack());

  const shellRef = useRef<HTMLDivElement>(null);
  const itemRefs = useRef<(HTMLElement | null)[]>([]);
  const [slots, setSlots] = useState<{ left: number; width: number }[]>([]);
  const [shellBox, setShellBox] = useState({ width: 0, height: 0 });

  const x = useMotionValue(0);
  const width = useMotionValue(0);
  const [dragging, setDragging] = useState(false);
  const [hoverIndex, setHoverIndex] = useState(activeIndex);

  // Velocity-based physical liquid stretch & squash
  const velocity = useVelocity(x);
  const smoothVelocity = useSpring(velocity, { stiffness: 420, damping: 20 });
  const stretch = useTransform(smoothVelocity, [-2200, 0, 2200], reduceMotion ? [1, 1, 1] : [1.4, 1, 1.4]);
  const squash = useTransform(stretch, (s) => 1 / Math.sqrt(s));
  const lift = useSpring(1, { stiffness: 460, damping: 13 });
  const liftY = useSpring(0, { stiffness: 380, damping: 15 });
  const hop = useTransform(smoothVelocity, (v) => (reduceMotion ? 0 : -Math.min(5, Math.abs(v) / 450)));

  const scaleX = useTransform(() => stretch.get() * lift.get());
  const scaleY = useTransform(() => squash.get() * lift.get());
  const y = useTransform(() => hop.get() + liftY.get());
  const lensX = useTransform(x, (v) => -v);
  const lensY = useTransform(y, (v) => -v);

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
    setSlots(itemRefs.current.map((el) => (el ? { left: el.offsetLeft, width: el.offsetWidth } : { left: 0, width: 0 })));
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

  const placed = useRef(false);
  const pendingIndex = useRef<number | null>(null);

  useEffect(() => {
    const slot = slots[activeIndex];
    if (!slot || dragging) return;
    if (pendingIndex.current !== null && pendingIndex.current !== activeIndex) return;
    pendingIndex.current = null;
    setHoverIndex(activeIndex);

    if (!placed.current) {
      x.jump(pillX(slot));
      width.jump(pillW(slot));
      placed.current = true;
      return;
    }

    if (Math.abs(x.get() - pillX(slot)) < 0.5 && Math.abs(width.get() - pillW(slot)) < 0.5) return;
    animate(x, pillX(slot), reduceMotion ? GLIDE_CALM : GLIDE);
    animate(width, pillW(slot), reduceMotion ? GLIDE_CALM : GLIDE);
  }, [activeIndex, slots, dragging, reduceMotion, x, width]);

  // Drag interaction
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
    if (!reduceMotion) lift.set(0.93);
  };

  const onPointerMove = (e: React.PointerEvent) => {
    const d = drag.current;
    if (!d || e.pointerId !== d.id) return;
    const dx = e.clientX - d.startX;
    if (!d.moved) {
      if (Math.abs(dx) < DRAG_SLOP_PX) return;
      d.moved = true;
      x.stop();
      width.stop();
      setDragging(true);
      if (!reduceMotion) {
        lift.set(1.16);
        liftY.set(-5);
      }
      shellRef.current?.setPointerCapture(e.pointerId);
    }
    const first = slots[0] ? pillX(slots[0]) : 0;
    const last = slots[slots.length - 1] ? pillX(slots[slots.length - 1]) : 0;
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
    lift.set(1);
    liftY.set(0);
    if (!d.moved) return;
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
      initial={slideTransition && !enterInPlace ? { y: "110%" } : false}
      animate={{ y: 0 }}
      exit={slideTransition ? { y: "110%" } : undefined}
      transition={reduceMotion ? { duration: 0.12 } : { type: "spring", stiffness: 360, damping: 34 }}
    >
      <motion.div
        ref={shellRef}
        className="mobile-bottom-nav-shell no-callout mx-auto flex max-w-md items-center justify-around"
        initial={enterInPlace ? false : { opacity: 0, scale: 0.96 }}
        animate={{ opacity: 1, scale: 1 }}
        transition={{ type: "spring", stiffness: 340, damping: 28, mass: 0.75 }}
        onPointerMove={onPointerMove}
        onPointerUp={endDrag}
        onPointerCancel={endDrag}
        onClickCapture={(e) => {
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
            className={cn("mobile-bottom-nav-active liquid-pill absolute", dragging && "is-dragging")}
            style={{
              left: 0,
              top: "-0.3rem",
              bottom: "-0.3rem",
              x,
              y,
              width,
              scaleX,
              scaleY,
            }}
          >
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
            i === activeIndex && "touch-none"
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
```

---

### Step 6: Layout Usage Example (`AppLayout.tsx`)

In your layout, render `<LiquidTabBar>` conditionally for top-level routes, and wrap your `<main>` content with `mobile-content-with-nav` so page content never gets cut off behind the bar:

```tsx
import { ReactNode } from "react";
import { LayoutDashboard, Calendar, ClipboardList, User } from "lucide-react";
import { LiquidTabBar, type LiquidTab } from "./shared/components/LiquidTabBar";

const TABS: LiquidTab[] = [
  { to: "/dashboard", label: "Home", icon: LayoutDashboard, end: true },
  { to: "/calendar", label: "Schedule", icon: Calendar },
  { to: "/orders", label: "Orders", icon: ClipboardList },
  { to: "/profile", label: "Profile", icon: User },
];

export function AppLayout({ children }: { children: ReactNode }) {
  return (
    <div className="min-h-screen bg-background">
      {/* Content wrapper with dynamic padding offset */}
      <main className="mobile-content-with-nav px-4">
        {children}
      </main>

      {/* Floating Bottom Nav */}
      <LiquidTabBar tabs={TABS} slideTransition />
    </div>
  );
}
```
```
