import { cn } from "@shared/lib/utils";

type StepperProps = {
  steps: string[];
  current: number;
};

/** Progress indicator for multi-step auth/signup flows. `current` is 0-indexed. */
export function Stepper({ steps, current }: StepperProps) {
  return (
    <div className="mb-5">
      <p className="text-xs font-medium text-muted">
        Step {current + 1} of {steps.length} · {steps[current]}
      </p>
      <div
        className="mt-2 flex gap-1.5"
        role="progressbar"
        aria-valuemin={1}
        aria-valuemax={steps.length}
        aria-valuenow={current + 1}
        aria-valuetext={`Step ${current + 1} of ${steps.length}: ${steps[current]}`}
      >
        {steps.map((step, i) => (
          <span
            key={step}
            className={cn("h-1.5 flex-1 rounded-full transition-colors", i <= current ? "bg-primary" : "bg-line")}
          />
        ))}
      </div>
    </div>
  );
}
