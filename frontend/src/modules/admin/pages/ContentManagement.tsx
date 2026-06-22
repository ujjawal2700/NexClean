import { useState } from "react";
import { Plus, Trash2, Check, GripVertical, AlertTriangle, RefreshCw } from "lucide-react";
import { GlassCard } from "@shared/ui/GlassCard";
import { Button } from "@shared/ui/Button";
import { Input } from "@shared/ui/Input";
import { Skeleton, SkeletonText } from "@shared/ui/Skeleton";
import { cn } from "@shared/lib/utils";
import type {
  SiteContent,
  Footer,
  Contact,
  Help,
  Landing,
  ProsePageKey,
  ProsePage,
  ContactChannelType,
} from "@shared/types/content";
import { useContent, useUpdateContent } from "../api/admin.api";

const TABS = [
  { id: "footer", label: "Footer" },
  { id: "pages", label: "Pages" },
  { id: "landing", label: "Landing page" },
  { id: "contact", label: "Contact" },
  { id: "help", label: "Help / FAQs" },
] as const;
type TabId = (typeof TABS)[number]["id"];

const PAGE_TABS: { id: ProsePageKey; label: string }[] = [
  { id: "about", label: "About" },
  { id: "careers", label: "Careers" },
  { id: "privacy", label: "Privacy" },
  { id: "terms", label: "Terms" },
  { id: "refund", label: "Refund" },
];

const LANDING_TABS: { id: keyof Landing; label: string }[] = [
  { id: "hero", label: "Hero" },
  { id: "emotionalStory", label: "Story" },
  { id: "problemSolution", label: "Problem / Solution" },
  { id: "howItWorks", label: "How it works" },
  { id: "vehicleCategories", label: "Vehicles" },
  { id: "smartAreaAlert", label: "Area Alert" },
  { id: "whyChoose", label: "Why choose" },
  { id: "subscriptions", label: "Plans heading" },
  { id: "appShowcase", label: "App showcase" },
  { id: "testimonials", label: "Testimonials" },
  { id: "stats", label: "Stats" },
  { id: "finalCta", label: "Final CTA" },
];

const CHANNEL_TYPES: ContactChannelType[] = ["email", "phone", "address"];

/** Themed multi-line input matching the shared Input look. */
function Textarea({
  label,
  hint,
  rows = 4,
  value,
  onChange,
}: {
  label?: string;
  hint?: string;
  rows?: number;
  value: string;
  onChange: (v: string) => void;
}) {
  return (
    <div className="w-full">
      {label && <label className="mb-1.5 block text-sm font-medium text-ink">{label}</label>}
      <textarea
        rows={rows}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className="w-full rounded-2xl border border-line bg-surface px-4 py-3 text-ink outline-none transition-colors placeholder:text-muted/70 focus:border-primary/50 focus:ring-2 focus:ring-primary/15"
      />
      {hint && <p className="mt-1 text-xs text-muted">{hint}</p>}
    </div>
  );
}

function SectionTitle({ children }: { children: React.ReactNode }) {
  return <p className="font-display text-lg font-semibold text-ink">{children}</p>;
}

// ── Footer editor ───────────────────────────────────────────────────────────
function FooterEditor({ value, onChange }: { value: Footer; onChange: (v: Footer) => void }) {
  const set = (patch: Partial<Footer>) => onChange({ ...value, ...patch });

  return (
    <div className="space-y-6">
      <GlassCard className="space-y-4">
        <SectionTitle>Brand & bottom bar</SectionTitle>
        <Textarea label="Tagline" rows={2} value={value.tagline} onChange={(v) => set({ tagline: v })} />
        <div className="grid gap-3 sm:grid-cols-2">
          <Input
            name="bottomLeft"
            label="Bottom-left line"
            hint="Use {year} for the current year."
            value={value.bottomLeft}
            onChange={(e) => set({ bottomLeft: e.target.value })}
          />
          <Input
            name="bottomRight"
            label="Bottom-right line"
            value={value.bottomRight}
            onChange={(e) => set({ bottomRight: e.target.value })}
          />
        </div>
      </GlassCard>

      {value.columns.map((col, ci) => {
        const setCol = (patch: Partial<(typeof value.columns)[number]>) => {
          const columns = value.columns.map((c, i) => (i === ci ? { ...c, ...patch } : c));
          set({ columns });
        };
        return (
          <GlassCard key={ci} className="space-y-3">
            <Input
              name={`col-${ci}`}
              label="Column heading"
              value={col.title}
              onChange={(e) => setCol({ title: e.target.value })}
            />
            <div className="space-y-2">
              {col.links.map((link, li) => {
                const setLink = (patch: Partial<typeof link>) =>
                  setCol({ links: col.links.map((l, i) => (i === li ? { ...l, ...patch } : l)) });
                return (
                  <div key={li} className="flex items-center gap-2">
                    <GripVertical className="size-4 shrink-0 text-muted/50" />
                    <input
                      value={link.label}
                      onChange={(e) => setLink({ label: e.target.value })}
                      placeholder="Label"
                      className="h-10 flex-1 rounded-xl border border-line bg-surface px-3 text-sm text-ink outline-none focus:border-primary/50"
                    />
                    <input
                      value={link.href}
                      onChange={(e) => setLink({ href: e.target.value })}
                      placeholder="/path or #section"
                      className="h-10 flex-1 rounded-xl border border-line bg-surface px-3 text-sm text-ink outline-none focus:border-primary/50"
                    />
                    <Button
                      size="sm"
                      variant="ghost"
                      onClick={() => setCol({ links: col.links.filter((_, i) => i !== li) })}
                    >
                      <Trash2 className="size-4" />
                    </Button>
                  </div>
                );
              })}
            </div>
            <Button
              size="sm"
              variant="outline"
              onClick={() => setCol({ links: [...col.links, { label: "New link", href: "/" }] })}
            >
              <Plus className="size-4" /> Add link
            </Button>
          </GlassCard>
        );
      })}
    </div>
  );
}

// ── Prose pages editor ────────────────────────────────────────────────────
function PagesEditor({
  value,
  onChange,
}: {
  value: SiteContent["pages"];
  onChange: (v: SiteContent["pages"]) => void;
}) {
  const [active, setActive] = useState<ProsePageKey>("about");
  const page = value[active];
  const set = (patch: Partial<ProsePage>) => onChange({ ...value, [active]: { ...page, ...patch } });

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap gap-2">
        {PAGE_TABS.map((t) => (
          <button
            key={t.id}
            onClick={() => setActive(t.id)}
            className={cn(
              "rounded-pill border px-4 py-1.5 text-sm font-medium transition-colors",
              t.id === active
                ? "border-primary bg-primary/10 text-primary"
                : "border-line text-ink-soft hover:border-primary/40",
            )}
          >
            {t.label}
          </button>
        ))}
      </div>

      <GlassCard className="space-y-4">
        <div className="grid gap-3 sm:grid-cols-3">
          <Input name="eyebrow" label="Eyebrow" value={page.eyebrow} onChange={(e) => set({ eyebrow: e.target.value })} />
          <div className="sm:col-span-2">
            <Input name="title" label="Title" value={page.title} onChange={(e) => set({ title: e.target.value })} />
          </div>
        </div>
        <Textarea label="Subtitle" rows={2} value={page.subtitle} onChange={(v) => set({ subtitle: v })} />
        <Textarea
          label="Body"
          hint="Markdown supported — use ## for headings, - for bullet lists, [text](url) for links."
          rows={18}
          value={page.body}
          onChange={(v) => set({ body: v })}
        />
      </GlassCard>
    </div>
  );
}

// ── Contact editor ────────────────────────────────────────────────────────
function ContactEditor({ value, onChange }: { value: Contact; onChange: (v: Contact) => void }) {
  const set = (patch: Partial<Contact>) => onChange({ ...value, ...patch });

  return (
    <div className="space-y-6">
      <GlassCard className="space-y-4">
        <SectionTitle>Header</SectionTitle>
        <div className="grid gap-3 sm:grid-cols-3">
          <Input name="eyebrow" label="Eyebrow" value={value.eyebrow} onChange={(e) => set({ eyebrow: e.target.value })} />
          <div className="sm:col-span-2">
            <Input name="title" label="Title" value={value.title} onChange={(e) => set({ title: e.target.value })} />
          </div>
        </div>
        <Textarea label="Subtitle" rows={2} value={value.subtitle} onChange={(v) => set({ subtitle: v })} />
      </GlassCard>

      <GlassCard className="space-y-3">
        <SectionTitle>Contact channels</SectionTitle>
        {value.channels.map((ch, i) => {
          const setCh = (patch: Partial<typeof ch>) =>
            set({ channels: value.channels.map((c, idx) => (idx === i ? { ...c, ...patch } : c)) });
          return (
            <div key={i} className="grid items-end gap-2 sm:grid-cols-[7rem_1fr_1fr_1fr_auto]">
              <label className="text-sm">
                <span className="mb-1.5 block font-medium text-ink">Type</span>
                <select
                  value={ch.type}
                  onChange={(e) => setCh({ type: e.target.value as ContactChannelType })}
                  className="h-10 w-full rounded-xl border border-line bg-surface px-2 text-sm text-ink outline-none focus:border-primary/50"
                >
                  {CHANNEL_TYPES.map((t) => (
                    <option key={t} value={t}>
                      {t}
                    </option>
                  ))}
                </select>
              </label>
              <input
                value={ch.label}
                onChange={(e) => setCh({ label: e.target.value })}
                placeholder="Label"
                className="h-10 rounded-xl border border-line bg-surface px-3 text-sm text-ink outline-none focus:border-primary/50"
              />
              <input
                value={ch.value}
                onChange={(e) => setCh({ value: e.target.value })}
                placeholder="Value"
                className="h-10 rounded-xl border border-line bg-surface px-3 text-sm text-ink outline-none focus:border-primary/50"
              />
              <input
                value={ch.href}
                onChange={(e) => setCh({ href: e.target.value })}
                placeholder="Link (mailto:/tel:/blank)"
                className="h-10 rounded-xl border border-line bg-surface px-3 text-sm text-ink outline-none focus:border-primary/50"
              />
              <Button size="sm" variant="ghost" onClick={() => set({ channels: value.channels.filter((_, idx) => idx !== i) })}>
                <Trash2 className="size-4" />
              </Button>
            </div>
          );
        })}
        <Button
          size="sm"
          variant="outline"
          onClick={() => set({ channels: [...value.channels, { type: "email", label: "", value: "", href: "" }] })}
        >
          <Plus className="size-4" /> Add channel
        </Button>
      </GlassCard>

      <GlassCard className="space-y-3">
        <SectionTitle>Footer note</SectionTitle>
        <Textarea
          label="Body"
          hint="Markdown supported."
          rows={6}
          value={value.body}
          onChange={(v) => set({ body: v })}
        />
      </GlassCard>
    </div>
  );
}

// ── Help / FAQ editor ──────────────────────────────────────────────────────
function HelpEditor({ value, onChange }: { value: Help; onChange: (v: Help) => void }) {
  const set = (patch: Partial<Help>) => onChange({ ...value, ...patch });

  return (
    <div className="space-y-6">
      <GlassCard className="space-y-4">
        <SectionTitle>Header</SectionTitle>
        <div className="grid gap-3 sm:grid-cols-3">
          <Input name="eyebrow" label="Eyebrow" value={value.eyebrow} onChange={(e) => set({ eyebrow: e.target.value })} />
          <div className="sm:col-span-2">
            <Input name="title" label="Title" value={value.title} onChange={(e) => set({ title: e.target.value })} />
          </div>
        </div>
        <Textarea label="Subtitle" rows={2} value={value.subtitle} onChange={(v) => set({ subtitle: v })} />
      </GlassCard>

      <GlassCard className="space-y-4">
        <SectionTitle>Questions</SectionTitle>
        {value.faqs.map((faq, i) => {
          const setFaq = (patch: Partial<typeof faq>) =>
            set({ faqs: value.faqs.map((f, idx) => (idx === i ? { ...f, ...patch } : f)) });
          return (
            <div key={i} className="space-y-2 rounded-2xl border border-line/70 p-4">
              <div className="flex items-center gap-2">
                <input
                  value={faq.q}
                  onChange={(e) => setFaq({ q: e.target.value })}
                  placeholder="Question"
                  className="h-10 flex-1 rounded-xl border border-line bg-surface px-3 text-sm font-medium text-ink outline-none focus:border-primary/50"
                />
                <Button size="sm" variant="ghost" onClick={() => set({ faqs: value.faqs.filter((_, idx) => idx !== i) })}>
                  <Trash2 className="size-4" />
                </Button>
              </div>
              <Textarea rows={3} value={faq.a} onChange={(v) => setFaq({ a: v })} />
            </div>
          );
        })}
        <Button size="sm" variant="outline" onClick={() => set({ faqs: [...value.faqs, { q: "", a: "" }] })}>
          <Plus className="size-4" /> Add question
        </Button>
      </GlassCard>
    </div>
  );
}

// ── Landing editor helpers ──────────────────────────────────────────────────
function PillTabs<T extends string>({
  tabs,
  active,
  onSelect,
}: {
  tabs: { id: T; label: string }[];
  active: T;
  onSelect: (id: T) => void;
}) {
  return (
    <div className="flex flex-wrap gap-2">
      {tabs.map((t) => (
        <button
          key={t.id}
          onClick={() => onSelect(t.id)}
          className={cn(
            "rounded-pill border px-4 py-1.5 text-sm font-medium transition-colors",
            t.id === active
              ? "border-primary bg-primary/10 text-primary"
              : "border-line text-ink-soft hover:border-primary/40",
          )}
        >
          {t.label}
        </button>
      ))}
    </div>
  );
}

function HeadingFields({
  value,
  onChange,
}: {
  value: { eyebrow: string; title: string; subtitle: string };
  onChange: (patch: Partial<{ eyebrow: string; title: string; subtitle: string }>) => void;
}) {
  return (
    <>
      <div className="grid gap-3 sm:grid-cols-3">
        <Input name="eyebrow" label="Eyebrow" value={value.eyebrow} onChange={(e) => onChange({ eyebrow: e.target.value })} />
        <div className="sm:col-span-2">
          <Input name="title" label="Title" value={value.title} onChange={(e) => onChange({ title: e.target.value })} />
        </div>
      </div>
      <Textarea label="Subtitle" rows={2} value={value.subtitle} onChange={(v) => onChange({ subtitle: v })} />
    </>
  );
}

function StringListEditor({
  label,
  items,
  onChange,
  placeholder,
}: {
  label?: string;
  items: string[];
  onChange: (items: string[]) => void;
  placeholder?: string;
}) {
  return (
    <div>
      {label && <p className="mb-2 text-sm font-medium text-ink">{label}</p>}
      <div className="space-y-2">
        {items.map((item, i) => (
          <div key={i} className="flex items-center gap-2">
            <input
              value={item}
              placeholder={placeholder}
              onChange={(e) => onChange(items.map((x, idx) => (idx === i ? e.target.value : x)))}
              className="h-10 flex-1 rounded-xl border border-line bg-surface px-3 text-sm text-ink outline-none focus:border-primary/50"
            />
            <Button size="sm" variant="ghost" onClick={() => onChange(items.filter((_, idx) => idx !== i))}>
              <Trash2 className="size-4" />
            </Button>
          </div>
        ))}
      </div>
      <Button size="sm" variant="outline" className="mt-2" onClick={() => onChange([...items, ""])}>
        <Plus className="size-4" /> Add
      </Button>
    </div>
  );
}

/** Editor for a list of {title, body} items (steps / reasons). */
function TitleBodyListEditor({
  items,
  onChange,
}: {
  items: { title: string; body: string }[];
  onChange: (items: { title: string; body: string }[]) => void;
}) {
  const setItem = (i: number, patch: Partial<{ title: string; body: string }>) =>
    onChange(items.map((it, idx) => (idx === i ? { ...it, ...patch } : it)));
  return (
    <div className="space-y-3">
      {items.map((it, i) => (
        <div key={i} className="flex items-center gap-2">
          <input
            value={it.title}
            placeholder="Title"
            onChange={(e) => setItem(i, { title: e.target.value })}
            className="h-10 w-1/3 rounded-xl border border-line bg-surface px-3 text-sm font-medium text-ink outline-none focus:border-primary/50"
          />
          <input
            value={it.body}
            placeholder="Description"
            onChange={(e) => setItem(i, { body: e.target.value })}
            className="h-10 flex-1 rounded-xl border border-line bg-surface px-3 text-sm text-ink outline-none focus:border-primary/50"
          />
          <Button size="sm" variant="ghost" onClick={() => onChange(items.filter((_, idx) => idx !== i))}>
            <Trash2 className="size-4" />
          </Button>
        </div>
      ))}
      <Button size="sm" variant="outline" onClick={() => onChange([...items, { title: "", body: "" }])}>
        <Plus className="size-4" /> Add
      </Button>
    </div>
  );
}

function LandingEditor({ value, onChange }: { value: Landing; onChange: (v: Landing) => void }) {
  const [active, setActive] = useState<keyof Landing>("hero");
  const set = <K extends keyof Landing>(key: K, v: Landing[K]) => onChange({ ...value, [key]: v });

  return (
    <div className="space-y-4">
      <PillTabs tabs={LANDING_TABS} active={active} onSelect={setActive} />

      {active === "hero" && (
        <GlassCard className="space-y-4">
          <Input name="badge" label="Badge" value={value.hero.badge} onChange={(e) => set("hero", { ...value.hero, badge: e.target.value })} />
          <Input name="title" label="Headline" value={value.hero.title} onChange={(e) => set("hero", { ...value.hero, title: e.target.value })} />
          <Textarea label="Subtitle" rows={2} value={value.hero.subtitle} onChange={(v) => set("hero", { ...value.hero, subtitle: v })} />
          <div className="grid gap-3 sm:grid-cols-2">
            <Input name="primaryCta" label="Primary button" value={value.hero.primaryCta} onChange={(e) => set("hero", { ...value.hero, primaryCta: e.target.value })} />
            <Input name="secondaryCta" label="Secondary button" value={value.hero.secondaryCta} onChange={(e) => set("hero", { ...value.hero, secondaryCta: e.target.value })} />
          </div>
          <StringListEditor label="Trust indicators (icons are fixed)" items={value.hero.trust} onChange={(trust) => set("hero", { ...value.hero, trust })} />
        </GlassCard>
      )}

      {active === "emotionalStory" && (
        <GlassCard className="space-y-4">
          <Input name="badge" label="Badge" value={value.emotionalStory.badge} onChange={(e) => set("emotionalStory", { ...value.emotionalStory, badge: e.target.value })} />
          <Input name="title" label="Title" value={value.emotionalStory.title} onChange={(e) => set("emotionalStory", { ...value.emotionalStory, title: e.target.value })} />
          <Textarea label="Body" rows={3} value={value.emotionalStory.body} onChange={(v) => set("emotionalStory", { ...value.emotionalStory, body: v })} />
          <Input name="caption" label="Image caption" value={value.emotionalStory.caption} onChange={(e) => set("emotionalStory", { ...value.emotionalStory, caption: e.target.value })} />
          <StringListEditor label="Moments" items={value.emotionalStory.moments} onChange={(moments) => set("emotionalStory", { ...value.emotionalStory, moments })} />
        </GlassCard>
      )}

      {active === "problemSolution" && (
        <GlassCard className="space-y-4">
          <HeadingFields value={value.problemSolution} onChange={(p) => set("problemSolution", { ...value.problemSolution, ...p })} />
          <div className="grid gap-3 sm:grid-cols-2">
            <Input name="oldWayLabel" label="Old-way label" value={value.problemSolution.oldWayLabel} onChange={(e) => set("problemSolution", { ...value.problemSolution, oldWayLabel: e.target.value })} />
            <Input name="newWayLabel" label="New-way label" value={value.problemSolution.newWayLabel} onChange={(e) => set("problemSolution", { ...value.problemSolution, newWayLabel: e.target.value })} />
          </div>
          <StringListEditor label="Problems (the old way)" items={value.problemSolution.problems} onChange={(problems) => set("problemSolution", { ...value.problemSolution, problems })} />
          <StringListEditor label="Solutions (the NexClean way)" items={value.problemSolution.solutions} onChange={(solutions) => set("problemSolution", { ...value.problemSolution, solutions })} />
        </GlassCard>
      )}

      {active === "howItWorks" && (
        <GlassCard className="space-y-4">
          <HeadingFields value={value.howItWorks} onChange={(p) => set("howItWorks", { ...value.howItWorks, ...p })} />
          <p className="text-sm font-medium text-ink">Steps (icons are fixed by position)</p>
          <TitleBodyListEditor items={value.howItWorks.steps} onChange={(steps) => set("howItWorks", { ...value.howItWorks, steps })} />
        </GlassCard>
      )}

      {active === "vehicleCategories" && (
        <GlassCard className="space-y-4">
          <HeadingFields value={value.vehicleCategories} onChange={(p) => set("vehicleCategories", { ...value.vehicleCategories, ...p })} />
          <p className="text-xs text-muted">The vehicle cards & prices come from your Pricing settings.</p>
        </GlassCard>
      )}

      {active === "smartAreaAlert" && (
        <GlassCard className="space-y-4">
          <Input name="badge" label="Badge" value={value.smartAreaAlert.badge} onChange={(e) => set("smartAreaAlert", { ...value.smartAreaAlert, badge: e.target.value })} />
          <Input name="title" label="Title" value={value.smartAreaAlert.title} onChange={(e) => set("smartAreaAlert", { ...value.smartAreaAlert, title: e.target.value })} />
          <Textarea label="Body" rows={3} value={value.smartAreaAlert.body} onChange={(v) => set("smartAreaAlert", { ...value.smartAreaAlert, body: v })} />
          <StringListEditor label="Feature bullets" items={value.smartAreaAlert.features} onChange={(features) => set("smartAreaAlert", { ...value.smartAreaAlert, features })} />
        </GlassCard>
      )}

      {active === "whyChoose" && (
        <GlassCard className="space-y-4">
          <HeadingFields value={value.whyChoose} onChange={(p) => set("whyChoose", { ...value.whyChoose, ...p })} />
          <p className="text-sm font-medium text-ink">Reasons (icons are fixed by position)</p>
          <TitleBodyListEditor items={value.whyChoose.reasons} onChange={(reasons) => set("whyChoose", { ...value.whyChoose, reasons })} />
        </GlassCard>
      )}

      {active === "subscriptions" && (
        <GlassCard className="space-y-4">
          <HeadingFields value={value.subscriptions} onChange={(p) => set("subscriptions", { ...value.subscriptions, ...p })} />
          <Input name="footnote" label="Footnote" value={value.subscriptions.footnote} onChange={(e) => set("subscriptions", { ...value.subscriptions, footnote: e.target.value })} />
          <p className="text-xs text-muted">The plan cards & prices come from your Plans settings.</p>
        </GlassCard>
      )}

      {active === "appShowcase" && (
        <GlassCard className="space-y-4">
          <Input name="badge" label="Badge" value={value.appShowcase.badge} onChange={(e) => set("appShowcase", { ...value.appShowcase, badge: e.target.value })} />
          <Input name="title" label="Title" value={value.appShowcase.title} onChange={(e) => set("appShowcase", { ...value.appShowcase, title: e.target.value })} />
          <Textarea label="Body" rows={2} value={value.appShowcase.body} onChange={(v) => set("appShowcase", { ...value.appShowcase, body: v })} />
          <StringListEditor label="Feature pills (icons are fixed)" items={value.appShowcase.features} onChange={(features) => set("appShowcase", { ...value.appShowcase, features })} />
        </GlassCard>
      )}

      {active === "testimonials" && (
        <GlassCard className="space-y-4">
          <HeadingFields value={value.testimonials} onChange={(p) => set("testimonials", { ...value.testimonials, ...p })} />
          <p className="text-sm font-medium text-ink">Reviews</p>
          {value.testimonials.reviews.map((r, i) => {
            const setR = (patch: Partial<typeof r>) =>
              set("testimonials", {
                ...value.testimonials,
                reviews: value.testimonials.reviews.map((x, idx) => (idx === i ? { ...x, ...patch } : x)),
              });
            return (
              <div key={i} className="space-y-2 rounded-2xl border border-line/70 p-4">
                <div className="grid gap-2 sm:grid-cols-[1fr_1fr_5rem_auto]">
                  <input value={r.name} placeholder="Name" onChange={(e) => setR({ name: e.target.value })} className="h-10 rounded-xl border border-line bg-surface px-3 text-sm text-ink outline-none focus:border-primary/50" />
                  <input value={r.role} placeholder="Role" onChange={(e) => setR({ role: e.target.value })} className="h-10 rounded-xl border border-line bg-surface px-3 text-sm text-ink outline-none focus:border-primary/50" />
                  <input value={r.initials} placeholder="Initials" onChange={(e) => setR({ initials: e.target.value })} className="h-10 rounded-xl border border-line bg-surface px-3 text-sm text-ink outline-none focus:border-primary/50" />
                  <Button size="sm" variant="ghost" onClick={() => set("testimonials", { ...value.testimonials, reviews: value.testimonials.reviews.filter((_, idx) => idx !== i) })}>
                    <Trash2 className="size-4" />
                  </Button>
                </div>
                <Textarea rows={2} value={r.quote} onChange={(v) => setR({ quote: v })} />
              </div>
            );
          })}
          <Button size="sm" variant="outline" onClick={() => set("testimonials", { ...value.testimonials, reviews: [...value.testimonials.reviews, { name: "", role: "", initials: "", quote: "" }] })}>
            <Plus className="size-4" /> Add review
          </Button>
        </GlassCard>
      )}

      {active === "stats" && (
        <GlassCard className="space-y-3">
          <p className="text-sm font-medium text-ink">Stats</p>
          {value.stats.items.map((s, i) => {
            const setS = (patch: Partial<typeof s>) =>
              set("stats", { items: value.stats.items.map((x, idx) => (idx === i ? { ...x, ...patch } : x)) });
            return (
              <div key={i} className="grid items-end gap-2 sm:grid-cols-[1fr_5rem_5rem_1.5fr_auto]">
                <label className="text-sm">
                  <span className="mb-1 block text-xs text-muted">Value</span>
                  <input type="number" value={s.value} onChange={(e) => setS({ value: Number(e.target.value) || 0 })} className="h-10 w-full rounded-xl border border-line bg-surface px-3 text-sm text-ink outline-none focus:border-primary/50" />
                </label>
                <label className="text-sm">
                  <span className="mb-1 block text-xs text-muted">Decimals</span>
                  <input type="number" value={s.decimals ?? 0} onChange={(e) => setS({ decimals: Number(e.target.value) || 0 })} className="h-10 w-full rounded-xl border border-line bg-surface px-3 text-sm text-ink outline-none focus:border-primary/50" />
                </label>
                <label className="text-sm">
                  <span className="mb-1 block text-xs text-muted">Suffix</span>
                  <input value={s.suffix} onChange={(e) => setS({ suffix: e.target.value })} className="h-10 w-full rounded-xl border border-line bg-surface px-3 text-sm text-ink outline-none focus:border-primary/50" />
                </label>
                <label className="text-sm">
                  <span className="mb-1 block text-xs text-muted">Label</span>
                  <input value={s.label} onChange={(e) => setS({ label: e.target.value })} className="h-10 w-full rounded-xl border border-line bg-surface px-3 text-sm text-ink outline-none focus:border-primary/50" />
                </label>
                <Button size="sm" variant="ghost" onClick={() => set("stats", { items: value.stats.items.filter((_, idx) => idx !== i) })}>
                  <Trash2 className="size-4" />
                </Button>
              </div>
            );
          })}
          <Button size="sm" variant="outline" onClick={() => set("stats", { items: [...value.stats.items, { value: 0, suffix: "+", label: "" }] })}>
            <Plus className="size-4" /> Add stat
          </Button>
        </GlassCard>
      )}

      {active === "finalCta" && (
        <GlassCard className="space-y-4">
          <Input name="title" label="Title" value={value.finalCta.title} onChange={(e) => set("finalCta", { ...value.finalCta, title: e.target.value })} />
          <Textarea label="Body" rows={2} value={value.finalCta.body} onChange={(v) => set("finalCta", { ...value.finalCta, body: v })} />
          <div className="grid gap-3 sm:grid-cols-2">
            <Input name="primaryCta" label="Primary button" value={value.finalCta.primaryCta} onChange={(e) => set("finalCta", { ...value.finalCta, primaryCta: e.target.value })} />
            <Input name="secondaryCta" label="Secondary button" value={value.finalCta.secondaryCta} onChange={(e) => set("finalCta", { ...value.finalCta, secondaryCta: e.target.value })} />
          </div>
        </GlassCard>
      )}
    </div>
  );
}

function ContentEditor({ initial }: { initial: SiteContent }) {
  const update = useUpdateContent();
  const [draft, setDraft] = useState<SiteContent>(initial);
  const [tab, setTab] = useState<TabId>("footer");
  const [saved, setSaved] = useState(false);

  const save = () => {
    setSaved(false);
    update.mutate(draft, { onSuccess: () => setSaved(true) });
  };

  return (
    <div className="space-y-6">
      <div className="flex items-start justify-between gap-4">
        <div>
          <h1 className="font-display text-3xl text-ink">Content</h1>
          <p className="mt-1 text-muted">Edit the footer and public pages of the marketing site.</p>
        </div>
        <div className="flex items-center gap-3">
          {saved && !update.isPending && <span className="text-sm text-emerald-600">Saved</span>}
          <Button onClick={save} disabled={update.isPending}>
            <Check className="size-4" /> {update.isPending ? "Saving…" : "Save changes"}
          </Button>
        </div>
      </div>

      <div className="flex flex-wrap gap-2 border-b border-line/70 pb-3">
        {TABS.map((t) => (
          <button
            key={t.id}
            onClick={() => setTab(t.id)}
            className={cn(
              "rounded-xl px-4 py-2 text-sm font-medium transition-colors",
              t.id === tab ? "bg-primary/10 text-primary" : "text-ink-soft hover:bg-surface-muted hover:text-ink",
            )}
          >
            {t.label}
          </button>
        ))}
      </div>

      {tab === "footer" && (
        <FooterEditor value={draft.footer} onChange={(footer) => setDraft((d) => ({ ...d, footer }))} />
      )}
      {tab === "pages" && (
        <PagesEditor value={draft.pages} onChange={(pages) => setDraft((d) => ({ ...d, pages }))} />
      )}
      {tab === "landing" && (
        <LandingEditor value={draft.landing} onChange={(landing) => setDraft((d) => ({ ...d, landing }))} />
      )}
      {tab === "contact" && (
        <ContactEditor value={draft.contact} onChange={(contact) => setDraft((d) => ({ ...d, contact }))} />
      )}
      {tab === "help" && <HelpEditor value={draft.help} onChange={(help) => setDraft((d) => ({ ...d, help }))} />}
    </div>
  );
}

export function ContentManagement() {
  const { data, isLoading, isError, refetch, isRefetching } = useContent();

  if (isError) {
    return (
      <div className="space-y-6">
        <div>
          <h1 className="font-display text-3xl text-ink">Content</h1>
          <p className="mt-1 text-muted">Edit the footer and public pages of the marketing site.</p>
        </div>
        <GlassCard className="flex flex-col items-center gap-3 py-16 text-center">
          <span className="grid size-12 place-items-center rounded-2xl bg-red-500/10 text-red-500">
            <AlertTriangle className="size-6" />
          </span>
          <p className="font-display text-lg font-semibold text-ink">Couldn't load content</p>
          <p className="max-w-sm text-sm text-muted">
            The content service didn't respond. Check that the API is reachable, then try again.
          </p>
          <Button variant="outline" size="sm" disabled={isRefetching} onClick={() => refetch()}>
            <RefreshCw className="size-4" /> {isRefetching ? "Retrying…" : "Retry"}
          </Button>
        </GlassCard>
      </div>
    );
  }

  if (isLoading || !data) {
    return (
      <div className="space-y-6">
        <div>
          <h1 className="font-display text-3xl text-ink">Content</h1>
          <p className="mt-1 text-muted">Edit the footer and public pages of the marketing site.</p>
        </div>
        <div className="flex flex-wrap gap-2 border-b border-line/70 pb-3">
          {Array.from({ length: 5 }).map((_, i) => (
            <Skeleton key={i} className="h-9 w-24" />
          ))}
        </div>
        <GlassCard className="space-y-4">
          <Skeleton className="h-5 w-32" />
          <SkeletonText lines={3} />
        </GlassCard>
      </div>
    );
  }

  return <ContentEditor initial={data} />;
}
