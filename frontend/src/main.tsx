import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import "@shared/theme/theme.css";
import { App } from "./app/App";

// Prevent zoom in and out features
if (typeof document !== "undefined") {
  // Prevent Ctrl/Cmd + or - or 0 keys zoom
  document.addEventListener("keydown", (e) => {
    if (
      (e.ctrlKey || e.metaKey) &&
      (e.key === "=" || e.key === "-" || e.key === "0" || e.key === "+")
    ) {
      e.preventDefault();
    }
  }, { passive: false });

  // Prevent Ctrl + wheel zoom (trackpad pinch-to-zoom)
  document.addEventListener("wheel", (e) => {
    if (e.ctrlKey) {
      e.preventDefault();
    }
  }, { passive: false });

  // Prevent double tap zoom gesture on mobile safari
  document.addEventListener("touchstart", (e) => {
    if (e.touches.length > 1) {
      e.preventDefault();
    }
  }, { passive: false });
}

createRoot(document.getElementById("root")!).render(
  <StrictMode>
    <App />
  </StrictMode>,
);
