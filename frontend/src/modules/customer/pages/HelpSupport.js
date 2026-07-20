import { jsx as _jsx, jsxs as _jsxs } from "react/jsx-runtime";
import { useState, useEffect, useRef } from "react";
import { io, Socket } from "socket.io-client";
import { HelpCircle, ChevronDown, ChevronUp, MessageSquare, Send, ArrowLeft, Lock, } from "lucide-react";
import { GlassCard } from "@shared/ui/GlassCard";
import { Button } from "@shared/ui/Button";
import { useMe, useSiteContent, useSupportConfig, useSupportTickets, useTicketMessages } from "../api/queries";
import { useCreateTicket, useCloseTicket, useSendMessage } from "../api/mutations";
import { useSessionStore } from "../store/sessionStore";
import { SOCKET_URL } from "@shared/lib/api";
import { cn } from "@shared/lib/utils";
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
    const token = useSessionStore((s) => s.token);
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
    return (_jsxs("div", { className: "space-y-8", children: [_jsx("div", { className: "flex items-center justify-between", children: _jsxs("div", { children: [_jsxs("div", { className: "flex items-center gap-3", children: [_jsx("button", { onClick: () => navigate(-1), className: "flex items-center justify-center size-9 rounded-xl border border-line bg-surface text-ink-soft hover:text-primary transition-colors cursor-pointer shrink-0", "aria-label": "Back", children: _jsx(ArrowLeft, { className: "size-4" }) }), _jsx("h1", { className: "font-display text-3xl text-ink", children: "Help & Support" })] }), _jsx("p", { className: "mt-2 text-sm text-muted pl-12", children: "Browse frequently asked questions or chat with support agents." })] }) }), !isChatOpen ? (_jsxs("div", { className: "grid gap-6 lg:grid-cols-[1.5fr_1fr]", children: [_jsxs(GlassCard, { className: "space-y-4", children: [_jsxs("div", { className: "flex items-center gap-2 border-b border-line/50 pb-3", children: [_jsx(HelpCircle, { className: "size-5 text-primary" }), _jsx("h2", { className: "font-display text-lg font-semibold text-ink", children: "Frequently Asked Questions" })] }), faqs.length === 0 ? (_jsx("p", { className: "text-sm text-muted py-6 text-center", children: "No FAQs available at the moment." })) : (_jsx("div", { className: "divide-y divide-line/60", children: faqs.map((faq, index) => {
                                    const isOpen = openFaqIndex === index;
                                    return (_jsxs("div", { className: "py-4 first:pt-0 last:pb-0", children: [_jsxs("button", { onClick: () => setOpenFaqIndex(isOpen ? null : index), className: "flex w-full items-center justify-between text-left font-display font-medium text-ink hover:text-primary transition-colors focus:outline-none", children: [_jsx("span", { children: faq.q }), isOpen ? _jsx(ChevronUp, { className: "size-4 shrink-0" }) : _jsx(ChevronDown, { className: "size-4 shrink-0" })] }), isOpen && _jsx("p", { className: "mt-2.5 text-sm text-muted leading-relaxed whitespace-pre-line", children: faq.a })] }, index));
                                }) }))] }), _jsx("div", { className: "space-y-5", children: _jsxs(GlassCard, { className: "flex flex-col justify-between h-full space-y-6", children: [_jsxs("div", { className: "space-y-4", children: [_jsxs("div", { className: "flex items-center gap-3", children: [_jsx("div", { className: "grid size-11 place-items-center rounded-2xl bg-primary/10 text-primary", children: _jsx(MessageSquare, { className: "size-6" }) }), _jsxs("div", { children: [_jsx("h3", { className: "font-display text-lg font-semibold text-ink", children: "Live Support Chat" }), _jsx("p", { className: "text-xs text-muted", children: "Get assistance from our representatives" })] })] }), _jsxs("div", { className: "flex items-center gap-2 rounded-2xl border border-line bg-surface-muted/30 px-4 py-3 text-sm", children: [_jsx("span", { className: cn("size-2.5 rounded-full shrink-0 animate-pulse", isSupportOnline ? "bg-green-500" : "bg-gray-400") }), _jsx("span", { className: "font-medium text-ink-soft", children: isSupportOnline ? "Support is Online (Fast response)" : "Support is Offline (Leave a message)" })] }), _jsx("p", { className: "text-sm text-muted leading-relaxed", children: "Have issues with a wash, payment, or subscription? Start a live chat session to get immediate answers." })] }), _jsx(Button, { onClick: handleStartChat, className: "w-full", children: openTicket ? "Resume Support Chat" : "Start Live Chat" })] }) })] })) : (
            /* Render 2: Active Chat Interface */
            _jsx("div", { className: "max-w-3xl mx-auto", children: _jsxs(GlassCard, { className: "flex flex-col h-[70vh] border border-line/75 p-0 overflow-hidden bg-surface/50", children: [_jsxs("div", { className: "flex items-center justify-between border-b border-line bg-surface-muted/50 px-5 py-4", children: [_jsxs("div", { className: "flex items-center gap-3", children: [_jsx("button", { onClick: () => setIsChatOpen(false), className: "p-1 rounded-lg text-muted hover:text-ink hover:bg-surface transition-colors", children: _jsx(ArrowLeft, { className: "size-5" }) }), _jsxs("div", { children: [_jsx("h2", { className: "font-display font-semibold text-ink leading-tight", children: "Live Chat Support" }), _jsxs("div", { className: "flex items-center gap-1.5 mt-0.5", children: [_jsx("span", { className: cn("size-2 rounded-full", isSupportOnline ? "bg-green-500" : "bg-gray-400") }), _jsx("span", { className: "text-[10px] text-muted font-medium", children: isSupportOnline ? "Online" : "Away" })] })] })] }), activeTicket?.status === "open" && (_jsx(Button, { variant: "outline", size: "sm", className: "text-red-500 border-red-200 hover:bg-red-50/15", onClick: handleCloseTicket, children: "Close Chat" }))] }), _jsxs("div", { className: "flex-1 overflow-y-auto p-5 space-y-4 bg-surface-muted/10", "data-lenis-prevent": "true", children: [chatMessages.length === 0 ? (_jsxs("div", { className: "h-full flex flex-col items-center justify-center text-center p-6 space-y-3", children: [_jsx(MessageSquare, { className: "size-10 text-muted/65" }), _jsx("p", { className: "text-sm font-medium text-muted", children: "No messages yet. Send a message to start the conversation." })] })) : (chatMessages.map((msg) => {
                                    const isOwn = msg.sender === me?.id;
                                    return (_jsx("div", { className: cn("flex", isOwn ? "justify-end" : "justify-start"), children: _jsxs("div", { className: cn("max-w-[75%] rounded-2xl px-4 py-2.5 text-sm shadow-sm", isOwn
                                                ? "bg-primary text-white rounded-tr-none"
                                                : "bg-surface border border-line text-ink rounded-tl-none"), children: [_jsx("p", { className: "leading-relaxed whitespace-pre-line", children: msg.text }), _jsx("span", { className: cn("block mt-1 text-[9px] text-right", isOwn ? "text-white/70" : "text-muted"), children: new Date(msg.createdAt).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }) })] }) }, msg.id));
                                })), _jsx("div", { ref: messagesEndRef })] }), _jsx("div", { className: "border-t border-line p-4 bg-surface", children: activeTicket?.status === "closed" ? (_jsxs("div", { className: "flex items-center justify-center gap-1.5 rounded-xl bg-gray-50 border border-line/60 p-3 text-xs text-muted italic", children: [_jsx(Lock, { className: "size-4 text-muted/80" }), _jsx("span", { children: "This ticket is closed. Click back and start a new chat if you have another query." })] })) : (_jsxs("div", { className: "flex gap-2", children: [_jsx("input", { type: "text", value: messageText, onChange: (e) => setMessageText(e.target.value), onKeyDown: (e) => e.key === "Enter" && handleSendMessage(), placeholder: "Type your message here...", className: "flex-1 h-11 rounded-xl border border-line bg-surface-muted/30 px-4 text-sm text-ink outline-none transition-all focus:border-primary/50 focus:bg-surface focus:ring-1 focus:ring-primary/25" }), _jsx(Button, { size: "sm", className: "h-11 px-4 rounded-xl", onClick: handleSendMessage, disabled: !messageText.trim(), children: _jsx(Send, { className: "size-4" }) })] })) })] }) }))] }));
}
