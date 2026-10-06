import { NavLink } from "react-router-dom";
import { cn } from "@shared/lib/utils";

const TABS = [
  { to: "/admin/bookkeeping", label: "Overview", end: true },
  { to: "/admin/bookkeeping/invoices", label: "Invoices", end: false },
  { to: "/admin/bookkeeping/settings", label: "GST & business", end: true },
  { to: "/admin/bookkeeping/template", label: "Invoice template", end: true },
];

/** Page title + the four Bookkeeping tabs, shared by every page in the section. */
export function BookkeepingHeader({ title, subtitle, actions }: { title: string; subtitle: string; actions?: React.ReactNode }) {
  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <h1 className="font-display text-3xl text-ink">{title}</h1>
          <p className="mt-1 max-w-2xl text-muted">{subtitle}</p>
        </div>
        {actions}
      </div>
      <nav className="flex gap-1 overflow-x-auto rounded-pill border border-line bg-surface/70 p-1 [scrollbar-width:none] sm:inline-flex" aria-label="Bookkeeping">
        {TABS.map((t) => (
          <NavLink
            key={t.to}
            to={t.to}
            end={t.end}
            className={({ isActive }) =>
              cn(
                "shrink-0 whitespace-nowrap rounded-pill px-4 py-1.5 text-sm font-medium transition-colors",
                isActive ? "bg-primary text-white" : "text-muted hover:text-ink",
              )
            }>
            {t.label}
          </NavLink>
        ))}
      </nav>
    </div>
  );
}
