import { useEffect, useId, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { FileText, ShieldCheck } from "lucide-react";
import { Button } from "@shared/ui/Button";
import { Markdown } from "@shared/components/Markdown";
import { useSiteContent } from "@shared/hooks/useSiteContent";
import type { ProsePage } from "@shared/types/content";

type LegalConsentProps = {
  checked: boolean;
  onChange: (checked: boolean) => void;
};

type LegalDocument = "terms" | "privacy";

function LegalDocumentDialog({
  document,
  page,
  onClose,
}: {
  document: LegalDocument;
  page: ProsePage;
  onClose: () => void;
}) {
  const titleId = useId();
  const descriptionId = useId();
  const dialogRef = useRef<HTMLDivElement>(null);
  const scrollAreaRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const appRoot = window.document.getElementById("root");
    const previousOverflow = window.document.body.style.overflow;
    const previousAriaHidden = appRoot?.getAttribute("aria-hidden");
    const wasInert = appRoot?.inert ?? false;
    window.document.body.style.overflow = "hidden";
    if (appRoot) {
      appRoot.inert = true;
      appRoot.setAttribute("aria-hidden", "true");
    }

    const focusFrame = window.requestAnimationFrame(() => scrollAreaRef.current?.focus());

    const keepFocusInside = (event: KeyboardEvent) => {
      if (event.key !== "Tab" || !dialogRef.current) return;
      const focusable = Array.from(
        dialogRef.current.querySelectorAll<HTMLElement>(
          'button:not([disabled]), a[href], input:not([disabled]), [tabindex]:not([tabindex="-1"])',
        ),
      );
      if (focusable.length === 0) {
        event.preventDefault();
        dialogRef.current.focus();
        return;
      }

      const first = focusable[0]!;
      const last = focusable[focusable.length - 1]!;
      if (event.shiftKey && (window.document.activeElement === first || window.document.activeElement === dialogRef.current)) {
        event.preventDefault();
        last.focus();
      } else if (!event.shiftKey && window.document.activeElement === last) {
        event.preventDefault();
        first.focus();
      }
    };

    window.document.addEventListener("keydown", keepFocusInside);
    return () => {
      window.cancelAnimationFrame(focusFrame);
      window.document.removeEventListener("keydown", keepFocusInside);
      window.document.body.style.overflow = previousOverflow;
      if (appRoot) {
        appRoot.inert = wasInert;
        if (previousAriaHidden == null) appRoot.removeAttribute("aria-hidden");
        else appRoot.setAttribute("aria-hidden", previousAriaHidden);
      }
    };
  }, []);

  return createPortal(
    <div className="fixed inset-0 z-[250] grid place-items-center bg-slate-950/70 p-3 backdrop-blur-sm sm:p-6">
      <div
        ref={dialogRef}
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
        aria-describedby={descriptionId}
        tabIndex={-1}
        className="flex h-[92dvh] max-h-[56rem] w-full max-w-3xl flex-col overflow-hidden rounded-3xl border border-line bg-surface shadow-2xl outline-none focus-visible:ring-2 focus-visible:ring-primary/50"
      >
        <header className="shrink-0 border-b border-line bg-surface px-5 py-5 sm:px-8 sm:py-6">
          <div className="flex items-start gap-3">
            <div className="flex size-10 shrink-0 items-center justify-center rounded-2xl bg-primary/10 text-primary">
              {document === "privacy" ? <ShieldCheck className="size-5" /> : <FileText className="size-5" />}
            </div>
            <div>
              <p className="text-xs font-semibold uppercase tracking-[0.18em] text-primary">{page.eyebrow}</p>
              <h2 id={titleId} className="mt-1 font-display text-2xl font-semibold text-ink sm:text-3xl">
                {page.title}
              </h2>
              <p id={descriptionId} className="mt-2 text-sm leading-relaxed text-muted">{page.subtitle}</p>
            </div>
          </div>
        </header>

        <div
          ref={scrollAreaRef}
          role="region"
          aria-label={`${page.title} content`}
          tabIndex={0}
          data-lenis-prevent="true"
          className="min-h-0 flex-1 touch-pan-y overflow-y-auto overscroll-contain px-5 py-2 outline-none [scrollbar-gutter:stable] focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-primary/40 sm:px-8"
        >
          <div
            className={[
              "space-y-5 py-5 text-sm text-ink-soft sm:text-base",
              "[&_h2]:mt-8 [&_h2]:font-display [&_h2]:text-xl [&_h2]:font-semibold [&_h2]:text-ink",
              "[&_h2:first-child]:mt-0 [&_p]:leading-relaxed",
              "[&_ul]:list-disc [&_ul]:space-y-2 [&_ul]:pl-5",
              "[&_a]:text-primary [&_a]:underline [&_a]:underline-offset-2",
            ].join(" ")}
          >
            <Markdown>{page.body}</Markdown>
          </div>
        </div>

        <footer className="shrink-0 border-t border-line bg-surface px-5 py-4 sm:px-8">
          <Button type="button" className="w-full sm:ml-auto sm:w-auto sm:min-w-32" onClick={onClose}>
            Okay
          </Button>
        </footer>
      </div>
    </div>,
    window.document.body,
  );
}

export function LegalConsent({ checked, onChange }: LegalConsentProps) {
  const { pages } = useSiteContent();
  const [openDocument, setOpenDocument] = useState<LegalDocument | null>(null);
  const lastTriggerRef = useRef<HTMLButtonElement | null>(null);

  const open = (document: LegalDocument, trigger: HTMLButtonElement) => {
    lastTriggerRef.current = trigger;
    setOpenDocument(document);
  };

  const close = () => {
    setOpenDocument(null);
    window.requestAnimationFrame(() => lastTriggerRef.current?.focus());
  };

  return (
    <>
      <label className="flex cursor-pointer items-start gap-3 rounded-2xl border border-line bg-surface/60 p-3.5 text-sm text-muted transition-colors hover:border-primary/40">
        <input
          type="checkbox"
          name="legalConsent"
          required
          checked={checked}
          onChange={(event) => onChange(event.target.checked)}
          className="mt-0.5 size-4 shrink-0 accent-[var(--color-primary)]"
        />
        <span className="leading-relaxed">
          I have read and agree to the{" "}
          <button
            type="button"
            aria-haspopup="dialog"
            onClick={(event) => {
              event.preventDefault();
              event.stopPropagation();
              open("terms", event.currentTarget);
            }}
            className="font-medium text-primary underline underline-offset-2"
          >
            Terms &amp; Conditions
          </button>{" "}
          and acknowledge the{" "}
          <button
            type="button"
            aria-haspopup="dialog"
            onClick={(event) => {
              event.preventDefault();
              event.stopPropagation();
              open("privacy", event.currentTarget);
            }}
            className="font-medium text-primary underline underline-offset-2"
          >
            Privacy Policy
          </button>
          , including how NexClean collects and uses my information.
        </span>
      </label>

      {openDocument && <LegalDocumentDialog document={openDocument} page={pages[openDocument]} onClose={close} />}
    </>
  );
}
