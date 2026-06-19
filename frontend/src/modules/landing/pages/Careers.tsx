import { Link } from "react-router-dom";
import { Mail } from "lucide-react";
import { StaticPageShell } from "../components/StaticPageShell";

export function Careers() {
  return (
    <StaticPageShell
      eyebrow="Careers"
      title="Help us build the future of car care."
      subtitle="We're a small team moving fast — and we're always looking to talk to people who care about craft, reliability, and good design."
    >
      <h2>Open roles</h2>
      <p>
        We don't have specific openings posted right now, but we're growing across engineering,
        operations, and city launches. If you think you'd be a strong fit for NexClean, we'd still
        like to hear from you.
      </p>

      <h2>Get in touch</h2>
      <p>
        Send us a note with what you're interested in and a bit about yourself — no formal
        application needed.
      </p>
      <p>
        <a href="mailto:careers@nexclean.in" className="inline-flex items-center gap-2">
          <Mail className="size-4" /> careers@nexclean.in
        </a>
      </p>

      <h2>Become an agent instead?</h2>
      <p>
        If you're looking to clean vehicles on NexClean as a service specialist rather than join
        our core team, head to <Link to="/agent/signup">agent sign-up</Link> instead.
      </p>
    </StaticPageShell>
  );
}
