import { useEffect, useState } from "react";
import { Timer, Loader2, Check } from "lucide-react";
import { ApiError } from "@shared/lib/api";
import { cn } from "@shared/lib/utils";
import { GlassCard } from "@shared/ui/GlassCard";
import { Button } from "@shared/ui/Button";
import { Input } from "@shared/ui/Input";
import { useDispatchConfig, useUpdateDispatchConfig } from "../api/admin.api";

const PRESETS = [30, 45, 60, 90, 120];

function describe(seconds: number): string {
  if (seconds < 60) return `${seconds} sec`;
  const m = Math.floor(seconds / 60);
  const s = seconds % 60;
  return s ? `${m} min ${s} sec` : `${m} min`;
}

/**
 * Admin control for the job-offer popup timer: how long each cleaner has to
 * accept before the offer moves on to the next nearest one.
 */
export function OfferTimerCard() {
  const { data: config, isLoading } = useDispatchConfig();
  const update = useUpdateDispatchConfig();
  const [value, setValue] = useState("");
  const [saved, setSaved] = useState(false);

  useEffect(() => {
    if (config) setValue(String(config.offerTimeoutSeconds));
  }, [config]);

  const min = config?.minOfferTimeoutSeconds ?? 10;
  const max = config?.maxOfferTimeoutSeconds ?? 600;
  const seconds = Number(value);
  const valid = Number.isInteger(seconds) && seconds >= min && seconds <= max;
  const dirty = config ? seconds !== config.offerTimeoutSeconds : false;

  const save = () => {
    if (!valid) return;
    setSaved(false);
    update.mutate(
      { offerTimeoutSeconds: seconds },
      { onSuccess: () => setSaved(true) },
    );
  };

  return (
    <GlassCard className="space-y-4">
      <div className="flex items-start gap-3">
        <div className="grid size-10 shrink-0 place-items-center rounded-2xl bg-primary/10 text-primary">
          <Timer className="size-5" />
        </div>
        <div>
          <p className="font-display text-lg font-semibold text-ink">Job offer timer</p>
          <p className="text-sm text-muted">
            How long each cleaner has to accept a job popup before it moves to the next nearest cleaner.
            Currently {config ? describe(config.offerTimeoutSeconds) : "…"} per cleaner. Offers already on
            screen keep their original timer.
          </p>
        </div>
      </div>

      <div className="grid gap-3 sm:grid-cols-[minmax(0,14rem)_1fr_auto] sm:items-end">
        <Input
          name="offerTimeoutSeconds"
          label="Seconds per cleaner"
          type="number"
          inputMode="numeric"
          min={min}
          max={max}
          step={1}
          value={value}
          disabled={isLoading}
          onChange={(e) => {
            setValue(e.target.value);
            setSaved(false);
          }}
          error={value !== "" && !valid ? `Enter ${min}–${max} seconds` : undefined}
        />
        <div className="flex flex-wrap gap-1.5 pb-1">
          {PRESETS.map((p) => (
            <button
              key={p}
              type="button"
              onClick={() => {
                setValue(String(p));
                setSaved(false);
              }}
              className={cn(
                "rounded-pill border px-3 py-1.5 text-sm transition-colors cursor-pointer",
                seconds === p
                  ? "border-primary bg-primary/10 text-primary"
                  : "border-line text-muted hover:border-primary/40 hover:text-ink",
              )}
            >
              {describe(p)}
            </button>
          ))}
        </div>
        <Button onClick={save} disabled={!valid || !dirty || update.isPending} className="mb-1">
          {update.isPending ? (
            <Loader2 className="size-4 animate-spin" />
          ) : saved && !dirty ? (
            <Check className="size-4" />
          ) : null}
          {saved && !dirty ? "Saved" : "Save"}
        </Button>
      </div>

      {update.isError && (
        <p className="text-sm text-red-600">
          {update.error instanceof ApiError ? update.error.message : "Could not save the offer timer."}
        </p>
      )}
    </GlassCard>
  );
}
