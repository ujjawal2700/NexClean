import { Repeat } from "lucide-react";
import { formatMoney } from "@shared/lib/format";

/**
 * A booking's price cell. Subscription washes are prepaid through the plan, so
 * their own price is ₹0 — showing that reads as "free job", which it isn't.
 */
export function BookingPrice({ price, isSubscriptionWash }: { price: number; isSubscriptionWash?: boolean }) {
  if (isSubscriptionWash) {
    return (
      <span
        className="inline-flex items-center gap-1 rounded-pill bg-violet-500/10 px-2.5 py-0.5 text-xs font-medium text-violet-600"
        title="Prepaid through the customer's subscription plan"
      >
        <Repeat className="size-3" /> Subscription
      </span>
    );
  }
  return <>{formatMoney(price)}</>;
}
