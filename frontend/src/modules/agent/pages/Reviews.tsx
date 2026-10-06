import { useNavigate } from "react-router-dom";
import { ArrowLeft, Loader2 } from "lucide-react";
import { GlassCard } from "@shared/ui/GlassCard";
import { ReviewsSummary } from "@shared/components/ReviewsSummary";
import { useMyReviews } from "../api/agent.api";

/** The cleaner's own ratings and what customers wrote about them. */
export function Reviews() {
  const navigate = useNavigate();
  const { data, isLoading, isError } = useMyReviews();

  return (
    <div className="space-y-5">
      <div className="flex items-center gap-3">
        <button
          onClick={() => navigate(-1)}
          className="flex size-9 shrink-0 cursor-pointer items-center justify-center rounded-xl border border-line bg-surface text-ink-soft transition-colors hover:text-primary"
          aria-label="Back">
          <ArrowLeft className="size-4" />
        </button>
        <h1 className="font-display text-2xl text-ink sm:text-3xl">My reviews</h1>
      </div>

      <GlassCard>
        {isLoading ? (
          <p className="flex items-center gap-2 text-sm text-muted">
            <Loader2 className="size-4 animate-spin" /> Loading reviews…
          </p>
        ) : isError || !data ? (
          <p className="text-sm text-red-600">Couldn't load your reviews. Pull to refresh and try again.</p>
        ) : (
          <ReviewsSummary
            data={data}
            emptyText="No reviews yet. Customers can rate you after each completed job."
          />
        )}
      </GlassCard>

      <p className="px-1 text-xs text-muted">
        Your rating is the average of every customer review. Great photos, punctuality and a careful finish earn 5 stars.
      </p>
    </div>
  );
}
