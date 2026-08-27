import { useState, useEffect, useRef } from "react";
import { io, Socket } from "socket.io-client";
import {
  HelpCircle,
  ChevronDown,
  ChevronUp,
  MessageSquare,
  Send,
  ArrowLeft,
  Lock,
} from "lucide-react";
import { GlassCard } from "@shared/ui/GlassCard";
import { Button } from "@shared/ui/Button";
import { SOCKET_URL } from "@shared/lib/api";
import { cn } from "@shared/lib/utils";
import { useNavigate } from "react-router-dom";
import { useAgentSession } from "../store/sessionStore";
import {
  useMe,
  useSiteContent,
  useSupportConfig,
  useSupportTickets,
  useTicketMessages,
} from "../../customer/api/queries";
import {
  useCreateTicket,
  useCloseTicket,
  useSendMessage,
} from "../../customer/api/mutations";
import type { ChatMessage, SupportTicket } from "../../customer/types";

export function HelpSupport() {
  const navigate = useNavigate();
  const { data: me } = useMe();
  const { data: siteContent } = useSiteContent();
  const { data: supportConfig } = useSupportConfig();
  const { data: tickets = [], refetch: refetchTickets } = useSupportTickets();
  const createTicketMutation = useCreateTicket();
  const closeTicketMutation = useCloseTicket();
  const sendMessageMutation = useSendMessage();
  const authenticated = useAgentSession((s) => s.authenticated);

  // UI state
  const [openFaqIndex, setOpenFaqIndex] = useState<number | null>(null);
  const [activeTicket, setActiveTicket] = useState<SupportTicket | null>(null);
  const [isChatOpen, setIsChatOpen] = useState(false);
  const [messageText, setMessageText] = useState("");
  const [chatMessages, setChatMessages] = useState<ChatMessage[]>([]);
  const [isSupportOnline, setIsSupportOnline] = useState(false);

  // Refs
  const socketRef = useRef<Socket | null>(null);
  const messagesEndRef = useRef<HTMLDivElement | null>(null);

  const faqs = siteContent?.help?.faqs ?? [];
  const openTicket = tickets.find((t) => t.status === "open");

  // Load ticket message history when ticket changes
  const { data: historyMessages } = useTicketMessages(activeTicket?.id ?? null);

  useEffect(() => {
    if (historyMessages) {
      setChatMessages(historyMessages);
    }
  }, [historyMessages]);

  // Set support online state initially from http config query
  useEffect(() => {
    if (supportConfig) {
      setIsSupportOnline(supportConfig.isOnline);
    }
  }, [supportConfig]);

  // Handle socket connection when chat is opened
  useEffect(() => {
    if (!isChatOpen || !authenticated) {
      if (socketRef.current) {
        socketRef.current.disconnect();
        socketRef.current = null;
      }
      return;
    }

    const socket = io(SOCKET_URL, {
      withCredentials: true,
      transports: ["websocket"],
      auth: { role: "agent" },
    });

    socketRef.current = socket;

    socket.on("connect", () => {
      console.log("✓ Connected to support socket");
      if (activeTicket) {
        socket.emit("join_ticket", activeTicket.id);
      }
    });

    socket.on("support_status", (data: { isOnline: boolean }) => {
      setIsSupportOnline(data.isOnline);
    });

    socket.on("new_message", (msg: ChatMessage) => {
      setChatMessages((prev) => {
        // Prevent duplicate local messages
        if (prev.some((m) => m.id === msg.id)) return prev;
        return [...prev, msg];
      });
    });

    socket.on("ticket_status_change", (data: { ticketId: string; status: "open" | "closed" }) => {
      if (activeTicket && data.ticketId === activeTicket.id) {
        setActiveTicket((prev) => (prev ? { ...prev, status: data.status } : null));
        refetchTickets();
      }
    });

    return () => {
      socket.disconnect();
      socketRef.current = null;
    };
  }, [isChatOpen, activeTicket?.id, authenticated]);

  // Join socket room if activeTicket changes and socket is open
  useEffect(() => {
    if (socketRef.current && activeTicket) {
      socketRef.current.emit("join_ticket", activeTicket.id);
    }
  }, [activeTicket?.id]);

  // Auto-scroll messages
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [chatMessages]);

  const handleStartChat = async () => {
    let ticket = openTicket;
    if (!ticket) {
      try {
        ticket = await createTicketMutation.mutateAsync({});
        refetchTickets();
      } catch (err) {
        console.error("Failed to open support ticket:", err);
        return;
      }
    }
    setActiveTicket(ticket);
    setIsChatOpen(true);
  };

  const handleSendMessage = async () => {
    if (!messageText.trim() || !activeTicket) return;
    const text = messageText.trim();
    setMessageText("");

    try {
      await sendMessageMutation.mutateAsync({
        ticketId: activeTicket.id,
        text,
      });
    } catch (err) {
      console.error("Failed to send message:", err);
    }
  };

  const handleCloseTicket = async () => {
    if (!activeTicket) return;
    if (window.confirm("Are you sure you want to close this ticket? It will end this conversation.")) {
      try {
        await closeTicketMutation.mutateAsync(activeTicket.id);
        refetchTickets();
        setIsChatOpen(false);
        setActiveTicket(null);
      } catch (err) {
        console.error("Failed to close ticket:", err);
      }
    }
  };

  return (
    <div className="space-y-8">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <div className="flex items-center gap-3">
            <button
              onClick={() => navigate(-1)}
              className="flex items-center justify-center size-9 rounded-xl border border-line bg-surface text-ink-soft hover:text-primary transition-colors cursor-pointer shrink-0"
              aria-label="Back"
            >
              <ArrowLeft className="size-4" />
            </button>
            <h1 className="font-display text-2xl text-ink sm:text-3xl">Help &amp; Support</h1>
          </div>
          <p className="mt-2 text-sm text-muted pl-12">Browse frequently asked questions or chat with support agents.</p>
        </div>
      </div>

      {/* Main Split Layout */}
      {!isChatOpen ? (
        <div className="grid gap-6 lg:grid-cols-[1.5fr_1fr]">
          {/* Left Side: Accordion FAQs */}
          <GlassCard className="space-y-4">
            <div className="flex items-center gap-2 border-b border-line/50 pb-3">
              <HelpCircle className="size-5 text-primary" />
              <h2 className="font-display text-lg font-semibold text-ink">Frequently Asked Questions</h2>
            </div>

            {faqs.length === 0 ? (
              <p className="text-sm text-muted">No FAQs available at this time.</p>
            ) : (
              <div className="divide-y divide-line/60">
                {faqs.map((faq: { q: string; a: string }, idx: number) => {
                  const isOpen = openFaqIndex === idx;
                  return (
                    <div key={idx} className="py-3.5 first:pt-0 last:pb-0">
                      <button
                        onClick={() => setOpenFaqIndex(isOpen ? null : idx)}
                        className="flex w-full items-center justify-between text-left font-display font-medium text-ink hover:text-primary transition-colors"
                      >
                        <span>{faq.q}</span>
                        {isOpen ? <ChevronUp className="size-4 shrink-0" /> : <ChevronDown className="size-4 shrink-0" />}
                      </button>
                      {isOpen && (
                        <p className="mt-2 text-sm text-ink-soft leading-relaxed pr-6 animate-slide-down">
                          {faq.a}
                        </p>
                      )}
                    </div>
                  );
                })}
              </div>
            )}
          </GlassCard>

          {/* Right Side: Chat Trigger */}
          <div className="space-y-4">
            <GlassCard className="text-center space-y-4">
              <div className="mx-auto flex size-12 items-center justify-center rounded-full bg-primary/10 text-primary">
                <MessageSquare className="size-6" />
              </div>
              <div className="space-y-1">
                <h3 className="font-display text-lg font-semibold text-ink">Live Support Chat</h3>
                <p className="text-sm text-muted leading-relaxed">
                  Have a question about a wash or need help with a payout? Chat live with our operations team.
                </p>
              </div>

              {/* Support Status Indicator */}
              <div className="flex items-center justify-center gap-2 text-sm">
                <span className="relative flex size-2">
                  {isSupportOnline && (
                    <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-emerald-400 opacity-75" />
                  )}
                  <span
                    className={cn(
                      "relative inline-flex size-2 rounded-full",
                      isSupportOnline ? "bg-emerald-500" : "bg-muted"
                    )}
                  />
                </span>
                <span className="font-medium text-ink-soft">
                  Support is {isSupportOnline ? "Online" : "Offline"}
                </span>
              </div>

              <Button onClick={handleStartChat} className="w-full">
                {openTicket ? "Resume chat" : "Start a chat"}
              </Button>
            </GlassCard>
          </div>
        </div>
      ) : (
        /* Chat Workspace Interface */
        <GlassCard className="flex h-[600px] flex-col p-0 overflow-hidden border border-line bg-surface shadow-lg">
          {/* Chat Headers */}
          <div className="flex items-center justify-between border-b border-line p-4 bg-surface-muted/15">
            <div className="flex items-center gap-3">
              <button
                onClick={() => setIsChatOpen(false)}
                className="grid size-8 place-items-center rounded-lg hover:bg-surface-muted transition-colors text-ink-soft"
                aria-label="Back to FAQs"
              >
                <ArrowLeft className="size-5" />
              </button>
              <div>
                <p className="font-display font-semibold text-ink">Live Chat Support</p>
                <div className="flex items-center gap-1.5 text-xs text-muted">
                  <span
                    className={cn(
                      "size-1.5 rounded-full",
                      isSupportOnline ? "bg-emerald-500" : "bg-muted"
                    )}
                  />
                  <span>{isSupportOnline ? "Online" : "Offline"}</span>
                </div>
              </div>
            </div>

            <Button variant="ghost" size="sm" onClick={handleCloseTicket} className="text-red-500 hover:text-red-600 hover:bg-red-50/10">
              Close Ticket
            </Button>
          </div>

          {/* Chat Messages Body */}
          <div className="flex-1 overflow-y-auto p-5 space-y-4 bg-surface-muted/10" data-lenis-prevent="true">
            {chatMessages.length === 0 ? (
              <div className="h-full flex flex-col items-center justify-center text-center p-6 space-y-3">
                <MessageSquare className="size-10 text-muted/65" />
                <div className="space-y-1">
                  <p className="font-display font-medium text-ink">No messages yet</p>
                  <p className="text-xs text-muted max-w-[240px]">
                    Type a message and hit send to start conversation.
                  </p>
                </div>
              </div>
            ) : (
              chatMessages.map((msg) => {
                const isMe = msg.sender === me?.id;
                return (
                  <div
                    key={msg.id}
                    className={cn("flex flex-col max-w-[75%]", isMe ? "ml-auto items-end" : "mr-auto items-start")}
                  >
                    <div
                      className={cn(
                        "rounded-2xl px-4 py-2.5 text-sm leading-relaxed shadow-sm",
                        isMe
                          ? "bg-primary text-white rounded-br-none"
                          : "bg-surface-muted text-ink border border-line rounded-bl-none"
                      )}
                    >
                      <p className="break-words">{msg.text}</p>
                    </div>
                    <span className="mt-1.5 text-[10px] text-muted pr-1">
                      {new Date(msg.createdAt).toLocaleTimeString("en-IN", {
                        hour: "2-digit",
                        minute: "2-digit",
                        hour12: false,
                      })}
                    </span>
                  </div>
                );
              })
            )}
            <div ref={messagesEndRef} />
          </div>

          {/* Chat Input Footer */}
          <div className="border-t border-line p-4 bg-surface">
            {activeTicket?.status === "closed" ? (
              <div className="flex items-center justify-center gap-2 p-2 rounded-xl bg-muted/10 border border-line text-sm text-muted">
                <Lock className="size-4" />
                <span>This ticket has been closed. Click back to start a new chat.</span>
              </div>
            ) : (
              <form
                onSubmit={(e) => {
                  e.preventDefault();
                  handleSendMessage();
                }}
                className="flex items-center gap-2"
              >
                <input
                  type="text"
                  placeholder="Type your message here..."
                  value={messageText}
                  onChange={(e) => setMessageText(e.target.value)}
                  className="flex-1 rounded-xl border border-line bg-surface-muted/30 px-4 py-2.5 text-sm text-ink placeholder-muted focus:border-primary focus:bg-surface focus:outline-none"
                />
                <Button type="submit" size="sm" disabled={!messageText.trim()} className="rounded-xl size-[42px] shrink-0">
                  <Send className="size-4" />
                </Button>
              </form>
            )}
          </div>
        </GlassCard>
      )}
    </div>
  );
}
