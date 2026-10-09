import { useEffect, useState } from "react";
import { createPortal } from "react-dom";
import { X } from "lucide-react";

export function ChatImage({ src }: { src?: string }) {
  const [open, setOpen] = useState(false);
  useEffect(() => {
    if (!open) return;
    const close = (e: KeyboardEvent) => { if (e.key === "Escape") setOpen(false); };
    window.addEventListener("keydown", close);
    return () => window.removeEventListener("keydown", close);
  }, [open]);
  if (!src) return null;
  return <>
    <button type="button" onClick={() => setOpen(true)} className="mb-1 block max-w-full overflow-hidden rounded-xl" aria-label="View photo">
      <img src={src} alt="Shared photo" loading="lazy" className="max-h-72 w-auto max-w-full object-contain" />
    </button>
    {open && createPortal(<div role="dialog" aria-modal="true" aria-label="Photo viewer" className="fixed inset-0 z-[150] grid place-items-center bg-black/95 p-4" onClick={() => setOpen(false)}>
      <button type="button" autoFocus className="absolute right-3 top-[max(0.75rem,env(safe-area-inset-top))] grid size-11 place-items-center rounded-full bg-white/15 text-white" onClick={() => setOpen(false)} aria-label="Close photo"><X /></button>
      <img src={src} alt="Shared photo enlarged" className="max-h-[85dvh] max-w-full object-contain" />
    </div>, document.body)}
  </>;
}
