import { jsx as _jsx, jsxs as _jsxs } from "react/jsx-runtime";
import { useState, useEffect, useRef } from "react";
import { io, Socket } from "socket.io-client";
import { HelpCircle, ChevronDown, ChevronUp, MessageSquare, Send, ArrowLeft, Lock, } from "lucide-react";
import { GlassCard } from "@shared/ui/GlassCard";
import { Button } from "@shared/ui/Button";
import { SOCKET_URL } from "@shared/lib/api";
import { cn } from "@shared/lib/utils";
import { useNavigate } from "react-router-dom";
import { useAgentSession } from "../store/sessionStore";
import { useMe, useSiteContent, useSupportConfig, useSupportTickets, useTicketMessages, } from "../../customer/api/queries";
import { useCreateTicket, useCloseTicket, useSendMessage, } from "../../customer/api/mutations";
export function HelpSupport() {
    const navigate = useNavigate();
    const { data: me } = useMe();
    const { data: siteContent } = useSiteContent();
    const { data: supportConfig } = useSupportConfig();
    const { data: tickets = [], refetch: refetchTickets } = useSupportTickets();
    const createTicketMutation = useCreateTicket();
    const closeTicketMutation = useCloseTicket();
    const sendMessageMutation = useSendMessage();
    const token = useAgentSession((s) => s.token);
    // UI state
    const [openFaqIndex, setOpenFaqIndex] = useState(null);
    const [activeTicket, setActiveTicket] = useState(null);
    const [isChatOpen, setIsChatOpen] = useState(false);
    const [messageText, setMessageText] = useState("");
    const [chatMessages, setChatMessages] = useState([]);
    const [isSupportOnline, setIsSupportOnline] = useState(false);
    // Refs
    const socketRef = useRef(null);
    const messagesEndRef = useRef(null);
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
        if (!isChatOpen || !token) {
            if (socketRef.current) {
                socketRef.current.disconnect();
                socketRef.current = null;
            }
            return;
        }
        const socket = io(SOCKET_URL, {
            auth: { token },
            transports: ["websocket"],
        });
        socketRef.current = socket;
        socket.on("connect", () => {
            console.log("✓ Connected to support socket");
            if (activeTicket) {
                socket.emit("join_ticket", activeTicket.id);
            }
        });
        socket.on("support_status", (data) => {
            setIsSupportOnline(data.isOnline);
        });
        socket.on("new_message", (msg) => {
            setChatMessages((prev) => {
                // Prevent duplicate local messages
                if (prev.some((m) => m.id === msg.id))
                    return prev;
                return [...prev, msg];
            });
        });
        socket.on("ticket_status_change", (data) => {
            if (activeTicket && data.ticketId === activeTicket.id) {
                setActiveTicket((prev) => (prev ? { ...prev, status: data.status } : null));
                refetchTickets();
            }
        });
        return () => {
            socket.disconnect();
            socketRef.current = null;
        };
    }, [isChatOpen, activeTicket?.id, token]);
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
            }
            catch (err) {
                console.error("Failed to open support ticket:", err);
                return;
            }
        }
        setActiveTicket(ticket);
        setIsChatOpen(true);
    };
    const handleSendMessage = async () => {
        if (!messageText.trim() || !activeTicket)
            return;
        const text = messageText.trim();
        setMessageText("");
        try {
            await sendMessageMutation.mutateAsync({
                ticketId: activeTicket.id,
                text,
            });
        }
        catch (err) {
            console.error("Failed to send message:", err);
        }
    };
    const handleCloseTicket = async () => {
        if (!activeTicket)
            return;
        if (window.confirm("Are you sure you want to close this ticket? It will end this conversation.")) {
            try {
                await closeTicketMutation.mutateAsync(activeTicket.id);
                refetchTickets();
                setIsChatOpen(false);
                setActiveTicket(null);
            }
            catch (err) {
                console.error("Failed to close ticket:", err);
            }
        }
    };
    return (_jsxs("div", { className: "space-y-8", children: [_jsx("div", { className: "flex items-center justify-between", children: _jsxs("div", { children: [_jsxs("div", { className: "flex items-center gap-3", children: [_jsx("button", { onClick: () => navigate(-1), className: "flex items-center justify-center size-9 rounded-xl border border-line bg-surface text-ink-soft hover:text-primary transition-colors cursor-pointer shrink-0", "aria-label": "Back", children: _jsx(ArrowLeft, { className: "size-4" }) }), _jsx("h1", { className: "font-display text-3xl text-ink", children: "Help & Support" })] }), _jsx("p", { className: "mt-2 text-sm text-muted pl-12", children: "Browse frequently asked questions or chat with support agents." })] }) }), !isChatOpen ? (_jsxs("div", { className: "grid gap-6 lg:grid-cols-[1.5fr_1fr]", children: [_jsxs(GlassCard, { className: "space-y-4", children: [_jsxs("div", { className: "flex items-center gap-2 border-b border-line/50 pb-3", children: [_jsx(HelpCircle, { className: "size-5 text-primary" }), _jsx("h2", { className: "font-display text-lg font-semibold text-ink", children: "Frequently Asked Questions" })] }), faqs.length === 0 ? (_jsx("p", { className: "text-sm text-muted", children: "No FAQs available at this time." })) : (_jsx("div", { className: "divide-y divide-line/60", children: faqs.map((faq, idx) => {
                                    const isOpen = openFaqIndex === idx;
                                    return (_jsxs("div", { className: "py-3.5 first:pt-0 last:pb-0", children: [_jsxs("button", { onClick: () => setOpenFaqIndex(isOpen ? null : idx), className: "flex w-full items-center justify-between text-left font-display font-medium text-ink hover:text-primary transition-colors", children: [_jsx("span", { children: faq.q }), isOpen ? _jsx(ChevronUp, { className: "size-4 shrink-0" }) : _jsx(ChevronDown, { className: "size-4 shrink-0" })] }), isOpen && (_jsx("p", { className: "mt-2 text-sm text-ink-soft leading-relaxed pr-6 animate-slide-down", children: faq.a }))] }, idx));
                                }) }))] }), _jsx("div", { className: "space-y-4", children: _jsxs(GlassCard, { className: "text-center space-y-4", children: [_jsx("div", { className: "mx-auto flex size-12 items-center justify-center rounded-full bg-primary/10 text-primary", children: _jsx(MessageSquare, { className: "size-6" }) }), _jsxs("div", { className: "space-y-1", children: [_jsx("h3", { className: "font-display text-lg font-semibold text-ink", children: "Live Support Chat" }), _jsx("p", { className: "text-sm text-muted leading-relaxed", children: "Have a question about a wash or need help with a payout? Chat live with our operations team." })] }), _jsxs("div", { className: "flex items-center justify-center gap-2 text-sm", children: [_jsxs("span", { className: "relative flex size-2", children: [isSupportOnline && (_jsx("span", { className: "absolute inline-flex h-full w-full animate-ping rounded-full bg-emerald-400 opacity-75" })), _jsx("span", { className: cn("relative inline-flex size-2 rounded-full", isSupportOnline ? "bg-emerald-500" : "bg-muted") })] }), _jsxs("span", { className: "font-medium text-ink-soft", children: ["Support is ", isSupportOnline ? "Online" : "Offline"] })] }), _jsx(Button, { onClick: handleStartChat, className: "w-full", children: openTicket ? "Resume chat" : "Start a chat" })] }) })] })) : (
            /* Chat Workspace Interface */
            _jsxs(GlassCard, { className: "flex h-[600px] flex-col p-0 overflow-hidden border border-line bg-surface shadow-lg", children: [_jsxs("div", { className: "flex items-center justify-between border-b border-line p-4 bg-surface-muted/15", children: [_jsxs("div", { className: "flex items-center gap-3", children: [_jsx("button", { onClick: () => setIsChatOpen(false), className: "grid size-8 place-items-center rounded-lg hover:bg-surface-muted transition-colors text-ink-soft", "aria-label": "Back to FAQs", children: _jsx(ArrowLeft, { className: "size-5" }) }), _jsxs("div", { children: [_jsx("p", { className: "font-display font-semibold text-ink", children: "Live Chat Support" }), _jsxs("div", { className: "flex items-center gap-1.5 text-xs text-muted", children: [_jsx("span", { className: cn("size-1.5 rounded-full", isSupportOnline ? "bg-emerald-500" : "bg-muted") }), _jsx("span", { children: isSupportOnline ? "Online" : "Offline" })] })] })] }), _jsx(Button, { variant: "ghost", size: "sm", onClick: handleCloseTicket, className: "text-red-500 hover:text-red-600 hover:bg-red-50/10", children: "Close Ticket" })] }), _jsxs("div", { className: "flex-1 overflow-y-auto p-5 space-y-4 bg-surface-muted/10", "data-lenis-prevent": "true", children: [chatMessages.length === 0 ? (_jsxs("div", { className: "h-full flex flex-col items-center justify-center text-center p-6 space-y-3", children: [_jsx(MessageSquare, { className: "size-10 text-muted/65" }), _jsxs("div", { className: "space-y-1", children: [_jsx("p", { className: "font-display font-medium text-ink", children: "No messages yet" }), _jsx("p", { className: "text-xs text-muted max-w-[240px]", children: "Type a message and hit send to start conversation." })] })] })) : (chatMessages.map((msg) => {
                                const isMe = msg.sender === me?.id;
                                return (_jsxs("div", { className: cn("flex flex-col max-w-[75%]", isMe ? "ml-auto items-end" : "mr-auto items-start"), children: [_jsx("div", { className: cn("rounded-2xl px-4 py-2.5 text-sm leading-relaxed shadow-sm", isMe
                                                ? "bg-primary text-white rounded-br-none"
                                                : "bg-surface-muted text-ink border border-line rounded-bl-none"), children: _jsx("p", { className: "break-words", children: msg.text }) }), _jsx("span", { className: "mt-1.5 text-[10px] text-muted pr-1", children: new Date(msg.createdAt).toLocaleTimeString("en-IN", {
                                                hour: "2-digit",
                                                minute: "2-digit",
                                                hour12: false,
                                            }) })] }, msg.id));
                            })), _jsx("div", { ref: messagesEndRef })] }), _jsx("div", { className: "border-t border-line p-4 bg-surface", children: activeTicket?.status === "closed" ? (_jsxs("div", { className: "flex items-center justify-center gap-2 p-2 rounded-xl bg-muted/10 border border-line text-sm text-muted", children: [_jsx(Lock, { className: "size-4" }), _jsx("span", { children: "This ticket has been closed. Click back to start a new chat." })] })) : (_jsxs("form", { onSubmit: (e) => {
                                e.preventDefault();
                                handleSendMessage();
                            }, className: "flex items-center gap-2", children: [_jsx("input", { type: "text", placeholder: "Type your message here...", value: messageText, onChange: (e) => setMessageText(e.target.value), className: "flex-1 rounded-xl border border-line bg-surface-muted/30 px-4 py-2.5 text-sm text-ink placeholder-muted focus:border-primary focus:bg-surface focus:outline-none" }), _jsx(Button, { type: "submit", size: "sm", disabled: !messageText.trim(), className: "rounded-xl size-[42px] shrink-0", children: _jsx(Send, { className: "size-4" }) })] })) })] }))] }));
}
