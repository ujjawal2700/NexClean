import { useMemo } from "react";
import { formatDate } from "@shared/lib/format";
import { useAgentSession } from "../store/sessionStore";
import { useJobs } from "../api/agent.api";
import { STATUS_LABEL } from "../types";
import { SupportCenter, type SupportJob } from "../../customer/components/SupportCenter";

/** Cleaner Help & Support — asks which job (or topic) before opening a chat. */
export function HelpSupport() {
  const authenticated = useAgentSession((s) => s.authenticated);
  const { data: jobs = [] } = useJobs();

  const items = useMemo<SupportJob[]>(
    () =>
      [...jobs]
        .sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime())
        .slice(0, 10)
        .map((j) => ({
          id: j.id,
          title: [j.packageName, j.vehicleName].filter(Boolean).join(" · "),
          subtitle: `${formatDate(j.date)} · ${j.slot} · ${j.customerName}`,
          status: STATUS_LABEL[j.status],
        })),
    [jobs],
  );

  return <SupportCenter role="agent" authenticated={authenticated} jobs={items} jobNoun="job" />;
}
