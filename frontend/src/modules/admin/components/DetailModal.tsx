import { useEffect, useState, type ReactNode } from "react";
import { createPortal } from "react-dom";
import { Check, Copy, X } from "lucide-react";
import { cn } from "@shared/lib/utils";
import { useScrollLock } from "@shared/lib/scrollLock";
import { copyText } from "@shared/lib/share";

/** Admin detail popup: scrollable body, optional sticky footer, page frozen behind it. */
export function DetailModal({
  title,
  subtitle,
  onClose,
  footer,
  children,
  testId,
}: {
  title: string;
  subtitle?: ReactNode;
  onClose: () => void;
  footer?: ReactNode;
  children: ReactNode;
  testId?: string;
}) {
  useScrollLock();
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && onClose();
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [onClose]);

  // Portalled to <body>: opened from inside a glass card, a `fixed` overlay is
  // otherwise trapped in that card (backdrop-filter makes it the containing
  // block), so the dimmed backdrop covered only the card, not the page.
  return createPortal(
    <div className="safe-modal-overlay fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm" onClick={onClose}>
      <div
        role="dialog"
        aria-modal="true"
        aria-label={title}
        data-testid={testId}
        onClick={(e) => e.stopPropagation()}
        className="flex max-h-full w-full max-w-xl flex-col rounded-2xl border border-line bg-surface shadow-xl"
      >
        <div className="flex shrink-0 items-start justify-between gap-3 border-b border-line px-6 py-4">
          <div className="min-w-0">
            <h3 className="font-display text-lg font-semibold text-ink">{title}</h3>
            {subtitle && <div className="text-xs text-muted">{subtitle}</div>}
          </div>
          <button type="button" onClick={onClose} aria-label="Close" className="rounded-lg p-1 text-muted hover:text-ink">
            <X className="size-5" />
          </button>
        </div>
        <div className="min-h-0 flex-1 space-y-5 overflow-y-auto px-6 py-5" data-lenis-prevent="true">
          {children}
        </div>
        {footer && <div className="shrink-0 border-t border-line px-6 py-4">{footer}</div>}
      </div>
    </div>,
    document.body,
  );
}

/** A labelled value with a copy button — for account numbers, IFSC, payment ids. */
export function CopyField({
  label,
  value,
  mono,
  large,
}: {
  label: string;
  value: string | null | undefined;
  mono?: boolean;
  large?: boolean;
}) {
  const [copied, setCopied] = useState(false);
  const copy = async () => {
    if (value && (await copyText(value))) {
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    }
  };
  return (
    <div className="flex items-center justify-between gap-3 py-1.5">
      <div className="min-w-0">
        <p className="text-[11px] font-medium uppercase tracking-wide text-muted">{label}</p>
        <p
          className={cn(
            "break-all text-ink select-text",
            mono && "font-mono",
            large ? "text-base font-semibold" : "text-sm font-medium",
          )}
        >
          {value || <span className="font-normal text-muted">—</span>}
        </p>
      </div>
      {value && (
        <button
          type="button"
          onClick={copy}
          aria-label={`Copy ${label}`}
          className="flex shrink-0 cursor-pointer items-center gap-1 rounded-lg px-2 py-1 text-xs font-medium text-primary hover:bg-primary/10"
        >
          {copied ? <Check className="size-3.5" /> : <Copy className="size-3.5" />}
          {copied ? "Copied" : "Copy"}
        </button>
      )}
    </div>
  );
}
