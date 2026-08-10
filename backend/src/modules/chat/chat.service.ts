import { SupportTicket } from "./ticket.model";
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

export async function listTickets(userId: string, role: string) {
  if (role === "admin") {
    return SupportTicket.find()
      .populate("user", "name email phone role")
      .sort({ updatedAt: -1 });
  }
  return SupportTicket.find({ user: userId }).sort({ updatedAt: -1 });
}

export async function createTicket(userId: string, subject = "Live Chat Support") {
  // If there's an existing open ticket, reuse it
  const existing = await SupportTicket.findOne({ user: userId, status: "open" });
  if (existing) return existing;

  const ticket = await SupportTicket.create({
    user: userId,
    status: "open",
    subject,
  });

  // Notify admins of the new ticket
  broadcastTicketStatus(String(ticket._id), "open");

  return ticket;
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
  text: string,
  role?: string,
) {
  const ticket = await getAccessibleTicket(ticketId, senderId, role);

  const message = await ChatMessage.create({
    ticket: ticketId,
    sender: senderId,
    senderType,
    text,
  });

  // Touch ticket to update its updatedAt field (so it bubbles to top in lists)
  ticket.set("updatedAt", new Date());
  await ticket.save();

  // Notify socket rooms (broadcast the message live!)
  void broadcastNewMessage(ticketId, message, senderType === "staff" ? "admin" : "customer");

  return message;
}
