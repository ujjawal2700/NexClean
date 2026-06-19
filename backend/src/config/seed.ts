import { User } from "../modules/user/user.model";
import { env } from "./env";

type AgentSeed = { phone: string; name: string; area: string; rating: number; jobsDone: number; online: boolean; agentStatus: "verified" | "pending" };

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
  for (const a of AGENTS) {
    await User.updateOne(
      { phone: a.phone },
      { $setOnInsert: { ...a, role: "agent" } },
      { upsert: true },
    );
  }

  await User.updateOne(
    { phone: `admin:${env.adminEmail}` },
    { $setOnInsert: { phone: `admin:${env.adminEmail}`, name: "Admin", role: "admin" } },
    { upsert: true },
  );

  console.log(`✓ Seeded ${AGENTS.length} demo agents + admin (${env.adminEmail})`);
}
