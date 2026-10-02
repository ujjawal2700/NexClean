import { useState } from "react";
import { Loader2, X } from "lucide-react";
import { cn } from "@shared/lib/utils";
import { Button } from "@shared/ui/Button";
import { Input } from "@shared/ui/Input";
import { ApiError } from "@shared/lib/api";
import { useReleaseJob } from "../api/agent.api";
import { useScrollLock } from "@shared/lib/scrollLock";

const REASONS = [
  "Personal emergency",
  "My vehicle broke down",
  "Can't reach the location",
  "Running too late for this slot",
];

/**
 * "Can't do this job?" — gives an assigned job back before cleaning starts. The
 * job goes straight to the next-nearest cleaner and the customer is told.
 */
export function ReleaseJobSheet({
  jobId,
  onClose,
  onReleased,
}: {
  jobId: string;
  onClose: () => void;
  onReleased: () => void;
}) {
  const release = useReleaseJob();
  useScrollLock();
  const [choice, setChoice] = useState<string>("");
  const [other, setOther] = useState("");
  const reason = choice === "Other" ? other.trim() : choice;

  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center bg-ink/60 backdrop-blur-sm sm:items-center sm:p-5" onClick={onClose}>
      <section
        role="dialog"
        aria-modal="true"
        aria-labelledby="release-title"
        onClick={(e) => e.stopPropagation()}
        className="w-full space-y-4 rounded-t-[28px] border border-line bg-surface p-5 pb-[max(1.25rem,env(safe-area-inset-bottom))] shadow-2xl sm:max-w-md sm:rounded-[28px] sm:p-6"
      >
        <div className="flex items-start justify-between gap-3">
          <div>
            <h2 id="release-title" className="font-display text-xl font-semibold text-ink">
              Can&apos;t do this job?
            </h2>
            <p className="mt-1 text-sm text-muted">
              We&apos;ll pass it to another cleaner right away and let the customer know. Please only do this when you
              really can&apos;t make it.
            </p>
          </div>
          <button type="button" onClick={onClose} aria-label="Close" className="grid size-9 shrink-0 cursor-pointer place-items-center rounded-full bg-surface-muted">
            <X className="size-4" />
          </button>
        </div>

        <div role="radiogroup" aria-label="Reason" className="space-y-2">
          {[...REASONS, "Other"].map((r) => (
            <button
              key={r}
              type="button"
              role="radio"
              aria-checked={choice === r}
              onClick={() => setChoice(r)}
              className={cn(
                "w-full cursor-pointer rounded-2xl border px-4 py-3 text-left text-sm transition-colors",
                choice === r ? "border-primary bg-primary/5 font-medium text-ink" : "border-line text-ink-soft hover:border-primary/40",
              )}
            >
              {r}
            </button>
          ))}
          {choice === "Other" && (
            <Input name="releaseReason" placeholder="Tell us what happened" value={other} maxLength={300} onChange={(e) => setOther(e.target.value)} />
          )}
        </div>

        {release.isError && (
          <p className="text-sm text-red-600">
            {release.error instanceof ApiError ? release.error.message : "Couldn't give the job back. Try again."}
          </p>
        )}

        <div className="flex flex-col-reverse gap-2 sm:flex-row">
          <Button variant="outline" className="min-h-12 sm:flex-1" onClick={onClose} disabled={release.isPending}>
            Keep the job
          </Button>
          <Button
            className="min-h-12 bg-none bg-red-600 hover:bg-red-700 sm:flex-1"
            disabled={reason.length < 3 || release.isPending}
            onClick={() => release.mutate({ id: jobId, reason }, { onSuccess: onReleased })}
            data-testid="confirm-release-job"
          >
            {release.isPending && <Loader2 className="size-4 animate-spin" />}
            Give job back
          </Button>
        </div>
      </section>
    </div>
  );
}
