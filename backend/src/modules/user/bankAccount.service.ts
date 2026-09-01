import { User } from "./user.model";
import { ApiError } from "../../shared/utils/ApiError";
import { lookupIfsc, type IfscBranch } from "../../shared/services/ifsc";

/** Standard 11-character IFSC shape: 4 letters, a literal 0, 6 alphanumerics. */
const IFSC_RE = /^[A-Z]{4}0[A-Z0-9]{6}$/;

/**
 * Validate an IFSC code and resolve its branch + address.
 *
 * Used both for the agent app's "fetch branch" live lookup while typing, and
 * again inside `saveBankAccount` — never trust a branch/address the client
 * displayed earlier; re-resolve it against the code being saved.
 */
export async function verifyIfsc(code: string): Promise<IfscBranch> {
  const ifsc = (code ?? "").trim().toUpperCase();
  if (!IFSC_RE.test(ifsc)) {
    throw ApiError.badRequest("Enter a valid 11-character IFSC code (e.g. HDFC0001234)");
  }
  const branch = await lookupIfsc(ifsc);
  if (!branch) {
    throw ApiError.badRequest("We couldn't find a bank branch for that IFSC code");
  }
  return branch;
}

export type BankAccount = {
  holderName: string;
  bankName: string;
  accountNumber: string;
  ifsc: string;
  branch: string;
  address: string;
  verifiedAt: string;
};

/** The agent's own bank account, or null when nothing has been saved yet. */
export async function getBankAccount(agentId: string): Promise<BankAccount | null> {
  const agent = await User.findById(agentId).select("bankAccount").lean();
  return (agent?.bankAccount as unknown as BankAccount | undefined) ?? null;
}

export async function saveBankAccount(
  agentId: string,
  input: {
    holderName: string;
    bankName: string;
    accountNumber: string;
    confirmAccountNumber: string;
    ifsc: string;
  },
): Promise<BankAccount> {
  const holderName = (input.holderName ?? "").trim();
  const bankName = (input.bankName ?? "").trim();
  const accountNumber = (input.accountNumber ?? "").trim();
  const confirmAccountNumber = (input.confirmAccountNumber ?? "").trim();

  if (holderName.length < 2) throw ApiError.badRequest("Enter the account holder's name");
  if (bankName.length < 2) throw ApiError.badRequest("Enter the bank's name");
  // Indian account numbers run 9–18 digits depending on the bank; this is the
  // widely-used sanity range rather than any one bank's exact rule.
  if (!/^\d{9,18}$/.test(accountNumber)) {
    throw ApiError.badRequest("Enter a valid account number (9–18 digits, no spaces)");
  }
  if (accountNumber !== confirmAccountNumber) {
    throw ApiError.badRequest("Account numbers don't match");
  }

  // The branch and address are never taken from the client — only what the
  // IFSC itself resolves to right now is trustworthy.
  const resolved = await verifyIfsc(input.ifsc);

  const bankAccount: BankAccount = {
    holderName,
    bankName,
    accountNumber,
    ifsc: resolved.ifsc,
    branch: resolved.branch,
    address: resolved.address,
    verifiedAt: new Date().toISOString(),
  };

  await User.updateOne({ _id: agentId }, { bankAccount });
  return bankAccount;
}
