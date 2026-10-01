import { Share, SquarePlus, BellRing } from "lucide-react";
import { GlassCard } from "@shared/ui/GlassCard";
import { needsHomeScreenForPush } from "@shared/lib/push";

/**
 * iPhone/iPad in a browser tab: iOS only allows web push for a site opened
 * from the Home Screen, so a "Turn on" button there can never work. Explain
 * the one thing that does, instead of hiding the option without a word.
 */
export function IosPushHint({ appName = "NexClean" }: { appName?: string }) {
  if (!needsHomeScreenForPush()) return null;
  return (
    <GlassCard className="mb-4 border-primary/30 bg-primary/5" data-testid="ios-push-hint">
      <div className="flex items-start gap-3">
        <span className="grid size-10 shrink-0 place-items-center rounded-2xl bg-primary/10 text-primary">
          <BellRing className="size-5" />
        </span>
        <div className="min-w-0">
          <p className="font-display font-semibold text-ink">Get notifications on your iPhone</p>
          <p className="mt-1 text-sm text-muted">iPhone only sends notifications to apps on your Home Screen:</p>
          <ol className="mt-2 space-y-1.5 text-sm text-ink-soft">
            <li className="flex items-center gap-2">
              <span className="font-semibold text-ink">1.</span> Tap <Share className="size-4 text-primary" aria-label="Share" />
              in Safari&apos;s toolbar
            </li>
            <li className="flex items-center gap-2">
              <span className="font-semibold text-ink">2.</span> Choose <SquarePlus className="size-4 text-primary" aria-hidden />
              <span className="font-medium">Add to Home Screen</span>
            </li>
            <li className="flex items-start gap-2">
              <span className="font-semibold text-ink">3.</span>
              <span>
                Open {appName} from your Home Screen and turn on notifications here.
              </span>
            </li>
          </ol>
        </div>
      </div>
    </GlassCard>
  );
}
