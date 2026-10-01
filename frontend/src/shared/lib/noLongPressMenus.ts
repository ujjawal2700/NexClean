/**
 * On touch screens, a long press on a button or link opened the browser's
 * context menu ("Open in new tab", "Copy link") or picked the link up as a
 * draggable ghost — wrong for an app. Block both on interactive elements only,
 * and only for coarse pointers, so desktop right-click and all text fields
 * keep working.
 */
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
