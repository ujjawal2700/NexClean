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
import { useMe, useSiteContent, useSupportConfig, useSupportTickets, useTicketMessages } from "../api/queries";
import { useCreateTicket, useCloseTicket, useSendMessage } from "../api/mutations";
import { useSessionStore } from "../store/sessionStore";
import { SOCKET_URL } from "@shared/lib/api";
import { cn } from "@shared/lib/utils";
import type { ChatMessage, SupportTicket } from "../types";
import { useNavigate } from "react-router-dom";

export function HelpSupport() {
  const navigate = useNavigate();
  const { data: me } = useMe();
  const { data: siteContent } = useSiteContent();
  const { data: supportConfig } = useSupportConfig();
  const { data: tickets = [], refetch: refetchTickets } = useSupportTickets();
  const createTicketMutation = useCreateTicket();
  const closeTicketMutation = useCloseTicket();
  const sendMessageMutation = useSendMessage();
  const authenticated = useSessionStore((s) => s.authenticated);

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
      auth: { role: "customer" },
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
              <p className="text-sm text-muted py-6 text-center">No FAQs available at the moment.</p>
            ) : (
              <div className="divide-y divide-line/60">
                {faqs.map((faq: { q: string; a: string }, index: number) => {
                  const isOpen = openFaqIndex === index;
                  return (
                    <div key={index} className="py-4 first:pt-0 last:pb-0">
                      <button
                        onClick={() => setOpenFaqIndex(isOpen ? null : index)}
                        className="flex w-full items-center justify-between text-left font-display font-medium text-ink hover:text-primary transition-colors focus:outline-none"
                      >
                        <span>{faq.q}</span>
                        {isOpen ? <ChevronUp className="size-4 shrink-0" /> : <ChevronDown className="size-4 shrink-0" />}
                      </button>
                      {isOpen && <p className="mt-2.5 text-sm text-muted leading-relaxed whitespace-pre-line">{faq.a}</p>}
                    </div>
                  );
                })}
              </div>
            )}
          </GlassCard>

          {/* Right Side: Chat Launch Card */}
          <div className="space-y-5">
            <GlassCard className="flex flex-col justify-between h-full space-y-6">
              <div className="space-y-4">
                <div className="flex items-center gap-3">
                  <div className="grid size-11 place-items-center rounded-2xl bg-primary/10 text-primary">
                    <MessageSquare className="size-6" />
                  </div>
                  <div>
                    <h3 className="font-display text-lg font-semibold text-ink">Live Support Chat</h3>
                    <p className="text-xs text-muted">Get assistance from our representatives</p>
                  </div>
                </div>

                {/* Status Indicator */}
                <div className="flex items-center gap-2 rounded-2xl border border-line bg-surface-muted/30 px-4 py-3 text-sm">
                  <span className={cn("size-2.5 rounded-full shrink-0 animate-pulse", isSupportOnline ? "bg-green-500" : "bg-gray-400")} />
                  <span className="font-medium text-ink-soft">
                    {isSupportOnline ? "Support is Online (Fast response)" : "Support is Offline (Leave a message)"}
                  </span>
                </div>

                <p className="text-sm text-muted leading-relaxed">
                  Have issues with a wash, payment, or subscription? Start a live chat session to get immediate answers.
                </p>
              </div>

              <Button onClick={handleStartChat} className="w-full">
                {openTicket ? "Resume Support Chat" : "Start Live Chat"}
              </Button>
            </GlassCard>
          </div>
        </div>
      ) : (
        /* Render 2: Active Chat Interface */
        <div className="max-w-3xl mx-auto">
          <GlassCard className="flex flex-col h-[70vh] border border-line/75 p-0 overflow-hidden bg-surface/50">
            {/* Chat Header */}
            <div className="flex items-center justify-between border-b border-line bg-surface-muted/50 px-5 py-4">
              <div className="flex items-center gap-3">
                <button
                  onClick={() => setIsChatOpen(false)}
                  className="p-1 rounded-lg text-muted hover:text-ink hover:bg-surface transition-colors"
                >
                  <ArrowLeft className="size-5" />
                </button>
                <div>
                  <h2 className="font-display font-semibold text-ink leading-tight">Live Chat Support</h2>
                  <div className="flex items-center gap-1.5 mt-0.5">
                    <span className={cn("size-2 rounded-full", isSupportOnline ? "bg-green-500" : "bg-gray-400")} />
                    <span className="text-[10px] text-muted font-medium">
                      {isSupportOnline ? "Online" : "Away"}
                    </span>
                  </div>
                </div>
              </div>
              {activeTicket?.status === "open" && (
                <Button variant="outline" size="sm" className="text-red-500 border-red-200 hover:bg-red-50/15" onClick={handleCloseTicket}>
                  Close Chat
                </Button>
              )}
            </div>

            {/* Chat Messages Body */}
            <div className="flex-1 overflow-y-auto p-5 space-y-4 bg-surface-muted/10" data-lenis-prevent="true">
              {chatMessages.length === 0 ? (
                <div className="h-full flex flex-col items-center justify-center text-center p-6 space-y-3">
                  <MessageSquare className="size-10 text-muted/65" />
                  <p className="text-sm font-medium text-muted">No messages yet. Send a message to start the conversation.</p>
                </div>
              ) : (
                chatMessages.map((msg) => {
                  const isOwn = msg.sender === me?.id;
                  return (
                    <div key={msg.id} className={cn("flex", isOwn ? "justify-end" : "justify-start")}>
                      <div
                        className={cn(
                          "max-w-[75%] rounded-2xl px-4 py-2.5 text-sm shadow-sm",
                          isOwn
                            ? "bg-primary text-white rounded-tr-none"
                            : "bg-surface border border-line text-ink rounded-tl-none"
                        )}
                      >
                        <p className="leading-relaxed whitespace-pre-line">{msg.text}</p>
                        <span className={cn("block mt-1 text-[9px] text-right", isOwn ? "text-white/70" : "text-muted")}>
                          {new Date(msg.createdAt).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}
                        </span>
                      </div>
                    </div>
                  );
                })
              )}
              <div ref={messagesEndRef} />
            </div>

            {/* Chat Footer Input */}
            <div className="border-t border-line p-4 bg-surface">
              {activeTicket?.status === "closed" ? (
                <div className="flex items-center justify-center gap-1.5 rounded-xl bg-gray-50 border border-line/60 p-3 text-xs text-muted italic">
                  <Lock className="size-4 text-muted/80" />
                  <span>This ticket is closed. Click back and start a new chat if you have another query.</span>
                </div>
              ) : (
                <div className="flex gap-2">
                  <input
                    type="text"
                    value={messageText}
                    onChange={(e) => setMessageText(e.target.value)}
                    onKeyDown={(e) => e.key === "Enter" && handleSendMessage()}
                    placeholder="Type your message here..."
                    className="flex-1 h-11 rounded-xl border border-line bg-surface-muted/30 px-4 text-sm text-ink outline-none transition-all focus:border-primary/50 focus:bg-surface focus:ring-1 focus:ring-primary/25"
                  />
                  <Button size="sm" className="h-11 px-4 rounded-xl" onClick={handleSendMessage} disabled={!messageText.trim()}>
                    <Send className="size-4" />
                  </Button>
                </div>
              )}
            </div>
          </GlassCard>
        </div>
      )}
    </div>
  );
}
