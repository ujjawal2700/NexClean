import { env } from "../../config/env";

/**
 * Is this the designated super-admin account?
 *
 * One definition, used by the permission middleware AND by the two places that
 * report permissions back to the client. They had drifted: the middleware
 * matched only the synthetic `admin:<email>` phone, while adminLogin/getMe also
 * treated *any* admin without a role as a super admin. The result was an admin
 * console that rendered every menu and then got 403 on every request behind it.
 *
 * Identity is the ADMIN_EMAIL address, since that is what adminLogin()
 * authenticates against. The `admin:<email>` phone is still accepted because
 * that is what seed.ts writes.
 *
 * Note what is deliberately absent: "has no role assigned" does not make
 * someone a super admin. That fails open — a staff account whose role was
 * deleted would silently inherit everything.
 */
export function isSuperAdmin(user: { phone?: string | null; email?: string | null }): boolean {
  const designated = env.adminEmail.trim().toLowerCase();
  if (!designated) return false;
  if (user.phone === `admin:${env.adminEmail}`) return true;
  return (user.email ?? "").trim().toLowerCase() === designated;
}
