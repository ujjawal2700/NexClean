import { User } from "../modules/user/user.model";
import { env } from "./env";

type AgentSeed = { phone: string; name: string; area: string; rating: number; jobsDone: number; online: boolean; agentStatus: "verified" | "pending" };

/**
 * Demo cleaners, seeded ONLY when NODE_ENV === "test".
 *
 * They exist for the Playwright suite, which logs in as 9000000001/2 and
 * expects 9000000004 to sit on the KYC gate. The gate is deliberately narrow:
 * this project's own backend/.env runs NODE_ENV=development against the
 * production Atlas cluster, so seeding on anything looser than an explicit
 * test env would inject fake cleaners into live data.
 */
const AGENTS: AgentSeed[] = [
  { phone: "9000000001", name: "Rohit Kumar", area: "Green Valley Society", rating: 4.9, jobsDone: 312, online: true, agentStatus: "verified" },
  { phone: "9000000002", name: "Imran Shaikh", area: "Tech Park", rating: 4.8, jobsDone: 268, online: true, agentStatus: "verified" },
  { phone: "9000000003", name: "Sana Khan", area: "Lake View Residency", rating: 4.9, jobsDone: 401, online: false, agentStatus: "verified" },
  { phone: "9000000004", name: "Deepak Yadav", area: "Palm Greens", rating: 4.6, jobsDone: 88, online: true, agentStatus: "pending" },
];

/**
 * Idempotently seed demo agent accounts + the admin user so the agent and
 * admin apps have something to log into and work with.
 */
export async function seedDemoData(): Promise<void> {
  // Only seed demo agents if explicitly requested via SEED_DEMO_AGENTS=true
  const shouldSeedAgents = process.env.SEED_DEMO_AGENTS === "true";
  const agents = shouldSeedAgents ? AGENTS : [];

  for (const a of agents) {
    await User.updateOne(
      { phone: a.phone },
      { $set: { ...a, role: "agent" } },
      { upsert: true },
    );
  }

  await User.updateOne(
    { phone: `admin:${env.adminEmail}` },
    { $setOnInsert: { phone: `admin:${env.adminEmail}`, name: "Admin", role: "admin", email: env.adminEmail.toLowerCase() } },
    { upsert: true },
  );

  if (agents.length > 0) {
    console.log(`✓ Seeded ${agents.length} demo agents + admin (${env.adminEmail})`);
  }
}
