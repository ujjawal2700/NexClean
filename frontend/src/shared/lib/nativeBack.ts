/**
 * Tells a history pop made by the system (iOS edge swipe, Android back
 * button/gesture) apart from one the app made itself (an in-app back button
 * calling navigate(-1)).
 *
 * The system's back shows a snapshot of the previous screen while it animates,
 * so anything on that screen is already visible when React renders it — an
 * entrance animation replayed on top reads as a jitter.
 */

/** A pop this soon after a tap or key press is the app's own back button. */
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
  // Capture phase, installed before the router mounts, so this runs before the
  // router's own popstate listener re-renders the app.
  window.addEventListener(
    "popstate",
    (e) => {
      // Set by Safari 18+ / Chrome 123+ when the browser already animated the change.
      const uaTransition = (e as PopStateEvent & { hasUAVisualTransition?: boolean }).hasUAVisualTransition;
      lastPopWasNative = uaTransition === true || performance.now() - lastInteraction > IN_APP_WINDOW_MS;
    },
    true,
  );
}

/** Whether the most recent history pop came from the system's back, not the app. */
export function wasNativeBack() {
  return lastPopWasNative;
}
