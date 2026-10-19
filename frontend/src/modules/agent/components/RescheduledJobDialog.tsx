import { useEffect, useRef } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { useNavigate } from "react-router-dom";
import { CalendarClock } from "lucide-react";
import { apiFetch } from "@shared/lib/api";
import { useScrollLock } from "@shared/lib/scrollLock";
import { Button } from "@shared/ui/Button";
import { jobsKey, summaryKey, useJobs } from "../api/agent.api";
import type { Job } from "../types";

/** REST-backed so a missed socket event or a closed app never loses the question. */
export function RescheduledJobDialog() {
  const { data: jobs = [] } = useJobs();
  const job = jobs.find((j) => j.rescheduleConfirmationToken && j.status === "assigned");
  return job ? <Confirmation key={`${job.id}:${job.rescheduleConfirmationToken}`} job={job} /> : null;
}

function Confirmation({ job }: { job: Job }) {
  useScrollLock();
  const dialog = useRef<HTMLElement>(null);
  const qc = useQueryClient();
  const navigate = useNavigate();
  const response = useMutation({
    mutationFn: (available: boolean) => apiFetch(`/agent/jobs/${job.id}/reschedule-response`, {
      method: "POST", body: { token: job.rescheduleConfirmationToken, available },
    }),
    onSuccess: (_result, available) => {
      // Clear this question immediately while refreshing all remaining jobs.
      qc.setQueryData<Job[]>(jobsKey, (jobs) => jobs?.map((j) =>
        j.id === job.id && j.rescheduleConfirmationToken === job.rescheduleConfirmationToken
          ? { ...j, rescheduleConfirmationToken: null } : j));
      if (!available) navigate("/agent", { replace: true });
    },
    onSettled: () => {
      void qc.invalidateQueries({ queryKey: jobsKey });
      void qc.invalidateQueries({ queryKey: summaryKey });
    },
  });

  useEffect(() => {
    const previous = document.activeElement as HTMLElement | null;
    dialog.current?.focus();
    const trapFocus = (event: KeyboardEvent) => {
      if (event.key !== "Tab") return;
      const buttons = Array.from(dialog.current?.querySelectorAll<HTMLButtonElement>("button:not(:disabled)") ?? []);
      if (!buttons.length) { event.preventDefault(); dialog.current?.focus(); return; }
      const first = buttons[0];
      const last = buttons[buttons.length - 1];
      if (event.shiftKey && (document.activeElement === first || document.activeElement === dialog.current)) {
        event.preventDefault(); last.focus();
      } else if (!event.shiftKey && (document.activeElement === last || document.activeElement === dialog.current)) {
        event.preventDefault(); first.focus();
      }
    };
    document.addEventListener("keydown", trapFocus);
    return () => { document.removeEventListener("keydown", trapFocus); previous?.focus(); };
  }, []);

  const date = new Date(job.date).toLocaleDateString("en-IN", {
    timeZone: "Asia/Kolkata", weekday: "short", day: "numeric", month: "short", year: "numeric",
  });
  return (
    <div className="safe-modal-overlay fixed inset-0 z-[125] flex items-center justify-center bg-ink/60 backdrop-blur-sm">
      <section ref={dialog} tabIndex={-1} role="alertdialog" aria-modal="true"
        aria-labelledby="rescheduled-job-title" aria-describedby="rescheduled-job-description"
        data-testid="rescheduled-job-dialog"
        className="max-h-full w-full max-w-sm overflow-y-auto rounded-[28px] border border-line bg-surface p-6 shadow-2xl">
        <CalendarClock className="size-10 text-primary" aria-hidden="true" />
        <h2 id="rescheduled-job-title" className="mt-4 font-display text-2xl font-semibold text-ink">Customer rescheduled the job</h2>
        <p className="mt-3 font-semibold text-ink">{job.packageName} · {job.customerName}</p>
        <p className="mt-2 text-ink">{date} · {job.slot}</p>
        <p id="rescheduled-job-description" className="mt-3 text-sm leading-6 text-muted">
          Are you available at the new time? If you can't make it, we'll find another cleaner.
        </p>
        {response.error && <p role="alert" className="mt-3 text-sm text-red-600">{response.error.message}</p>}
        <Button className="mt-5 min-h-12 w-full" disabled={response.isPending} onClick={() => response.mutate(true)}>
          {response.isPending ? "Updating…" : "Yes, I'm available"}
        </Button>
        <Button variant="outline" className="mt-3 min-h-12 w-full" disabled={response.isPending} onClick={() => response.mutate(false)}>
          I'm not available
        </Button>
      </section>
    </div>
  );
}
