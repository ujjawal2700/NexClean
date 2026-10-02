import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import "@shared/theme/theme.css";
import { App } from "./app/App";
import { installNoLongPressMenus } from "@shared/lib/noLongPressMenus";
import { installNativeBackDetection } from "@shared/lib/nativeBack";
import { installNativePushBridge } from "@shared/lib/push";
import { apiFetch } from "@shared/lib/api";

installNoLongPressMenus();
installNativeBackDetection();
// Lets the iOS/Android store apps register their native push token.
installNativePushBridge((token) =>
  apiFetch("/notifications/register-token", { method: "POST", body: { token } }),
);

// Prevent unwanted browser zoom shortcuts while preserving input focus
if (typeof document !== "undefined") {
  document.addEventListener("keydown", (e) => {
    if (
      (e.ctrlKey || e.metaKey) &&
      (e.key === "=" || e.key === "-" || e.key === "0" || e.key === "+")
    ) {
      e.preventDefault();
    }
  }, { passive: false });

  document.addEventListener("wheel", (e) => {
    if (e.ctrlKey) {
      e.preventDefault();
    }
  }, { passive: false });
}

const rootElement = document.getElementById("root");
if (rootElement) {
  createRoot(rootElement).render(
    <StrictMode>
      <App />
    </StrictMode>,
  );
}
