/**
 * IFSC branch lookup, for resolving an agent's bank branch/address from the
 * code they type — see modules/user/bankAccount.service.ts.
 */

export type IfscBranch = {
  bank: string;
  ifsc: string;
  branch: string;
  address: string;
  city?: string;
  state?: string;
};

/**
 * Look up a bank branch by IFSC code.
 *
 * Backed by Razorpay's free, keyless IFSC API (https://ifsc.razorpay.com),
 * which mirrors the RBI's own IFSC master — the standard, no-signup way to
 * do this lookup server-side. Returns null for an unknown/malformed code or
 * a network failure rather than throwing, so the caller (which already knows
 * what it's trying to do — validate, or autofill) decides how to phrase it.
 */
export async function lookupIfsc(code: string): Promise<IfscBranch | null> {
  const ifsc = code.trim().toUpperCase();
  try {
    const res = await fetch(`https://ifsc.razorpay.com/${encodeURIComponent(ifsc)}`, {
      // Never let a slow/unreachable upstream hang a bank-account save.
      signal: AbortSignal.timeout(5_000),
    });
    if (!res.ok) return null; // 404 for an unknown code
    const data = (await res.json()) as Record<string, unknown>;
    if (!data?.IFSC || !data.BANK || !data.BRANCH) return null;
    return {
      bank: String(data.BANK),
      ifsc: String(data.IFSC),
      branch: String(data.BRANCH),
      address: String(data.ADDRESS ?? ""),
      city: data.CITY ? String(data.CITY) : undefined,
      state: data.STATE ? String(data.STATE) : undefined,
    };
  } catch (err) {
    console.error("[ifsc] lookup failed:", (err as Error).message);
    return null;
  }
}
