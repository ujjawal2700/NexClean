/**
 * Ready-made review text for the "Suggest review" button, matched to the
 * stars the customer picked and personalised with the cleaner's name, the
 * package and the car. Generated on the device — no network call, works
 * offline — and the customer can edit it freely before submitting.
 */
type Ctx = { agent: string; pkg: string; car: string };

const TEMPLATES: Record<1 | 2 | 3 | 4 | 5, ((c: Ctx) => string)[]> = {
  5: [
    (c) => `${c.agent} did an outstanding job on my ${c.car}! The ${c.pkg} left it spotless inside and out. Punctual, polite and very thorough. Highly recommended!`,
    (c) => `Absolutely loved the ${c.pkg}. ${c.agent} was professional, on time and paid attention to every detail. My ${c.car} looks brand new!`,
    (c) => `Excellent service from ${c.agent}. Quick, careful and the before/after difference on my ${c.car} is amazing. Will definitely book again.`,
    (c) => `Five stars! ${c.agent} was friendly and extremely thorough — my ${c.car} hasn't looked this clean in ages. Great value for the ${c.pkg}.`,
  ],
  4: [
    (c) => `Very good ${c.pkg}. ${c.agent} was polite and did a neat job on my ${c.car}. Just a couple of small spots could have been better.`,
    (c) => `${c.agent} did a great job overall — my ${c.car} looks really clean. Arrived on time and was courteous. Small room for improvement on the details.`,
    (c) => `Happy with the service. The ${c.pkg} was done well and ${c.agent} was professional. Would book again.`,
  ],
  3: [
    (c) => `The ${c.pkg} was okay. ${c.agent} cleaned my ${c.car} decently, but some areas were missed and it could have been more thorough.`,
    (c) => `Average experience. ${c.agent} was polite, but the finish on my ${c.car} wasn't quite what I expected from the ${c.pkg}.`,
    (c) => `Decent job, nothing special. A few spots on my ${c.car} needed another pass.`,
  ],
  2: [
    (c) => `Not satisfied with the ${c.pkg}. Several parts of my ${c.car} were still dirty and the job felt rushed.`,
    (c) => `Below expectations. ${c.agent} finished quickly but missed quite a few areas on my ${c.car}.`,
    (c) => `The cleaning quality was poor for the price. My ${c.car} needed more care than it got.`,
  ],
  1: [
    (c) => `Very disappointed with the ${c.pkg}. My ${c.car} was hardly cleaner than before. This needs serious improvement.`,
    (c) => `Poor service. The job on my ${c.car} was incomplete and not up to the standard I expected.`,
    (c) => `Unhappy with this wash — most of my ${c.car} was left dirty. I expected much better.`,
  ],
};

/** "Rohit Kumar" → "Rohit". */
function firstName(name: string | null | undefined): string {
  return (name ?? "").trim().split(/\s+/)[0] || "The specialist";
}

/**
 * The `attempt`-th suggestion for this star count. Pass an increasing
 * attempt to cycle through different wordings each tap.
 */
export function suggestReview(
  stars: number,
  ctx: { agentName?: string | null; packageName?: string | null; vehicleName?: string | null },
  attempt = 0,
): string {
  const level = Math.min(5, Math.max(1, Math.round(stars))) as 1 | 2 | 3 | 4 | 5;
  const list = TEMPLATES[level];
  return list[attempt % list.length]({
    agent: firstName(ctx.agentName),
    pkg: ctx.packageName?.trim() || "service",
    car: ctx.vehicleName?.trim() || "car",
  });
}
