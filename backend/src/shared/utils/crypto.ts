import crypto from "crypto";

/**
 * Hash a password using Node's built-in crypto module.
 * pbkdf2Sync is highly secure, fast, and does not require native dependency compilation.
 */
export function hashPassword(password: string): string {
  const salt = crypto.randomBytes(16).toString("hex");
  const hash = crypto.pbkdf2Sync(password, salt, 1000, 64, "sha512").toString("hex");
  return `${salt}:${hash}`;
}

/**
 * Verify a password against a stored hashed password.
 */
export function verifyPassword(password: string, stored: string): boolean {
  if (!stored || !stored.includes(":")) {
    return false;
  }
  const [salt, hash] = stored.split(":");
  const testHash = crypto.pbkdf2Sync(password, salt, 1000, 64, "sha512").toString("hex");
  return hash === testHash;
}
