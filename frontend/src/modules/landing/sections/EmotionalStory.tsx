import { Section } from "@shared/components/layout/Section";
import { Badge } from "@shared/ui/Badge";
import { ImageSlot } from "@shared/components/visual/ImageSlot";
import { SplitReveal } from "@shared/motion/SplitReveal";
import { Reveal } from "@shared/motion/Reveal";
import { useSiteContent } from "@shared/hooks/useSiteContent";
import emotionalStoryArt from "@/assets/emotional-story.webp";

export function EmotionalStory() {
  const { emotionalStory: c } = useSiteContent().landing;
  return (
    <Section id="story" className="overflow-hidden">
      <div className="grid items-center gap-14 lg:grid-cols-2">
        {/* Image */}
        <Reveal>
          <div className="relative">
            <div className="aspect-[4/5] w-full">
              <ImageSlot
                src={emotionalStoryArt}
                alt="Soft indigo and cyan light, like a reflection caught on a freshly cleaned car"
                label="Lifestyle photo · owner with their car"
                className="h-full"
              />
            </div>
            <div className="glass absolute -bottom-6 -right-4 max-w-[15rem] rounded-card p-5 shadow-(--shadow-lift) sm:right-6">
              <p className="text-sm leading-relaxed text-ink">{c.caption}</p>
            </div>
          </div>
        </Reveal>

        {/* Copy */}
        <div className="lg:pl-6">
          <Reveal>
            <Badge>{c.badge}</Badge>
          </Reveal>
          <SplitReveal
            onScroll
            as="h2"
            text={c.title}
            className="mt-5 max-w-[16ch] text-4xl text-ink sm:text-5xl"
          />
          <Reveal delay={0.1}>
            <p className="mt-6 max-w-md text-lg text-muted">{c.body}</p>
          </Reveal>

          <Reveal delay={0.2}>
            <div className="mt-8 flex flex-wrap gap-2.5">
              {c.moments.map((m) => (
                <span
                  key={m}
                  className="rounded-pill border border-line bg-surface/70 px-4 py-2 text-sm font-medium text-ink-soft"
                >
                  {m}
                </span>
              ))}
            </div>
          </Reveal>
        </div>
      </div>
    </Section>
  );
}
