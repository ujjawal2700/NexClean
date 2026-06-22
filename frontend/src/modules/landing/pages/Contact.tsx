import { Mail, Phone, MapPin, type LucideIcon } from "lucide-react";
import { StaticPageShell } from "../components/StaticPageShell";
import { Markdown } from "@shared/components/Markdown";
import { useSiteContent } from "@shared/hooks/useSiteContent";
import type { ContactChannelType } from "@shared/types/content";

const CHANNEL_ICON: Record<ContactChannelType, LucideIcon> = {
  email: Mail,
  phone: Phone,
  address: MapPin,
};

export function Contact() {
  const { contact } = useSiteContent();

  return (
    <StaticPageShell eyebrow={contact.eyebrow} title={contact.title} subtitle={contact.subtitle}>
      <ul className="list-none! space-y-4 pl-0!">
        {contact.channels.map((c) => {
          const Icon = CHANNEL_ICON[c.type];
          return (
            <li key={c.label} className="flex items-center gap-4 rounded-card border border-line bg-surface/60 p-4">
              <span className="grid size-10 shrink-0 place-items-center rounded-xl bg-primary/10 text-primary">
                <Icon className="size-5" />
              </span>
              <div>
                <p className="text-xs font-medium uppercase tracking-[0.14em] text-muted">{c.label}</p>
                {c.href ? (
                  <a href={c.href} className="text-sm font-medium text-ink no-underline">
                    {c.value}
                  </a>
                ) : (
                  <p className="text-sm font-medium text-ink">{c.value}</p>
                )}
              </div>
            </li>
          );
        })}
      </ul>

      <Markdown>{contact.body}</Markdown>
    </StaticPageShell>
  );
}
