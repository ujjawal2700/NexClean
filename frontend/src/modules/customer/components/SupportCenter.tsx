import { ChatComposer } from "@shared/components/chat/ChatComposer";
import { ChatImage } from "@shared/components/chat/ChatImage";
import { FullscreenChat } from "@shared/components/chat/FullscreenChat";
import { useEffect, useMemo, useRef, useState, type ComponentType } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { io, type Socket } from "socket.io-client";
import {
  ArrowLeft,
  CalendarCheck,
  ChevronDown,
  ChevronRight,
  CircleHelp,
  CreditCard,
  Loader2,
  Lock,
  MessageSquare,
  RotateCcw,
  Smartphone,
  UserCog,
} from "lucide-react";
import { cn } from "@shared/lib/utils";
import { GlassCard } from "@shared/ui/GlassCard";
import { Button } from "@shared/ui/Button";
import { ApiError, SOCKET_URL } from "@shared/lib/api";
import { useMe, useSiteContent, useSupportConfig, useSupportTickets, useTicketMessages } from "../api/queries";
import { useCloseTicket, useCreateTicket, useReopenTicket, useSendMessage } from "../api/mutations";
import type { ChatMessage, SupportTicket, SupportTopic } from "../types";

/** A job/booking the person can ask about. */
export type SupportJob = { id: string; title: string; subtitle: string; status: string };

type GeneralTopic = Exclude<SupportTopic, "booking">;

const GENERAL_TOPICS: { id: GeneralTopic; label: string; hint: string; icon: ComponentType<{ className?: string }> }[] = [
  { id: "payment", label: "Payments & refunds", hint: "Charges, refunds, coins", icon: CreditCard },
  { id: "account", label: "Account & profile", hint: "Login, details, addresses", icon: UserCog },
  { id: "app", label: "App problem", hint: "Something isn't working", icon: Smartphone },
  { id: "other", label: "Something else", hint: "Anything we haven't listed", icon: CircleHelp },
];

const TOPIC_LABEL: Record<SupportTopic, string> = {
  booking: "Booking",
  payment: "Payments & refunds",
  account: "Account & profile",
  app: "App problem",
  other: "Something else",
};

function formatDay(iso: string) {
  return new Date(iso).toLocaleDateString("en-IN", { day: "numeric", month: "short" });
}
function formatTime(iso: string) {
  return new Date(iso).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
}

/** "Express Wash · 3 Oct, 09:30 AM" — what a conversation is about. */
function contextLine(t: SupportTicket): string {
  if (t.booking) return `${formatDay(t.booking.date)} · ${t.booking.slot}`;
  return TOPIC_LABEL[t.topic ?? "other"];
}

/**
 * Help & Support for customers and cleaners. Asks first what the problem is
 * about — a specific booking/job, or a general topic — and keeps a separate
 * conversation for each, so support sees the job in question without asking
 * and two issues never tangle in one thread.
 */
export function SupportCenter({
  role,
  authenticated,
  jobs,
  jobNoun,
}: {
  role: "customer" | "agent";
  authenticated: boolean;
  /** Recent bookings (customer) or jobs (cleaner), newest first. */
  jobs: SupportJob[];
  /** "booking" or "job" — how this app talks about them. */
  jobNoun: "booking" | "job";
}) {
  const navigate = useNavigate();
  const { data: me } = useMe();
  const { data: siteContent } = useSiteContent();
  const { data: supportConfig } = useSupportConfig();
  const { data: tickets = [], refetch: refetchTickets } = useSupportTickets();
  const createTicket = useCreateTicket();
  const closeTicket = useCloseTicket();
  const reopenTicket = useReopenTicket();
  const sendMessage = useSendMessage();

  const [view, setView] = useState<"home" | "pickJob" | "chat">("home");
  const [activeId, setActiveId] = useState<string | null>(null);
  const [startError, setStartError] = useState("");
  const [online, setOnline] = useState(false);
  const [openFaq, setOpenFaq] = useState<number | null>(null);

  // Deep link from a "Support replied" notification: /app/help?ticket=<id>
  // (or /agent/help?ticket=<id>) opens that conversation straight away.
  const [params, setParams] = useSearchParams();
  const linkedTicket = params.get("ticket");
  useEffect(() => {
    if (!linkedTicket) return;
    if (tickets.some((t) => t.id === linkedTicket)) {
      setActiveId(linkedTicket);
      setView("chat");
    }
  }, [linkedTicket, tickets]);

  const faqs: { q: string; a: string }[] = siteContent?.help?.faqs ?? [];
  const active = tickets.find((t) => t.id === activeId) ?? null;

  useEffect(() => {
    if (supportConfig) setOnline(supportConfig.isOnline);
  }, [supportConfig]);

  const conversations = useMemo(
    () =>
      [...tickets].sort((a, b) => {
        if (a.status !== b.status) return a.status === "open" ? -1 : 1;
        return new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime();
      }),
    [tickets],
  );

  const open = (ticket: SupportTicket) => {
    setActiveId(ticket.id);
    setView("chat");
  };

  const start = async (vars: { topic: SupportTopic; bookingId?: string }) => {
    setStartError("");
    try {
      const ticket = await createTicket.mutateAsync(vars);
      await refetchTickets();
      open(ticket);
    } catch (e) {
      setStartError(e instanceof ApiError ? e.message : "Couldn't start the chat. Try again.");
    }
  };

  const Noun = jobNoun === "booking" ? "Booking" : "Job";

  if (view === "chat" && active) {
    return (
      <ChatView
        ticket={active}
        role={role}
        meId={me?.id}
        authenticated={authenticated}
        online={online}
        onOnlineChange={setOnline}
        onBack={() => {
          setView("home");
          // Leaving the chat drops the deep link, so it doesn't reopen itself.
          if (linkedTicket) setParams({}, { replace: true });
          void refetchTickets();
        }}
        onClose={() => closeTicket.mutateAsync(active.id).then(() => refetchTickets())}
        onReopen={() => reopenTicket.mutateAsync(active.id).then(() => refetchTickets())}
        closing={closeTicket.isPending}
        reopening={reopenTicket.isPending}
        send={(text, image) => sendMessage.mutateAsync({ ticketId: active.id, text, image })}
        onStatusChange={() => void refetchTickets()}
      />
    );
  }

  return (
    <div className="mx-auto max-w-3xl space-y-4">
      <div className="sticky top-0 z-20 -mx-4 flex items-center gap-3 bg-bg/95 px-4 py-3 backdrop-blur-xl md:top-16 sm:-mx-5 sm:px-5">
        <button
          onClick={() => (view === "pickJob" ? setView("home") : navigate(-1))}
          className="flex size-9 shrink-0 cursor-pointer items-center justify-center rounded-xl border border-line bg-surface text-ink-soft transition-colors hover:text-primary"
          aria-label="Back"
        >
          <ArrowLeft className="size-4" />
        </button>
        <div className="min-w-0">
          <h1 className="font-display text-2xl text-ink sm:text-3xl">
            {view === "pickJob" ? `Which ${jobNoun} is it about?` : "Help & Support"}
          </h1>
          <p className="flex items-center gap-1.5 text-xs text-muted">
            <span className={cn("size-2 rounded-full", online ? "bg-emerald-500" : "bg-gray-400")} />
            {online ? "Support is online — usually replies in a few minutes" : "Support is away — leave a message and we'll reply soon"}
          </p>
        </div>
      </div>

      {startError && <p className="rounded-2xl bg-red-500/10 px-4 py-3 text-sm text-red-600">{startError}</p>}

      {view === "pickJob" ? (
        <div className="space-y-2.5" data-testid="support-job-picker">
          {jobs.length === 0 ? (
            <GlassCard className="py-10 text-center text-sm text-muted">
              You don&apos;t have any {jobNoun}s yet. Pick another topic instead.
            </GlassCard>
          ) : (
            jobs.map((j) => (
              <button
                key={j.id}
                type="button"
                disabled={createTicket.isPending}
                onClick={() => start({ topic: "booking", bookingId: j.id })}
                className="flex w-full cursor-pointer items-center gap-3 rounded-2xl border border-line bg-surface p-4 text-left transition-colors hover:border-primary/40 disabled:opacity-60"
              >
                <span className="grid size-10 shrink-0 place-items-center rounded-xl bg-primary/10 text-primary">
                  <CalendarCheck className="size-5" />
                </span>
                <span className="min-w-0 flex-1">
                  <span className="block truncate text-sm font-semibold text-ink">{j.title}</span>
                  <span className="block truncate text-xs text-muted">{j.subtitle}</span>
                </span>
                <span className="shrink-0 rounded-pill bg-surface-muted px-2.5 py-0.5 text-[11px] font-medium capitalize text-ink-soft">
                  {j.status}
                </span>
                {createTicket.isPending ? <Loader2 className="size-4 animate-spin text-muted" /> : <ChevronRight className="size-4 text-muted" />}
              </button>
            ))
          )}
        </div>
      ) : (
        <>
          {/* What's it about? */}
          <section className="space-y-3">
            <h2 className="font-display text-lg font-semibold text-ink">What do you need help with?</h2>
            <button
              type="button"
              onClick={() => setView("pickJob")}
              className="flex w-full cursor-pointer items-center gap-4 rounded-2xl border border-primary/30 bg-primary/5 p-4 text-left transition-colors hover:bg-primary/10"
              data-testid="support-topic-booking"
            >
              <span className="grid size-11 shrink-0 place-items-center rounded-2xl bg-primary text-white">
                <CalendarCheck className="size-5" />
              </span>
              <span className="min-w-0 flex-1">
                <span className="block font-semibold text-ink">A specific {jobNoun}</span>
                <span className="block text-xs text-muted">
                  {Noun} timing, cleaner, quality, cancellation — pick the {jobNoun} and we&apos;ll have its details
                </span>
              </span>
              <ChevronRight className="size-5 shrink-0 text-primary" />
            </button>
            <div className="grid grid-cols-2 gap-2.5">
              {GENERAL_TOPICS.map((t) => (
                <button
                  key={t.id}
                  type="button"
                  disabled={createTicket.isPending}
                  onClick={() => start({ topic: t.id })}
                  className="flex cursor-pointer flex-col gap-2 rounded-2xl border border-line bg-surface p-4 text-left transition-colors hover:border-primary/40 disabled:opacity-60"
                  data-testid={`support-topic-${t.id}`}
                >
                  <t.icon className="size-5 text-primary" />
                  <span className="text-sm font-semibold leading-tight text-ink">{t.label}</span>
                  <span className="text-[11px] leading-tight text-muted">{t.hint}</span>
                </button>
              ))}
            </div>
          </section>

          {/* Existing conversations */}
          {conversations.length > 0 && (
            <section className="space-y-3">
              <h2 className="font-display text-lg font-semibold text-ink">Your conversations</h2>
              <div className="space-y-2">
                {conversations.slice(0, 8).map((t) => {
                  const replied = t.status === "open" && t.lastSenderType === "staff";
                  return (
                    <button
                      key={t.id}
                      type="button"
                      onClick={() => open(t)}
                      className="flex w-full cursor-pointer items-center gap-3 rounded-2xl border border-line bg-surface p-3.5 text-left transition-colors hover:border-primary/40"
                    >
                      <span
                        className={cn(
                          "grid size-10 shrink-0 place-items-center rounded-xl",
                          t.status === "open" ? "bg-primary/10 text-primary" : "bg-surface-muted text-muted",
                        )}
                      >
                        <MessageSquare className="size-5" />
                      </span>
                      <span className="min-w-0 flex-1">
                        <span className="block truncate text-sm font-semibold text-ink">{t.subject}</span>
                        <span className="block truncate text-xs text-muted">{contextLine(t)}</span>
                      </span>
                      {replied ? (
                        <span className="shrink-0 rounded-pill bg-emerald-500/10 px-2.5 py-0.5 text-[11px] font-semibold text-emerald-700">
                          Support replied
                        </span>
                      ) : (
                        <span
                          className={cn(
                            "shrink-0 rounded-pill px-2.5 py-0.5 text-[11px] font-medium",
                            t.status === "open" ? "bg-amber-500/10 text-amber-700" : "bg-surface-muted text-muted",
                          )}
                        >
                          {t.status === "open" ? "Open" : "Closed"}
                        </span>
                      )}
                    </button>
                  );
                })}
              </div>
            </section>
          )}

          {/* FAQs */}
          {faqs.length > 0 && (
            <section className="space-y-3">
              <h2 className="font-display text-lg font-semibold text-ink">Quick answers</h2>
              <GlassCard className="divide-y divide-line/60 p-0">
                {faqs.map((faq, i) => {
                  const isOpen = openFaq === i;
                  return (
                    <div key={i} className="px-5 py-4">
                      <button
                        type="button"
                        onClick={() => setOpenFaq(isOpen ? null : i)}
                        className="flex w-full cursor-pointer items-center justify-between gap-3 text-left text-sm font-medium text-ink"
                        aria-expanded={isOpen}
                      >
                        <span>{faq.q}</span>
                        <ChevronDown className={cn("size-4 shrink-0 transition-transform", isOpen && "rotate-180")} />
                      </button>
                      {isOpen && <p className="mt-2 whitespace-pre-line text-sm leading-relaxed text-muted">{faq.a}</p>}
                    </div>
                  );
                })}
              </GlassCard>
            </section>
          )}
        </>
      )}
    </div>
  );
}

function ChatView({
  ticket,
  role,
  meId,
  authenticated,
  online,
  onOnlineChange,
  onBack,
  onClose,
  onReopen,
  closing,
  reopening,
  send,
  onStatusChange,
}: {
  ticket: SupportTicket;
  role: "customer" | "agent";
  meId?: string;
  authenticated: boolean;
  online: boolean;
  onOnlineChange: (v: boolean) => void;
  onBack: () => void;
  onClose: () => Promise<unknown>;
  onReopen: () => Promise<unknown>;
  closing: boolean;
  reopening: boolean;
  send: (text: string, image?: string) => Promise<unknown>;
  onStatusChange: () => void;
}) {
  const { data: history } = useTicketMessages(ticket.id);
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [confirmClose, setConfirmClose] = useState(false);
  const threadRef = useRef<HTMLDivElement | null>(null);
  const socketRef = useRef<Socket | null>(null);

  useEffect(() => {
    if (history) setMessages(history);
  }, [history]);

  // Live messages and status for this conversation.
  useEffect(() => {
    if (!authenticated) return;
    const socket = io(SOCKET_URL, { withCredentials: true, transports: ["websocket"], auth: { role } });
    socketRef.current = socket;
    socket.on("connect", () => socket.emit("join_ticket", ticket.id));
    socket.on("support_status", (d: { isOnline: boolean }) => onOnlineChange(d.isOnline));
    socket.on("new_message", (msg: ChatMessage) => {
      if (msg.ticket !== ticket.id) return;
      setMessages((prev) => (prev.some((m) => m.id === msg.id) ? prev : [...prev, msg]));
    });
    socket.on("ticket_status_change", (d: { ticketId: string }) => {
      if (d.ticketId === ticket.id) onStatusChange();
    });
    return () => {
      socket.disconnect();
      socketRef.current = null;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [ticket.id, authenticated, role]);

  useEffect(() => {
    const thread = threadRef.current;
    if (thread) thread.scrollTo({ top: thread.scrollHeight, behavior: "smooth" });
  }, [messages]);

  const closed = ticket.status === "closed";

  return (
    <FullscreenChat>
      {/* Header: what this is about */}
      <header className="flex shrink-0 items-center gap-2 border-b border-line px-3 py-2">
        <button
          type="button"
          onClick={onBack}
          aria-label="Back"
          className="grid size-9 shrink-0 cursor-pointer place-items-center rounded-xl text-ink-soft hover:bg-surface-muted"
        >
          <ArrowLeft className="size-5" />
        </button>
        <div className="min-w-0 flex-1">
          <p className="truncate font-display font-semibold leading-tight text-ink">{ticket.subject}</p>
          <p className="flex items-center gap-1.5 truncate text-xs text-muted">
            <span className={cn("size-2 shrink-0 rounded-full", online ? "bg-emerald-500" : "bg-gray-400")} />
            {ticket.booking ? (
              <>
                {contextLine(ticket)}
                <span className="capitalize"> · {ticket.booking.status}</span>
              </>
            ) : online ? (
              "Support is online"
            ) : (
              "Support will reply soon"
            )}
          </p>
        </div>
        {!closed && !confirmClose && (
          <Button variant="ghost" size="sm" onClick={() => setConfirmClose(true)}>
            End chat
          </Button>
        )}
      </header>

      {confirmClose && !closed && (
        <div className="flex flex-wrap items-center justify-between gap-2 border-b border-line bg-surface-muted/50 px-4 py-2.5 text-sm">
          <span className="text-ink-soft">End this conversation?</span>
          <div className="flex gap-2">
            <Button size="sm" variant="ghost" onClick={() => setConfirmClose(false)}>
              Keep chatting
            </Button>
            <Button
              size="sm"
              variant="outline"
              disabled={closing}
              onClick={() => onClose().then(() => setConfirmClose(false))}
            >
              {closing && <Loader2 className="size-4 animate-spin" />} End chat
            </Button>
          </div>
        </div>
      )}

      {/* Messages */}
      <div ref={threadRef} className="min-h-0 flex-1 space-y-3 overflow-y-auto overscroll-contain bg-surface-muted/20 p-3" data-lenis-prevent="true">
        <div className="mx-auto max-w-sm rounded-2xl bg-primary/5 px-4 py-3 text-center text-xs text-ink-soft">
          {ticket.booking
            ? `This chat is about your ${ticket.booking.packageName} on ${formatDay(ticket.booking.date)}. Support can see its details.`
            : `Tell us what's going on and we'll help. ${online ? "We're online now." : "We'll reply as soon as we're back."}`}
        </div>
        {messages.map((m) => {
          const own = m.sender === meId;
          return (
            <div key={m.id} className={cn("flex", own ? "justify-end" : "justify-start")}>
              <div
                className={cn(
                  "max-w-[85%] break-words [overflow-wrap:anywhere] rounded-2xl px-4 py-2.5 text-sm shadow-sm",
                  own ? "rounded-br-md bg-primary text-white" : "rounded-bl-md border border-line bg-surface text-ink",
                )}
              >
                {!own && <p className="mb-0.5 text-[11px] font-semibold text-primary">NexClean Support</p>}
                <ChatImage src={m.imageUrl} />
                {m.text && <p className="whitespace-pre-line leading-relaxed">{m.text}</p>}
                <span className={cn("mt-1 block text-right text-[10px]", own ? "text-white/70" : "text-muted")}>
                  {formatTime(m.createdAt)}
                </span>
              </div>
            </div>
          );
        })}
      </div>

      {closed ? (
        <footer className="shrink-0 border-t border-line p-3 pb-[max(0.75rem,env(safe-area-inset-bottom))]">
          <div className="flex flex-wrap items-center justify-between gap-2 text-sm text-muted">
            <span className="flex items-center gap-1.5"><Lock className="size-4" /> This conversation is closed.</span>
            <Button size="sm" variant="outline" disabled={reopening} onClick={() => onReopen()}>
              {reopening ? <Loader2 className="size-4 animate-spin" /> : <RotateCcw className="size-4" />} Reopen
            </Button>
          </div>
        </footer>
      ) : <ChatComposer key={ticket.id} onSend={send} />}
    </FullscreenChat>
  );
}
