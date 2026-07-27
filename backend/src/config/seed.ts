import { User } from "../modules/user/user.model";
import { env } from "./env";

type AgentSeed = { phone: string; name: string; area: string; rating: number; jobsDone: number; online: boolean; agentStatus: "verified" | "pending" };

const AGENTS: AgentSeed[] = [];

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
    { $setOnInsert: { phone: `admin:${env.adminEmail}`, name: "Admin", role: "admin", email: env.adminEmail.toLowerCase() } },
    { upsert: true },
  );

  console.log(`✓ Seeded ${AGENTS.length} demo agents + admin (${env.adminEmail})`);
}
