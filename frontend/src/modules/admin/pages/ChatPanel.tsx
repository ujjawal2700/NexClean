import { useState, useEffect, useRef } from "react";
import { io, Socket } from "socket.io-client";
import {
  MessageSquare,
  Send,
  Mail,
  Phone,
  Lock,
  Unlock,
} from "lucide-react";
import { Button } from "@shared/ui/Button";
import { useSupportConfig, useSupportTickets, useTicketMessages } from "../../customer/api/queries";
import {
  useCloseTicket,
  useReopenTicket,
  useSendMessage,
  useUpdateSupportConfig,
} from "../../customer/api/mutations";
import { useAdminSession } from "../store/sessionStore";
import { SOCKET_URL } from "@shared/lib/api";
import { cn } from "@shared/lib/utils";
import type { ChatMessage } from "../../customer/types";

export function ChatPanel() {
  const { data: supportConfig, refetch: refetchConfig } = useSupportConfig();
  const { data: tickets = [], refetch: refetchTickets } = useSupportTickets();
  
  const closeTicketMutation = useCloseTicket();
  const reopenTicketMutation = useReopenTicket();
  const sendMessageMutation = useSendMessage();
  const updateConfigMutation = useUpdateSupportConfig();
  
  const authenticated = useAdminSession((s) => s.authenticated);

  const [activeTab, setActiveTab] = useState<"open" | "closed">("open");
  const [selectedRoleFilter, setSelectedRoleFilter] = useState<"all" | "customer" | "agent">("all");
  const [selectedTicketId, setSelectedTicketId] = useState<string | null>(null);
  const [messageText, setMessageText] = useState("");
  const [chatMessages, setChatMessages] = useState<ChatMessage[]>([]);
  const [localOnlineStatus, setLocalOnlineStatus] = useState(false);

  // Refs
  const socketRef = useRef<Socket | null>(null);
  const messagesEndRef = useRef<HTMLDivElement | null>(null);
  const activeTicketIdRef = useRef<string | null>(null);

  const selectedTicket = tickets.find((t) => t.id === selectedTicketId);
  const filteredTickets = tickets.filter((t) => {
    if (t.status !== activeTab) return false;
    if (typeof t.user === "object" && t.user) {
      const userRole = (t.user as any).role;
      const isAgent = userRole === "agent" || userRole === "cleaner";
      if (selectedRoleFilter === "customer" && userRole !== "customer") return false;
      if (selectedRoleFilter === "agent" && !isAgent) return false;
    }
    return true;
  });

  // Load ticket message history when ticket changes
  const { data: historyMessages } = useTicketMessages(selectedTicketId);

  // Keep track of active ticket ID in a ref so the socket callback can read it without closure staling
  useEffect(() => {
    activeTicketIdRef.current = selectedTicketId;
  }, [selectedTicketId]);

  useEffect(() => {
    if (historyMessages) {
      setChatMessages(historyMessages);
    }
  }, [historyMessages]);

  useEffect(() => {
    if (supportConfig) {
      setLocalOnlineStatus(supportConfig.isOnline);
    }
  }, [supportConfig]);

  // Handle Socket.io connection on mount
  useEffect(() => {
    if (!authenticated) return;

    const socket = io(SOCKET_URL, {
      withCredentials: true,
      transports: ["websocket"],
      auth: { role: "admin" },
    });

    socketRef.current = socket;

    socket.on("connect", () => {
      console.log("✓ Admin connected to support socket");
    });

    socket.on("support_status", (data: { isOnline: boolean }) => {
      setLocalOnlineStatus(data.isOnline);
      refetchConfig();
    });

    // Refresh tickets list on queue updates (e.g. new message, status change, new ticket)
    socket.on("ticket_update", (data: { ticketId: string; lastMessage?: ChatMessage; status?: string }) => {
      refetchTickets();
      
      // If the incoming message belongs to the currently active ticket, append it
      if (data.lastMessage && activeTicketIdRef.current === data.ticketId) {
        setChatMessages((prev) => {
          if (prev.some((m) => m.id === data.lastMessage!.id)) return prev;
          return [...prev, data.lastMessage!];
        });
      }
    });

    socket.on("ticket_status_change", (data: { ticketId: string; status: "open" | "closed" }) => {
      if (activeTicketIdRef.current === data.ticketId) {
        refetchTickets();
      }
    });

    return () => {
      socket.disconnect();
      socketRef.current = null;
    };
  }, [authenticated]);

  // Join ticket room when active ticket changes
  useEffect(() => {
    if (socketRef.current && selectedTicketId) {
      socketRef.current.emit("join_ticket", selectedTicketId);
    }
  }, [selectedTicketId]);

  // Auto-scroll messages
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [chatMessages]);

  const handleSendMessage = async () => {
    if (!messageText.trim() || !selectedTicketId) return;
    const text = messageText.trim();
    setMessageText("");

    try {
      await sendMessageMutation.mutateAsync({
        ticketId: selectedTicketId,
        text,
      });
    } catch (err) {
      console.error("Failed to send message:", err);
    }
  };

  const handleToggleStatus = async () => {
    if (!selectedTicket) return;
    const { id, status } = selectedTicket;
    
    try {
      if (status === "open") {
        await closeTicketMutation.mutateAsync(id);
      } else {
        await reopenTicketMutation.mutateAsync(id);
      }
      refetchTickets();
    } catch (err) {
      console.error("Failed to toggle ticket status:", err);
    }
  };

  const handleUpdateStatusMode = async (mode: "auto" | "online" | "offline") => {
    try {
      await updateConfigMutation.mutateAsync(mode);
      refetchConfig();
    } catch (err) {
      console.error("Failed to update status config:", err);
    }
  };

  const currentManualStatus = supportConfig?.manualSupportStatus ?? "auto";

  return (
    <div className="space-y-6 h-[82vh] flex flex-col">
      {/* Header bar */}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between shrink-0">
        <div>
          <h1 className="font-display text-3xl text-ink">Support Live Chat</h1>
          <p className="mt-1 text-muted">Respond to active user queries and manage support status.</p>
        </div>

        {/* Global Online Status Segmented Control */}
        <div className="flex items-center gap-3 bg-surface border border-line p-1.5 rounded-2xl shadow-sm">
          <span className="text-xs text-muted font-medium px-2">Support Status:</span>
          
          <button
            onClick={() => handleUpdateStatusMode("auto")}
            className={cn(
              "px-3 py-1.5 rounded-xl text-xs font-semibold transition-all",
              currentManualStatus === "auto"
                ? "bg-primary text-white shadow-sm"
                : "text-muted hover:text-ink hover:bg-surface-muted"
            )}
          >
            Auto ({localOnlineStatus ? "Online" : "Offline"})
          </button>
          
          <button
            onClick={() => handleUpdateStatusMode("online")}
            className={cn(
              "px-3 py-1.5 rounded-xl text-xs font-semibold transition-all",
              currentManualStatus === "online"
                ? "bg-green-500 text-white shadow-sm"
                : "text-muted hover:text-green-600 hover:bg-green-50/15"
            )}
          >
            Force Online
          </button>
          
          <button
            onClick={() => handleUpdateStatusMode("offline")}
            className={cn(
              "px-3 py-1.5 rounded-xl text-xs font-semibold transition-all",
              currentManualStatus === "offline"
                ? "bg-red-500 text-white shadow-sm"
                : "text-muted hover:text-red-600 hover:bg-red-50/15"
            )}
          >
            Force Offline
          </button>
        </div>
      </div>

      {/* Main Split Layout */}
      <div className="flex-1 flex gap-5 overflow-hidden min-h-0">
        {/* Left Column: Tickets Queue list */}
        <div className="w-80 shrink-0 border border-line rounded-3xl bg-surface/50 backdrop-blur-md flex flex-col overflow-hidden">
          {/* Tab switches */}
          <div className="flex border-b border-line bg-surface-muted/30 p-1.5 gap-1 shrink-0">
            <button
              onClick={() => {
                setActiveTab("open");
                setSelectedTicketId(null);
              }}
              className={cn(
                "flex-1 py-2 text-xs font-semibold rounded-xl transition-all",
                activeTab === "open"
                  ? "bg-surface text-primary border border-line shadow-sm"
                  : "text-muted hover:text-ink"
              )}
            >
              Open Queue
            </button>
            <button
              onClick={() => {
                setActiveTab("closed");
                setSelectedTicketId(null);
              }}
              className={cn(
                "flex-1 py-2 text-xs font-semibold rounded-xl transition-all",
                activeTab === "closed"
                  ? "bg-surface text-primary border border-line shadow-sm"
                  : "text-muted hover:text-ink"
              )}
            >
              Closed History
            </button>
          </div>

          {/* Role Filter switches */}
          <div className="flex border-b border-line bg-surface p-1.5 gap-1 shrink-0">
            <button
              onClick={() => setSelectedRoleFilter("all")}
              className={cn(
                "flex-1 py-1 px-2 text-[10px] uppercase font-bold rounded-lg transition-all border cursor-pointer",
                selectedRoleFilter === "all"
                  ? "bg-ink-soft text-white border-ink shadow-sm"
                  : "border-transparent text-muted hover:text-ink hover:bg-surface-muted"
              )}
            >
              All
            </button>
            <button
              onClick={() => setSelectedRoleFilter("customer")}
              className={cn(
                "flex-1 py-1 px-2 text-[10px] uppercase font-bold rounded-lg transition-all border cursor-pointer",
                selectedRoleFilter === "customer"
                  ? "bg-primary text-white border-primary shadow-sm"
                  : "border-transparent text-muted hover:text-primary hover:bg-primary/5"
              )}
            >
              Customers
            </button>
            <button
              onClick={() => setSelectedRoleFilter("agent")}
              className={cn(
                "flex-1 py-1 px-2 text-[10px] uppercase font-bold rounded-lg transition-all border cursor-pointer",
                selectedRoleFilter === "agent"
                  ? "bg-indigo-600 text-white border-indigo-600 shadow-sm"
                  : "border-transparent text-muted hover:text-indigo-600 hover:bg-indigo-50/10"
              )}
            >
              Agents
            </button>
          </div>

          {/* Ticket Queue list */}
          <div className="flex-1 overflow-y-auto divide-y divide-line/60" data-lenis-prevent="true">
            {filteredTickets.length === 0 ? (
              <div className="p-8 text-center text-xs text-muted italic">
                No {activeTab} tickets found.
              </div>
            ) : (
              filteredTickets.map((t) => {
                const userObj = typeof t.user === "object" && t.user ? t.user : null;
                const userName = userObj?.name || "Customer";
                const isSelected = selectedTicketId === t.id;
                
                return (
                  <button
                    key={t.id}
                    onClick={() => setSelectedTicketId(t.id)}
                    className={cn(
                      "w-full text-left p-4 flex gap-3 transition-colors focus:outline-none",
                      isSelected
                        ? "bg-primary/5 border-l-4 border-l-primary"
                        : "hover:bg-surface-muted/30"
                    )}
                  >
                    <div className="size-9 rounded-xl bg-primary/10 text-primary grid place-items-center text-sm font-semibold shrink-0">
                      {userName.charAt(0).toUpperCase()}
                    </div>
                    <div className="min-w-0 flex-1">
                      <div className="flex justify-between items-start gap-1">
                        <div className="flex items-center gap-1.5 min-w-0">
                          <h4 className="font-semibold text-sm text-ink truncate leading-tight">{userName}</h4>
                          <span className={cn(
                            "px-1.5 py-0.5 rounded text-[8px] font-extrabold uppercase tracking-wide shrink-0",
                            (userObj?.role === "agent" || userObj?.role === "cleaner")
                              ? "bg-indigo-100 text-indigo-850 border border-indigo-200"
                              : "bg-blue-100 text-blue-850 border border-blue-200"
                          )}>
                            {(userObj?.role === "agent" || userObj?.role === "cleaner") ? "Agent" : "Customer"}
                          </span>
                        </div>
                        <span className="text-[10px] text-muted whitespace-nowrap">
                          {new Date(t.updatedAt).toLocaleDateString([], { month: "short", day: "numeric" })}
                        </span>
                      </div>
                      <p className="text-xs text-muted truncate mt-1 leading-snug">{t.subject}</p>
                    </div>
                  </button>
                );
              })
            )}
          </div>
        </div>

        {/* Right Column: Chat Console */}
        <div className="flex-1 border border-line rounded-3xl bg-surface/50 backdrop-blur-md flex flex-col overflow-hidden">
          {selectedTicket ? (
            <div className="flex-1 flex flex-col overflow-hidden">
              {/* Header details */}
              <div className="flex items-center justify-between border-b border-line bg-surface-muted/40 px-6 py-4 shrink-0">
                <div className="flex items-center gap-3">
                  <div className="size-11 rounded-2xl bg-primary/10 text-primary grid place-items-center text-lg font-semibold shrink-0">
                    {(typeof selectedTicket.user === "object" && selectedTicket.user ? selectedTicket.user.name : "Customer").charAt(0).toUpperCase()}
                  </div>
                  <div className="min-w-0">
                    <div className="flex items-center gap-2">
                      <h3 className="font-display text-base font-bold text-ink truncate leading-tight">
                        {typeof selectedTicket.user === "object" && selectedTicket.user ? selectedTicket.user.name : "Customer"}
                      </h3>
                      {typeof selectedTicket.user === "object" && selectedTicket.user && (
                        (() => {
                          const isAgent = (selectedTicket.user as any).role === "agent" || (selectedTicket.user as any).role === "cleaner";
                          return (
                            <span className={cn(
                              "px-2 py-0.5 rounded-full text-[9px] font-bold uppercase tracking-wider shrink-0",
                              isAgent
                                ? "bg-indigo-100 text-indigo-850 border border-indigo-200"
                                : "bg-blue-100 text-blue-850 border border-blue-200"
                            )}>
                              {isAgent ? "Agent" : "Customer"}
                            </span>
                          );
                        })()
                      )}
                    </div>
                    <div className="flex items-center gap-4 mt-1 text-xs text-muted">
                      <span className="flex items-center gap-1">
                        <Mail className="size-3" /> {typeof selectedTicket.user === "object" && selectedTicket.user ? selectedTicket.user.email : "—"}
                      </span>
                      <span className="flex items-center gap-1">
                        <Phone className="size-3" /> {typeof selectedTicket.user === "object" && selectedTicket.user ? selectedTicket.user.phone : "—"}
                      </span>
                    </div>
                  </div>
                </div>

                <div className="flex items-center gap-2">
                  <Button
                    variant="outline"
                    size="sm"
                    className={cn(
                      "font-semibold",
                      selectedTicket.status === "open"
                        ? "text-red-500 border-red-200 hover:bg-red-50/15"
                        : "text-green-500 border-green-200 hover:bg-green-50/15"
                    )}
                    onClick={handleToggleStatus}
                  >
                    {selectedTicket.status === "open" ? (
                      <span className="flex items-center gap-1">
                        <Lock className="size-3.5" /> Close Ticket
                      </span>
                    ) : (
                      <span className="flex items-center gap-1">
                        <Unlock className="size-3.5" /> Reopen Ticket
                      </span>
                    )}
                  </Button>
                </div>
              </div>

              {/* Chat history */}
              <div className="flex-1 overflow-y-auto p-6 space-y-4 bg-surface-muted/10 min-h-0" data-lenis-prevent="true">
                {chatMessages.length === 0 ? (
                  <div className="h-full flex flex-col items-center justify-center text-center p-6 space-y-2">
                    <MessageSquare className="size-10 text-muted/60" />
                    <p className="text-sm font-medium text-muted">No messages yet. Send a message to start.</p>
                  </div>
                ) : (
                  chatMessages.map((msg) => {
                    const isOwn = msg.senderType === "staff";
                    return (
                      <div key={msg.id} className={cn("flex", isOwn ? "justify-end" : "justify-start")}>
                        <div
                          className={cn(
                            "max-w-[70%] rounded-2xl px-4 py-2.5 text-sm shadow-sm",
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

              {/* Chat Input field */}
              <div className="border-t border-line p-4 bg-surface shrink-0">
                {selectedTicket.status === "closed" ? (
                  <div className="flex items-center justify-center gap-1.5 rounded-xl bg-gray-50 border border-line/60 p-3.5 text-xs text-muted italic">
                    <Lock className="size-4 text-muted/80" />
                    <span>This ticket is closed. Reopen it above to respond.</span>
                  </div>
                ) : (
                  <div className="flex gap-2">
                    <input
                      type="text"
                      value={messageText}
                      onChange={(e) => setMessageText(e.target.value)}
                      onKeyDown={(e) => e.key === "Enter" && handleSendMessage()}
                      placeholder="Type your response here..."
                      className="flex-1 h-11 rounded-xl border border-line bg-surface-muted/30 px-4 text-sm text-ink outline-none transition-all focus:border-primary/50 focus:bg-surface focus:ring-1 focus:ring-primary/25"
                    />
                    <Button size="sm" className="h-11 px-4 rounded-xl" onClick={handleSendMessage} disabled={!messageText.trim()}>
                      <Send className="size-4" />
                    </Button>
                  </div>
                )}
              </div>
            </div>
          ) : (
            <div className="flex-1 flex flex-col items-center justify-center text-center p-8 space-y-3">
              <div className="grid size-16 place-items-center rounded-full bg-primary/10 text-primary">
                <MessageSquare className="size-8" />
              </div>
              <h3 className="font-display font-semibold text-lg text-ink">No Ticket Selected</h3>
              <p className="text-sm text-muted max-w-sm">
                Select a ticket from the open queue on the left side to begin live chatting with the customer.
              </p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
