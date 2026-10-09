import { chatText, storeChatImage } from "../../shared/utils/chatImage";
import { Types } from "mongoose";
import { SupportTicket, SUPPORT_TOPICS, type SupportTopic } from "./ticket.model";
import { Booking } from "../booking/booking.model";
import { ChatMessage } from "./message.model";
import { SupportConfig } from "./supportConfig.model";
import {
  getConnectedAdminsCount,
  broadcastSupportStatus,
  broadcastNewMessage,
  broadcastTicketStatus,
} from "../../shared/services/socket";
import { ApiError } from "../../shared/utils/ApiError";

export async function getSupportConfig() {
  let config = await SupportConfig.findOne();
  if (!config) {
    config = await SupportConfig.create({ manualSupportStatus: "auto" });
  }

  const manualStatus = config.manualSupportStatus;
  let isOnline = false;
  if (manualStatus === "online") {
    isOnline = true;
  } else if (manualStatus === "offline") {
    isOnline = false;
  } else {
    isOnline = getConnectedAdminsCount() > 0;
  }

  return {
    manualSupportStatus: manualStatus,
    isOnline,
  };
}

export async function updateSupportConfig(manualSupportStatus: "auto" | "online" | "offline") {
  let config = await SupportConfig.findOne();
  if (!config) {
    config = new SupportConfig();
  }
  config.manualSupportStatus = manualSupportStatus;
  await config.save();

  // Calculate new online status and broadcast
  const { isOnline } = await getSupportConfig();
  broadcastSupportStatus(isOnline);

  return {
    manualSupportStatus,
    isOnline,
  };
}

const TOPIC_LABEL: Record<SupportTopic, string> = {
  booking: "Help with a booking",
  payment: "Payments & refunds",
  account: "Account & profile",
  app: "App problem",
  other: "Something else",
};

const BOOKING_FIELDS = "packageName vehicleName date slot status jobStatus";

export async function listTickets(userId: string, role: string) {
  if (role === "admin") {
    return SupportTicket.find()
      .populate("user", "name email phone role")
      .populate("booking", BOOKING_FIELDS)
      .sort({ updatedAt: -1 });
  }
  return SupportTicket.find({ user: userId }).populate("booking", BOOKING_FIELDS).sort({ updatedAt: -1 });
}

/**
 * Start (or resume) a conversation about a topic — and, for "booking", a
 * specific job. One open conversation per job / per general topic, so a
 * question about Tuesday's wash doesn't get buried under last week's refund.
 */
export async function createTicket(
  userId: string,
  input: { topic?: string; bookingId?: string | null; subject?: string } = {},
) {
  const topic: SupportTopic = (SUPPORT_TOPICS as readonly string[]).includes(input.topic ?? "")
    ? (input.topic as SupportTopic)
    : "other";

  let booking: { _id: unknown; packageName?: string; vehicleName?: string } | null = null;
  if (input.bookingId) {
    if (!Types.ObjectId.isValid(input.bookingId)) throw ApiError.notFound("Booking not found");
    // Only a job you're part of: your booking, or one you were the cleaner on.
    booking = await Booking.findOne({
      _id: input.bookingId,
      $or: [{ user: userId }, { assignedAgent: userId }, { "agentReleases.agent": userId }],
    })
      .select("packageName vehicleName")
      .lean();
    if (!booking) throw ApiError.notFound("Booking not found");
  }

  const existing = await SupportTicket.findOne(
    booking
      ? { user: userId, status: "open", booking: booking._id }
      : { user: userId, status: "open", booking: null, topic },
  ).populate("booking", BOOKING_FIELDS);
  if (existing) return existing;

  const subject = booking
    ? [booking.packageName, booking.vehicleName].filter(Boolean).join(" · ") || TOPIC_LABEL.booking
    : input.subject?.trim() || TOPIC_LABEL[topic];

  const ticket = await SupportTicket.create({
    user: userId,
    status: "open",
    subject,
    topic: booking ? "booking" : topic,
    booking: booking?._id ?? null,
  });
  await ticket.populate("booking", BOOKING_FIELDS);

  // Notify admins of the new ticket
  broadcastTicketStatus(String(ticket._id), "open");

  return ticket;
}

/**
 * Open conversations whose last message is from the customer/cleaner — i.e.
 * waiting on support. Conversations from before `lastSenderType` existed are
 * judged by their actual last message.
 */
export async function countAwaitingSupport(): Promise<number> {
  const tracked = await SupportTicket.countDocuments({ status: "open", lastSenderType: "customer" });
  const legacy = await SupportTicket.find({ status: "open", lastSenderType: null }).select("_id").lean();
  if (legacy.length === 0) return tracked;
  const last = await ChatMessage.aggregate<{ _id: unknown; senderType: string }>([
    { $match: { ticket: { $in: legacy.map((t) => t._id) } } },
    { $sort: { createdAt: -1 } },
    { $group: { _id: "$ticket", senderType: { $first: "$senderType" } } },
  ]);
  return tracked + last.filter((l) => l.senderType === "customer").length;
}

/**
 * Load a ticket the caller is actually entitled to see.
 *
 * Support staff work every ticket; a customer or cleaner only ever gets their
 * own. Everything below goes through here — previously these functions took a
 * bare ticketId, so anyone who guessed an ObjectId could read, post into, and
 * close another customer's conversation (including their payment complaints).
 * A stranger gets "Ticket not found", not "forbidden", so ids stay unprobeable.
 */
async function getAccessibleTicket(ticketId: string, userId: string, role?: string) {
  if (!Types.ObjectId.isValid(ticketId)) throw ApiError.notFound("Ticket not found");
  const ticket = await SupportTicket.findById(ticketId);
  if (!ticket) throw ApiError.notFound("Ticket not found");
  if (role !== "admin" && String(ticket.user) !== String(userId)) {
    throw ApiError.notFound("Ticket not found");
  }
  return ticket;
}

export async function closeTicket(ticketId: string, userId: string, role?: string) {
  const ticket = await getAccessibleTicket(ticketId, userId, role);
  ticket.status = "closed";
  await ticket.save();

  // Notify socket rooms
  broadcastTicketStatus(ticketId, "closed");

  return ticket;
}

export async function reopenTicket(ticketId: string, userId: string, role?: string) {
  const ticket = await getAccessibleTicket(ticketId, userId, role);
  ticket.status = "open";
  await ticket.save();

  // Notify socket rooms
  broadcastTicketStatus(ticketId, "open");

  return ticket;
}

export async function listMessages(ticketId: string, userId: string, role?: string) {
  await getAccessibleTicket(ticketId, userId, role);
  return ChatMessage.find({ ticket: ticketId }).sort({ createdAt: 1 });
}

export async function saveMessage(
  ticketId: string,
  senderId: string,
  senderType: "customer" | "staff",
  rawText: unknown,
  role?: string,
  image?: unknown,
) {
  const ticket = await getAccessibleTicket(ticketId, senderId, role);
  if (ticket.status === "closed") throw ApiError.badRequest("Reopen this conversation before sending a message");
  const text = chatText(rawText);
  if (!text && image == null) throw ApiError.badRequest("Message text or photo is required");
  const imageUrl = await storeChatImage(image, `nexclean/support/${ticketId}`);

  const message = await ChatMessage.create({
    ticket: ticketId,
    sender: senderId,
    senderType,
    text,
    imageUrl,
  });

  // Bubble it to the top, and remember who spoke last (see countAwaitingSupport).
  ticket.set("updatedAt", new Date());
  ticket.set("lastMessageAt", new Date());
  ticket.set("lastSenderType", senderType);
  await ticket.save();

  // Notify socket rooms (broadcast the message live!)
  void broadcastNewMessage(ticketId, message, senderType === "staff" ? "admin" : "customer");

  return message;
}
