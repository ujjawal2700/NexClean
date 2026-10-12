import { useEffect, useId, useRef } from "react";
import { createPortal } from "react-dom";
import { Mail, MapPin, Phone, UserX, X } from "lucide-react";
import { Button } from "@shared/ui/Button";
import { useSiteContent } from "@shared/hooks/useSiteContent";
import { useScrollLock } from "@shared/lib/scrollLock";

/** Account recovery uses the same published contacts as the Contact page. */
export function AccountDeactivatedDialog({ onClose }: { onClose: () => void }) {
  const titleId = useId();
  const dialogRef = useRef<HTMLElement>(null);
  const closeRef = useRef<HTMLButtonElement>(null);
  const channels = useSiteContent().contact?.channels ?? [];
  const phone = channels.find(channel => channel.type === "phone" && channel.href.startsWith("tel:"));
  useScrollLock();

  useEffect(() => {
    const previousFocus = document.activeElement as HTMLElement | null;
    closeRef.current?.focus();
    const onKey = (event: KeyboardEvent) => {
      if (event.key === "Escape") onClose();
      if (event.key !== "Tab") return;
      const controls = Array.from(dialogRef.current?.querySelectorAll<HTMLElement>('button:not([disabled]), a[href]') ?? []);
      const first = controls[0];
      const last = controls[controls.length - 1];
      if (event.shiftKey && document.activeElement === first) {
        event.preventDefault(); last?.focus();
      } else if (!event.shiftKey && document.activeElement === last) {
        event.preventDefault(); first?.focus();
      }
    };
    document.addEventListener("keydown", onKey);
    return () => { document.removeEventListener("keydown", onKey); previousFocus?.focus(); };
  }, [onClose]);

  return createPortal(
    <div className="safe-modal-overlay fixed inset-0 z-[250] flex items-center justify-center bg-ink/40 backdrop-blur-md">
      <section ref={dialogRef} role="dialog" aria-modal="true" aria-labelledby={titleId} className="flex max-h-full w-full max-w-md flex-col overflow-hidden rounded-card border border-line bg-surface shadow-2xl">
        <header className="flex shrink-0 items-center justify-between gap-3 border-b border-line px-5 py-4">
          <h2 id={titleId} className="font-display text-xl font-semibold text-ink">Account Deactivated</h2>
          <button ref={closeRef} type="button" onClick={onClose} aria-label="Close account deactivated dialog" className="grid size-11 shrink-0 place-items-center rounded-full text-muted hover:bg-surface-muted"><X className="size-5" /></button>
        </header>
        <div className="min-h-0 space-y-5 overflow-y-auto overscroll-contain p-5" data-lenis-prevent>
          <UserX className="mx-auto size-10 text-red-600" />
          <p className="text-sm text-muted">Your account has been deactivated. Only an administrator can reactivate it. Contact support for assistance.</p>
          <dl className="space-y-3 rounded-2xl bg-surface-muted/50 p-4">
            {channels.map(channel => {
              const Icon = channel.type === "phone" ? Phone : channel.type === "email" ? Mail : MapPin;
              return <div key={channel.type + channel.label} className="flex items-start gap-3">
                <Icon className="mt-1 size-4 shrink-0 text-primary" />
                <div className="min-w-0"><dt className="text-xs text-muted">{channel.label}</dt><dd className="mt-1 break-words text-sm text-ink">{channel.href ? <a href={channel.href}>{channel.value}</a> : channel.value}</dd></div>
              </div>;
            })}
          </dl>
        </div>
        <footer className="flex shrink-0 flex-col gap-3 border-t border-line p-5 sm:flex-row">
          <Button asChild className="min-h-[48px] flex-1"><a href={phone?.href ?? "/support"}>{phone ? "Call Support" : "Contact Support"}</a></Button>
          <Button variant="outline" onClick={onClose} className="min-h-[48px] flex-1">Close</Button>
        </footer>
      </section>
    </div>, document.body,
  );
}
