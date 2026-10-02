import { useMemo } from "react";
import { formatDate } from "@shared/lib/format";
import { useBookings } from "../api/queries";
import { useSessionStore } from "../store/sessionStore";
import { SupportCenter, type SupportJob } from "../components/SupportCenter";

/** Customer Help & Support — asks which booking (or topic) before opening a chat. */
export function HelpSupport() {
  const authenticated = useSessionStore((s) => s.authenticated);
  const { data: bookings = [] } = useBookings();

  const jobs = useMemo<SupportJob[]>(
    () =>
      [...bookings]
        .sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime())
        .slice(0, 10)
        .map((b) => ({
          id: b.id,
          title: [b.packageName, b.vehicleName].filter(Boolean).join(" · "),
          subtitle: `${formatDate(b.date)} · ${b.slot}`,
          status: b.status.replace("_", " "),
        })),
    [bookings],
  );

  return <SupportCenter role="customer" authenticated={authenticated} jobs={jobs} jobNoun="booking" />;
}
