import { Types } from "mongoose";
import { chatText, storeChatImage } from "../../shared/utils/chatImage";
import { InternalConversation } from "./internalConversation.model";
import { InternalMessage } from "./internalMessage.model";
import { User } from "../user/user.model";
import { ApiError } from "../../shared/utils/ApiError";
import { emitToUser, isAdminConnected } from "../../shared/services/socket";
import { isSuperAdmin } from "../../shared/utils/superAdmin";

function participantKey(first: string, second: string): string {
  return [first, second].sort().join(":");
}

function staffDto(user: any) {
  const role = user?.adminRoleId && typeof user.adminRoleId === "object" ? user.adminRoleId.name : null;
  const id = String(user?._id ?? user?.id ?? "");
  return {
    id,
    name: user?.name || "Admin",
    email: user?.email || "",
    roleName: isSuperAdmin(user ?? {}) ? "Super Admin" : role || "Admin Staff",
    online: isAdminConnected(id),
  };
}

function messageDto(message: any) {
  return {
    id: String(message._id ?? message.id),
    conversationId: String(message.conversation),
    sender: staffDto(message.sender),
    text: message.text,
    imageUrl: message.imageUrl,
    createdAt: message.createdAt,
  };
}

async function accessibleConversation(conversationId: string, userId: string) {
  if (!Types.ObjectId.isValid(conversationId)) throw ApiError.notFound("Conversation not found");
  const conversation = await InternalConversation.findOne({ _id: conversationId, participants: userId });
  if (!conversation) throw ApiError.notFound("Conversation not found");
  return conversation;
}

async function markConversationRead(conversation: any, userId: string) {
  const now = new Date();
  const state = conversation.readStates.find((item: any) => String(item.user) === userId);
  if (state) state.lastReadAt = now;
  else conversation.readStates.push({ user: userId, lastReadAt: now });
  await conversation.save();
}

export async function listContacts(userId: string) {
  const users = await User.find({
    _id: { $ne: userId },
    role: "admin",
    status: { $ne: "suspended" },
  })
    .select("name email phone adminRoleId")
    .populate("adminRoleId", "name")
    .sort({ name: 1 });
  return users.map(staffDto);
}

export async function listConversations(userId: string) {
  const conversations = await InternalConversation.find({ participants: userId })
    .populate({ path: "participants", select: "name email phone adminRoleId", populate: { path: "adminRoleId", select: "name" } })
    .sort({ lastMessageAt: -1 });

  return Promise.all(
    conversations.map(async (conversation: any) => {
      const contact = conversation.participants.find((person: any) => String(person._id) !== userId);
      const readState = conversation.readStates.find((item: any) => String(item.user) === userId);
      const unreadCount = await InternalMessage.countDocuments({
        conversation: conversation._id,
        sender: { $ne: userId },
        createdAt: { $gt: readState?.lastReadAt ?? new Date(0) },
      });
      return {
        id: String(conversation._id),
        contact: staffDto(contact),
        lastMessagePreview: conversation.lastMessagePreview,
        lastMessageAt: conversation.lastMessageAt,
        unreadCount,
      };
    }),
  );
}

export async function getOrCreateConversation(userId: string, recipientId: string) {
  if (recipientId === userId) throw ApiError.badRequest("You cannot message yourself");
  const recipient = await User.findOne({ _id: recipientId, role: "admin", status: { $ne: "suspended" } });
  if (!recipient) throw ApiError.notFound("Staff member not found");

  const key = participantKey(userId, recipientId);
  let conversation = await InternalConversation.findOne({ participantKey: key });
  if (!conversation) {
    try {
      conversation = await InternalConversation.create({
        participants: [userId, recipientId],
        participantKey: key,
        readStates: [
          { user: userId, lastReadAt: new Date() },
          { user: recipientId, lastReadAt: new Date(0) },
        ],
      });
    } catch (error: any) {
      if (error?.code !== 11000) throw error;
      conversation = await InternalConversation.findOne({ participantKey: key });
    }
  }
  if (!conversation) throw ApiError.badRequest("Could not start the conversation");
  return { id: String(conversation._id), contact: staffDto(recipient) };
}

export async function listMessages(conversationId: string, userId: string) {
  const conversation = await accessibleConversation(conversationId, userId);
  const messages = await InternalMessage.find({ conversation: conversationId })
    .populate({ path: "sender", select: "name email phone adminRoleId", populate: { path: "adminRoleId", select: "name" } })
    .sort({ createdAt: 1 });
  await markConversationRead(conversation, userId);

  for (const participant of conversation.participants) {
    emitToUser(String(participant), "internal_conversation_read", { conversationId, userId });
  }
  return messages.map(messageDto);
}

export async function sendMessage(conversationId: string, userId: string, rawText: unknown, image?: unknown) {
  const text = chatText(rawText);
  if (!text && image == null) throw ApiError.badRequest("Message text or photo is required");

  const conversation = await accessibleConversation(conversationId, userId);
  const imageUrl = await storeChatImage(image, `nexclean/internal/${conversationId}`);
  const message = await InternalMessage.create({ conversation: conversationId, sender: userId, text, imageUrl });
  await message.populate({ path: "sender", select: "name email phone adminRoleId", populate: { path: "adminRoleId", select: "name" } });

  conversation.lastMessagePreview = text.slice(0, 160) || "Photo";
  conversation.lastMessageAt = message.createdAt;
  await markConversationRead(conversation, userId);

  const payload = { conversationId, message: messageDto(message) };
  for (const participant of conversation.participants) {
    emitToUser(String(participant), "internal_message", payload);
  }
  return payload.message;
}

/** Remove private staff-chat data when one of its participants is deleted. */
export async function deleteConversationsForUser(userId: string) {
  const conversations = await InternalConversation.find({ participants: userId }).select("_id").lean();
  const conversationIds = conversations.map((conversation) => conversation._id);
  if (conversationIds.length > 0) {
    await InternalMessage.deleteMany({ conversation: { $in: conversationIds } });
    await InternalConversation.deleteMany({ _id: { $in: conversationIds } });
  }
}
