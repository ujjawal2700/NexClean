import { jsx as _jsx, jsxs as _jsxs } from "react/jsx-runtime";
import { useState, useEffect, useRef } from "react";
import { io, Socket } from "socket.io-client";
import { MessageSquare, Send, Mail, Phone, Lock, Unlock, } from "lucide-react";
import { Button } from "@shared/ui/Button";
import { useSupportConfig, useSupportTickets, useTicketMessages } from "../../customer/api/queries";
import { useCloseTicket, useReopenTicket, useSendMessage, useUpdateSupportConfig, } from "../../customer/api/mutations";
import { useAdminSession } from "../store/sessionStore";
import { SOCKET_URL } from "@shared/lib/api";
import { cn } from "@shared/lib/utils";
export function ChatPanel() {
    const { data: supportConfig, refetch: refetchConfig } = useSupportConfig();
    const { data: tickets = [], refetch: refetchTickets } = useSupportTickets();
    const closeTicketMutation = useCloseTicket();
    const reopenTicketMutation = useReopenTicket();
    const sendMessageMutation = useSendMessage();
    const updateConfigMutation = useUpdateSupportConfig();
    const token = useAdminSession((s) => s.token);
    const [activeTab, setActiveTab] = useState("open");
    const [selectedRoleFilter, setSelectedRoleFilter] = useState("all");
    const [selectedTicketId, setSelectedTicketId] = useState(null);
    const [messageText, setMessageText] = useState("");
    const [chatMessages, setChatMessages] = useState([]);
    const [localOnlineStatus, setLocalOnlineStatus] = useState(false);
    // Refs
    const socketRef = useRef(null);
    const messagesEndRef = useRef(null);
    const activeTicketIdRef = useRef(null);
    const selectedTicket = tickets.find((t) => t.id === selectedTicketId);
    const filteredTickets = tickets.filter((t) => {
        if (t.status !== activeTab)
            return false;
        if (typeof t.user === "object" && t.user) {
            const userRole = t.user.role;
            const isAgent = userRole === "agent" || userRole === "cleaner";
            if (selectedRoleFilter === "customer" && userRole !== "customer")
                return false;
            if (selectedRoleFilter === "agent" && !isAgent)
                return false;
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
        if (!token)
            return;
        const socket = io(SOCKET_URL, {
            auth: { token },
            transports: ["websocket"],
        });
        socketRef.current = socket;
        socket.on("connect", () => {
            console.log("✓ Admin connected to support socket");
        });
        socket.on("support_status", (data) => {
            setLocalOnlineStatus(data.isOnline);
            refetchConfig();
        });
        // Refresh tickets list on queue updates (e.g. new message, status change, new ticket)
        socket.on("ticket_update", (data) => {
            refetchTickets();
            // If the incoming message belongs to the currently active ticket, append it
            if (data.lastMessage && activeTicketIdRef.current === data.ticketId) {
                setChatMessages((prev) => {
                    if (prev.some((m) => m.id === data.lastMessage.id))
                        return prev;
                    return [...prev, data.lastMessage];
                });
            }
        });
        socket.on("ticket_status_change", (data) => {
            if (activeTicketIdRef.current === data.ticketId) {
                refetchTickets();
            }
        });
        return () => {
            socket.disconnect();
            socketRef.current = null;
        };
    }, [token]);
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
        if (!messageText.trim() || !selectedTicketId)
            return;
        const text = messageText.trim();
        setMessageText("");
        try {
            await sendMessageMutation.mutateAsync({
                ticketId: selectedTicketId,
                text,
            });
        }
        catch (err) {
            console.error("Failed to send message:", err);
        }
    };
    const handleToggleStatus = async () => {
        if (!selectedTicket)
            return;
        const { id, status } = selectedTicket;
        try {
            if (status === "open") {
                await closeTicketMutation.mutateAsync(id);
            }
            else {
                await reopenTicketMutation.mutateAsync(id);
            }
            refetchTickets();
        }
        catch (err) {
            console.error("Failed to toggle ticket status:", err);
        }
    };
    const handleUpdateStatusMode = async (mode) => {
        try {
            await updateConfigMutation.mutateAsync(mode);
            refetchConfig();
        }
        catch (err) {
            console.error("Failed to update status config:", err);
        }
    };
    const currentManualStatus = supportConfig?.manualSupportStatus ?? "auto";
    return (_jsxs("div", { className: "space-y-6 h-[82vh] flex flex-col", children: [_jsxs("div", { className: "flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between shrink-0", children: [_jsxs("div", { children: [_jsx("h1", { className: "font-display text-3xl text-ink", children: "Support Live Chat" }), _jsx("p", { className: "mt-1 text-muted", children: "Respond to active user queries and manage support status." })] }), _jsxs("div", { className: "flex items-center gap-3 bg-surface border border-line p-1.5 rounded-2xl shadow-sm", children: [_jsx("span", { className: "text-xs text-muted font-medium px-2", children: "Support Status:" }), _jsxs("button", { onClick: () => handleUpdateStatusMode("auto"), className: cn("px-3 py-1.5 rounded-xl text-xs font-semibold transition-all", currentManualStatus === "auto"
                                    ? "bg-primary text-white shadow-sm"
                                    : "text-muted hover:text-ink hover:bg-surface-muted"), children: ["Auto (", localOnlineStatus ? "Online" : "Offline", ")"] }), _jsx("button", { onClick: () => handleUpdateStatusMode("online"), className: cn("px-3 py-1.5 rounded-xl text-xs font-semibold transition-all", currentManualStatus === "online"
                                    ? "bg-green-500 text-white shadow-sm"
                                    : "text-muted hover:text-green-600 hover:bg-green-50/15"), children: "Force Online" }), _jsx("button", { onClick: () => handleUpdateStatusMode("offline"), className: cn("px-3 py-1.5 rounded-xl text-xs font-semibold transition-all", currentManualStatus === "offline"
                                    ? "bg-red-500 text-white shadow-sm"
                                    : "text-muted hover:text-red-600 hover:bg-red-50/15"), children: "Force Offline" })] })] }), _jsxs("div", { className: "flex-1 flex gap-5 overflow-hidden min-h-0", children: [_jsxs("div", { className: "w-80 shrink-0 border border-line rounded-3xl bg-surface/50 backdrop-blur-md flex flex-col overflow-hidden", children: [_jsxs("div", { className: "flex border-b border-line bg-surface-muted/30 p-1.5 gap-1 shrink-0", children: [_jsx("button", { onClick: () => {
                                            setActiveTab("open");
                                            setSelectedTicketId(null);
                                        }, className: cn("flex-1 py-2 text-xs font-semibold rounded-xl transition-all", activeTab === "open"
                                            ? "bg-surface text-primary border border-line shadow-sm"
                                            : "text-muted hover:text-ink"), children: "Open Queue" }), _jsx("button", { onClick: () => {
                                            setActiveTab("closed");
                                            setSelectedTicketId(null);
                                        }, className: cn("flex-1 py-2 text-xs font-semibold rounded-xl transition-all", activeTab === "closed"
                                            ? "bg-surface text-primary border border-line shadow-sm"
                                            : "text-muted hover:text-ink"), children: "Closed History" })] }), _jsxs("div", { className: "flex border-b border-line bg-surface p-1.5 gap-1 shrink-0", children: [_jsx("button", { onClick: () => setSelectedRoleFilter("all"), className: cn("flex-1 py-1 px-2 text-[10px] uppercase font-bold rounded-lg transition-all border cursor-pointer", selectedRoleFilter === "all"
                                            ? "bg-ink-soft text-white border-ink shadow-sm"
                                            : "border-transparent text-muted hover:text-ink hover:bg-surface-muted"), children: "All" }), _jsx("button", { onClick: () => setSelectedRoleFilter("customer"), className: cn("flex-1 py-1 px-2 text-[10px] uppercase font-bold rounded-lg transition-all border cursor-pointer", selectedRoleFilter === "customer"
                                            ? "bg-primary text-white border-primary shadow-sm"
                                            : "border-transparent text-muted hover:text-primary hover:bg-primary/5"), children: "Customers" }), _jsx("button", { onClick: () => setSelectedRoleFilter("agent"), className: cn("flex-1 py-1 px-2 text-[10px] uppercase font-bold rounded-lg transition-all border cursor-pointer", selectedRoleFilter === "agent"
                                            ? "bg-indigo-600 text-white border-indigo-600 shadow-sm"
                                            : "border-transparent text-muted hover:text-indigo-600 hover:bg-indigo-50/10"), children: "Agents" })] }), _jsx("div", { className: "flex-1 overflow-y-auto divide-y divide-line/60", "data-lenis-prevent": "true", children: filteredTickets.length === 0 ? (_jsxs("div", { className: "p-8 text-center text-xs text-muted italic", children: ["No ", activeTab, " tickets found."] })) : (filteredTickets.map((t) => {
                                    const userObj = typeof t.user === "object" && t.user ? t.user : null;
                                    const userName = userObj?.name || "Customer";
                                    const isSelected = selectedTicketId === t.id;
                                    return (_jsxs("button", { onClick: () => setSelectedTicketId(t.id), className: cn("w-full text-left p-4 flex gap-3 transition-colors focus:outline-none", isSelected
                                            ? "bg-primary/5 border-l-4 border-l-primary"
                                            : "hover:bg-surface-muted/30"), children: [_jsx("div", { className: "size-9 rounded-xl bg-primary/10 text-primary grid place-items-center text-sm font-semibold shrink-0", children: userName.charAt(0).toUpperCase() }), _jsxs("div", { className: "min-w-0 flex-1", children: [_jsxs("div", { className: "flex justify-between items-start gap-1", children: [_jsxs("div", { className: "flex items-center gap-1.5 min-w-0", children: [_jsx("h4", { className: "font-semibold text-sm text-ink truncate leading-tight", children: userName }), _jsx("span", { className: cn("px-1.5 py-0.5 rounded text-[8px] font-extrabold uppercase tracking-wide shrink-0", (userObj?.role === "agent" || userObj?.role === "cleaner")
                                                                            ? "bg-indigo-100 text-indigo-850 border border-indigo-200"
                                                                            : "bg-blue-100 text-blue-850 border border-blue-200"), children: (userObj?.role === "agent" || userObj?.role === "cleaner") ? "Agent" : "Customer" })] }), _jsx("span", { className: "text-[10px] text-muted whitespace-nowrap", children: new Date(t.updatedAt).toLocaleDateString([], { month: "short", day: "numeric" }) })] }), _jsx("p", { className: "text-xs text-muted truncate mt-1 leading-snug", children: t.subject })] })] }, t.id));
                                })) })] }), _jsx("div", { className: "flex-1 border border-line rounded-3xl bg-surface/50 backdrop-blur-md flex flex-col overflow-hidden", children: selectedTicket ? (_jsxs("div", { className: "flex-1 flex flex-col overflow-hidden", children: [_jsxs("div", { className: "flex items-center justify-between border-b border-line bg-surface-muted/40 px-6 py-4 shrink-0", children: [_jsxs("div", { className: "flex items-center gap-3", children: [_jsx("div", { className: "size-11 rounded-2xl bg-primary/10 text-primary grid place-items-center text-lg font-semibold shrink-0", children: (typeof selectedTicket.user === "object" && selectedTicket.user ? selectedTicket.user.name : "Customer").charAt(0).toUpperCase() }), _jsxs("div", { className: "min-w-0", children: [_jsxs("div", { className: "flex items-center gap-2", children: [_jsx("h3", { className: "font-display text-base font-bold text-ink truncate leading-tight", children: typeof selectedTicket.user === "object" && selectedTicket.user ? selectedTicket.user.name : "Customer" }), typeof selectedTicket.user === "object" && selectedTicket.user && ((() => {
                                                                    const isAgent = selectedTicket.user.role === "agent" || selectedTicket.user.role === "cleaner";
                                                                    return (_jsx("span", { className: cn("px-2 py-0.5 rounded-full text-[9px] font-bold uppercase tracking-wider shrink-0", isAgent
                                                                            ? "bg-indigo-100 text-indigo-850 border border-indigo-200"
                                                                            : "bg-blue-100 text-blue-850 border border-blue-200"), children: isAgent ? "Agent" : "Customer" }));
                                                                })())] }), _jsxs("div", { className: "flex items-center gap-4 mt-1 text-xs text-muted", children: [_jsxs("span", { className: "flex items-center gap-1", children: [_jsx(Mail, { className: "size-3" }), " ", typeof selectedTicket.user === "object" && selectedTicket.user ? selectedTicket.user.email : "—"] }), _jsxs("span", { className: "flex items-center gap-1", children: [_jsx(Phone, { className: "size-3" }), " ", typeof selectedTicket.user === "object" && selectedTicket.user ? selectedTicket.user.phone : "—"] })] })] })] }), _jsx("div", { className: "flex items-center gap-2", children: _jsx(Button, { variant: "outline", size: "sm", className: cn("font-semibold", selectedTicket.status === "open"
                                                    ? "text-red-500 border-red-200 hover:bg-red-50/15"
                                                    : "text-green-500 border-green-200 hover:bg-green-50/15"), onClick: handleToggleStatus, children: selectedTicket.status === "open" ? (_jsxs("span", { className: "flex items-center gap-1", children: [_jsx(Lock, { className: "size-3.5" }), " Close Ticket"] })) : (_jsxs("span", { className: "flex items-center gap-1", children: [_jsx(Unlock, { className: "size-3.5" }), " Reopen Ticket"] })) }) })] }), _jsxs("div", { className: "flex-1 overflow-y-auto p-6 space-y-4 bg-surface-muted/10 min-h-0", "data-lenis-prevent": "true", children: [chatMessages.length === 0 ? (_jsxs("div", { className: "h-full flex flex-col items-center justify-center text-center p-6 space-y-2", children: [_jsx(MessageSquare, { className: "size-10 text-muted/60" }), _jsx("p", { className: "text-sm font-medium text-muted", children: "No messages yet. Send a message to start." })] })) : (chatMessages.map((msg) => {
                                            const isOwn = msg.senderType === "staff";
                                            return (_jsx("div", { className: cn("flex", isOwn ? "justify-end" : "justify-start"), children: _jsxs("div", { className: cn("max-w-[70%] rounded-2xl px-4 py-2.5 text-sm shadow-sm", isOwn
                                                        ? "bg-primary text-white rounded-tr-none"
                                                        : "bg-surface border border-line text-ink rounded-tl-none"), children: [_jsx("p", { className: "leading-relaxed whitespace-pre-line", children: msg.text }), _jsx("span", { className: cn("block mt-1 text-[9px] text-right", isOwn ? "text-white/70" : "text-muted"), children: new Date(msg.createdAt).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }) })] }) }, msg.id));
                                        })), _jsx("div", { ref: messagesEndRef })] }), _jsx("div", { className: "border-t border-line p-4 bg-surface shrink-0", children: selectedTicket.status === "closed" ? (_jsxs("div", { className: "flex items-center justify-center gap-1.5 rounded-xl bg-gray-50 border border-line/60 p-3.5 text-xs text-muted italic", children: [_jsx(Lock, { className: "size-4 text-muted/80" }), _jsx("span", { children: "This ticket is closed. Reopen it above to respond." })] })) : (_jsxs("div", { className: "flex gap-2", children: [_jsx("input", { type: "text", value: messageText, onChange: (e) => setMessageText(e.target.value), onKeyDown: (e) => e.key === "Enter" && handleSendMessage(), placeholder: "Type your response here...", className: "flex-1 h-11 rounded-xl border border-line bg-surface-muted/30 px-4 text-sm text-ink outline-none transition-all focus:border-primary/50 focus:bg-surface focus:ring-1 focus:ring-primary/25" }), _jsx(Button, { size: "sm", className: "h-11 px-4 rounded-xl", onClick: handleSendMessage, disabled: !messageText.trim(), children: _jsx(Send, { className: "size-4" }) })] })) })] })) : (_jsxs("div", { className: "flex-1 flex flex-col items-center justify-center text-center p-8 space-y-3", children: [_jsx("div", { className: "grid size-16 place-items-center rounded-full bg-primary/10 text-primary", children: _jsx(MessageSquare, { className: "size-8" }) }), _jsx("h3", { className: "font-display font-semibold text-lg text-ink", children: "No Ticket Selected" }), _jsx("p", { className: "text-sm text-muted max-w-sm", children: "Select a ticket from the open queue on the left side to begin live chatting with the customer." })] })) })] })] }));
}
