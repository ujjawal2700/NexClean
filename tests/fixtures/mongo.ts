import { execFileSync } from "node:child_process";
import { existsSync } from "node:fs";

/**
 * Run a snippet against the disposable local test database.
 *
 * Some states cannot be reached through the API by design — a verified gateway
 * payment being the obvious one, since the whole point is that only Razorpay can
 * mint them. Seeding the row directly lets the *verification* path be exercised
 * for real rather than left untested because the happy path is unreachable.
 *
 * Only ever points at `nexclean-test`, which run-all.sh drops before every run.
 */
function resolveMongosh(): string {
  const candidates = [
    process.env.MONGOSH_PATH,
    "/opt/homebrew/bin/mongosh",
    "/usr/local/bin/mongosh",
  ].filter(Boolean) as string[];
  for (const candidate of candidates) {
    if (existsSync(candidate)) return candidate;
  }
  return "mongosh";
}

export function mongoEval(script: string): string {
  return execFileSync(
    resolveMongosh(),
    ["mongodb://127.0.0.1:27017/nexclean-test", "--quiet", "--eval", script],
    // stdin must be "ignore": mongosh is itself a Node CLI, and a closed pipe on
    // fd 0 leaves the calling Playwright worker exiting non-zero even when every
    // test passed.
    { stdio: ["ignore", "pipe", "pipe"], encoding: "utf8" },
  ).trim();
}
