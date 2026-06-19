import { StaticPageShell } from "../components/StaticPageShell";

export function About() {
  return (
    <StaticPageShell
      eyebrow="About NexClean"
      title="Premium car care, brought to your doorstep."
      subtitle="We started NexClean because washing your own car — or driving across town for a wash — shouldn't be the cost of keeping it looking great."
    >
      <h2>Our story</h2>
      <p>
        NexClean began with a simple frustration: great car care meant either spending a weekend
        morning doing it yourself, or driving to a service center and waiting around. We built a
        platform where certified specialists come to you instead — at home, at the office, or
        wherever you've parked — and your car gets the same premium treatment without the detour.
      </p>

      <h2>What we believe</h2>
      <p>
        Convenience shouldn't mean compromise. Every specialist on NexClean is vetted and trained,
        every booking is tracked end-to-end, and every plan is built to fit how often you actually
        drive — not a one-size-fits-all schedule.
      </p>

      <h2>Where we're headed</h2>
      <p>
        We're expanding city by city, building tools like NexClean Nearby so specialists already in
        your area can reach you faster, and investing in the parts of the experience customers
        notice most: reliability, transparency, and a team that shows up on time.
      </p>
    </StaticPageShell>
  );
}
