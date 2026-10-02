/**
 * Sharing that works in the browser AND inside the Flutter app's web view.
 *
 * Flutter web views don't implement the Web Share API (navigator.share is
 * undefined there), and navigator.clipboard is often refused too — so a share
 * button that relied on either did nothing at all in the store apps.
 *
 * Order of preference:
 *  1. The native app's share sheet, when the Flutter app exposes a
 *     JavaScriptChannel named "NexCleanShare" (it receives {title,text,url}
 *     as JSON and calls share_plus).
 *  2. The browser's share sheet (Chrome/Safari on a phone).
 *  3. Copying the full invite to the clipboard, with a fallback copy method
 *     that works where the Clipboard API is blocked.
 */
export type ShareOutcome = "shared" | "copied" | "failed";

type SharePayload = { title: string; text: string; url: string };

export async function shareOrCopy(payload: SharePayload): Promise<ShareOutcome> {
  const bridge = (window as unknown as { NexCleanShare?: { postMessage: (m: string) => void } }).NexCleanShare;
  if (bridge?.postMessage) {
    try {
      bridge.postMessage(JSON.stringify(payload));
      return "shared";
    } catch {
      /* fall through */
    }
  }

  if (typeof navigator.share === "function") {
    try {
      await navigator.share(payload);
      return "shared";
    } catch (err) {
      // The user closed the sheet — that's not a failure to fall back from.
      if ((err as DOMException)?.name === "AbortError") return "shared";
    }
  }

  return (await copyText(`${payload.text} ${payload.url}`)) ? "copied" : "failed";
}

export async function copyText(text: string): Promise<boolean> {
  try {
    if (navigator.clipboard?.writeText) {
      await navigator.clipboard.writeText(text);
      return true;
    }
  } catch {
    /* blocked (common in web views) — try the older way */
  }
  try {
    const area = document.createElement("textarea");
    area.value = text;
    area.setAttribute("readonly", "");
    area.style.position = "fixed";
    area.style.opacity = "0";
    area.style.userSelect = "text";
    document.body.appendChild(area);
    area.select();
    area.setSelectionRange(0, text.length);
    const ok = document.execCommand("copy");
    document.body.removeChild(area);
    return ok;
  } catch {
    return false;
  }
}
