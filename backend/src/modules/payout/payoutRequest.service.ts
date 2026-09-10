import { Types } from "mongoose";
import { Booking } from "../booking/booking.model";
import { User } from "../user/user.model";
import { PayoutRequest, type PayoutRequestDocument } from "./payoutRequest.model";
import { ApiError } from "../../shared/utils/ApiError";
import { notifyUser } from "../notification/notification.service";
import { emitToAdmins } from "../../shared/services/socket";

/** `₹1,234` for the error/notification strings below. */
function formatMoney(amount: number): string {
  return `₹${Math.round(amount).toLocaleString("en-IN")}`;
}

/** Minimum a single payout request can be for — keeps a request worth an admin's time to process. */
const MIN_PAYOUT_AMOUNT = 100;

/** Everything a completed job ever paid this agent — the ceiling `available` is measured against. */
async function totalEarned(agentId: string): Promise<number> {
  const [row] = await Booking.aggregate<{ total: number }>([
    { $match: { assignedAgent: new Types.ObjectId(agentId), jobStatus: "completed" } },
    { $group: { _id: null, total: { $sum: { $ifNull: ["$agentPayout", 0] } } } },
  ]);
  return row?.total ?? 0;
}

/** Mask everything but the last 4 digits — the agent viewing their own history knows the rest. */
function maskAccountNumber(accountNumber: string): string {
  const last4 = accountNumber.slice(-4);
  return `••••${last4}`;
}

function toAgentView(r: PayoutRequestDocument) {
  const json = r.toJSON() as Record<string, unknown>;
  const snapshot = json.bankSnapshot as { accountNumber: string } & Record<string, unknown>;
  return {
    ...json,
    bankSnapshot: { ...snapshot, accountNumber: maskAccountNumber(snapshot.accountNumber) },
  };
}

export type WalletSummary = {
  totalEarned: number;
  reserved: number;
  available: number;
  requests: ReturnType<typeof toAgentView>[];
};

/**
 * What an agent has earned, how much of it is already spoken for (a request
 * still open, or already paid), and what's left to request. A rejected
 * request releases its amount back to `available` — it's the only status
 * that doesn't count against the ceiling.
 */
export async function getWalletSummary(agentId: string): Promise<WalletSummary> {
  const [earned, requests] = await Promise.all([
    totalEarned(agentId),
    PayoutRequest.find({ agent: agentId }).sort({ createdAt: -1 }),
  ]);

  const reserved = requests
    .filter((r) => r.status !== "rejected")
    .reduce((sum, r) => sum + r.amount, 0);

  return {
    totalEarned: earned,
    reserved,
    available: Math.max(0, earned - reserved),
    requests: requests.map(toAgentView),
  };
}

/** Agent-initiated: ask to cash out `amount` of their available balance. */
export async function createPayoutRequest(agentId: string, amount: number) {
  if (!Number.isFinite(amount) || amount < MIN_PAYOUT_AMOUNT) {
    throw ApiError.badRequest(`Minimum payout request is ${formatMoney(MIN_PAYOUT_AMOUNT)}`);
  }

  const agent = await User.findById(agentId).select("name bankAccount");
  if (!agent) throw ApiError.notFound("Agent not found");
  if (!agent.bankAccount?.ifsc) {
    throw ApiError.badRequest("Add your bank account details before requesting a payout");
  }

  const { available } = await getWalletSummary(agentId);
  if (amount > available) {
    throw ApiError.badRequest(`You can request up to ${formatMoney(available)} right now`);
  }

  const request = await PayoutRequest.create({
    agent: agentId,
    amount,
    status: "pending",
    bankSnapshot: {
      holderName: agent.bankAccount.holderName,
      bankName: agent.bankAccount.bankName,
      accountNumber: agent.bankAccount.accountNumber,
      ifsc: agent.bankAccount.ifsc,
      branch: agent.bankAccount.branch,
    },
  });

  emitToAdmins("payout_request_created", {
    id: String(request._id),
    agentId,
    agentName: agent.name,
    amount,
  });

  return toAgentView(request);
}

/* ------------------------------ admin side -------------------------------- */

export async function listAllPayoutRequests(status?: string) {
  const filter = status ? { status } : {};
  const requests = await PayoutRequest.find(filter).populate("agent", "name phone").sort({ createdAt: -1 });
  return requests.map((r) => r.toJSON());
}

async function getRequestOrThrow(id: string): Promise<PayoutRequestDocument> {
  const request = await PayoutRequest.findById(id);
  if (!request) throw ApiError.notFound("Payout request not found");
  return request;
}

export async function approvePayoutRequest(id: string, adminId: string) {
  const request = await getRequestOrThrow(id);
  if (request.status !== "pending") throw ApiError.badRequest("Only a pending request can be approved");

  request.status = "approved";
  request.set("processedBy", adminId);
  request.processedAt = new Date();
  await request.save();

  void notifyUser(String(request.agent), {
    type: "system",
    title: "✅ Payout approved",
    body: `Your payout request of ${formatMoney(request.amount)} was approved and will be paid out shortly.`,
  }).catch((err) => console.error("payout approval notification failed:", (err as Error).message));

  return request.toJSON();
}

export async function rejectPayoutRequest(id: string, adminId: string, reason: string) {
  const request = await getRequestOrThrow(id);
  if (request.status !== "pending" && request.status !== "approved") {
    throw ApiError.badRequest("This request has already been settled");
  }

  request.status = "rejected";
  request.rejectionReason = reason?.trim() || "";
  request.set("processedBy", adminId);
  request.processedAt = new Date();
  await request.save();

  void notifyUser(String(request.agent), {
    type: "system",
    title: "❌ Payout request declined",
    body: request.rejectionReason
      ? `Your payout request of ${formatMoney(request.amount)} was declined: ${request.rejectionReason}`
      : `Your payout request of ${formatMoney(request.amount)} was declined.`,
  }).catch((err) => console.error("payout rejection notification failed:", (err as Error).message));

  return request.toJSON();
}

export async function markPayoutRequestPaid(id: string, adminId: string, transactionRef?: string) {
  const request = await getRequestOrThrow(id);
  if (request.status !== "approved") throw ApiError.badRequest("Only an approved request can be marked paid");

  request.status = "paid";
  request.transactionRef = transactionRef?.trim() || "";
  request.set("processedBy", adminId);
  request.processedAt = new Date();
  await request.save();

  void notifyUser(String(request.agent), {
    type: "system",
    title: "💰 Payout sent",
    body: `${formatMoney(request.amount)} has been transferred to your bank account.`,
  }).catch((err) => console.error("payout paid notification failed:", (err as Error).message));

  return request.toJSON();
}
