import { ChatComposer } from "@shared/components/chat/ChatComposer";
import { ChatImage } from "@shared/components/chat/ChatImage";
import { useEffect, useMemo, useRef, useState } from "react";
import { ArrowLeft, Mail, MessageSquare, Search, Users } from "lucide-react";
import { cn } from "@shared/lib/utils";
import {
  useAdminMe,
  useInternalConversations,
  useInternalMessageContacts,
  useInternalMessages,
  useSendInternalMessage,
  useStartInternalConversation,
} from "../api/admin.api";
import type { InternalMessageContact } from "../types";

function initials(name: string): string {
  return name
    .split(" ")
    .map((part) => part[0])
    .slice(0, 2)
    .join("")
    .toUpperCase();
}

function timeLabel(value?: string): string {
  if (!value) return "";
  return new Date(value).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
}

export function InternalMessages() {
  const { data: me } = useAdminMe();
  const { data: contacts = [] } = useInternalMessageContacts();
  const { data: conversations = [] } = useInternalConversations();
  const startConversation = useStartInternalConversation();
  const sendMessage = useSendInternalMessage();
  const [query, setQuery] = useState("");
  const [selectedConversationId, setSelectedConversationId] = useState<string | null>(null);
  const [selectedContact, setSelectedContact] = useState<InternalMessageContact | null>(null);
  const endRef = useRef<HTMLDivElement | null>(null);
  const { data: messages = [], isLoading: messagesLoading } = useInternalMessages(selectedConversationId);

  const conversationByContact = useMemo(
    () => new Map(conversations.map((conversation) => [conversation.contact.id, conversation])),
    [conversations],
  );

  const visibleContacts = useMemo(() => {
    const normalized = query.trim().toLowerCase();
    return [...contacts]
      .filter((contact) =>
        !normalized ||
        contact.name.toLowerCase().includes(normalized) ||
        contact.roleName.toLowerCase().includes(normalized) ||
        contact.email.toLowerCase().includes(normalized),
      )
      .sort((a, b) => {
        const first = conversationByContact.get(a.id);
        const second = conversationByContact.get(b.id);
        if ((first?.unreadCount ?? 0) !== (second?.unreadCount ?? 0)) {
          return (second?.unreadCount ?? 0) - (first?.unreadCount ?? 0);
        }
        return new Date(second?.lastMessageAt ?? 0).getTime() - new Date(first?.lastMessageAt ?? 0).getTime();
      });
  }, [contacts, conversationByContact, query]);

  useEffect(() => {
    endRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  const openContact = async (contact: InternalMessageContact) => {
    setSelectedContact(contact);
    const existing = conversationByContact.get(contact.id);
    if (existing) {
      setSelectedConversationId(existing.id);
      return;
    }
    const conversation = await startConversation.mutateAsync(contact.id);
    setSelectedConversationId(conversation.id);
  };

  return (
    <div className="flex h-[calc(100dvh-8rem)] min-h-[560px] flex-col gap-4">
      <div className="shrink-0">
        <h1 className="font-display text-2xl text-ink sm:text-3xl">Internal Messages</h1>
        <p className="mt-1 text-sm text-muted">Private realtime conversations with your NexClean team.</p>
      </div>

      <div className="grid min-h-0 flex-1 overflow-hidden rounded-[1.75rem] border border-line bg-surface/70 shadow-[var(--shadow-soft)] backdrop-blur-xl md:grid-cols-[20rem_minmax(0,1fr)]">
        <aside className={cn("min-h-0 border-r border-line/70", selectedContact ? "hidden md:flex" : "flex", "flex-col")}>
          <div className="border-b border-line/70 p-4">
            <div className="flex items-center justify-between gap-3">
              <div>
                <p className="font-display font-semibold text-ink">Team directory</p>
                <p className="text-xs text-muted">{contacts.length} available staff members</p>
              </div>
              <span className="grid size-9 place-items-center rounded-xl bg-primary/10 text-primary">
                <Users className="size-4" />
              </span>
            </div>
            <label className="mt-3 flex h-10 items-center gap-2 rounded-xl border border-line bg-surface px-3 focus-within:border-primary/40">
              <Search className="size-4 shrink-0 text-muted" />
              <input
                value={query}
                onChange={(event) => setQuery(event.target.value)}
                placeholder="Search name or role"
                className="min-w-0 flex-1 bg-transparent text-sm text-ink outline-none placeholder:text-muted"
              />
            </label>
          </div>

          <div className="min-h-0 flex-1 overflow-y-auto p-2" data-lenis-prevent="true">
            {visibleContacts.map((contact) => {
              const conversation = conversationByContact.get(contact.id);
              return (
                <button
                  type="button"
                  key={contact.id}
                  onClick={() => void openContact(contact)}
                  className="flex w-full items-start gap-3 rounded-2xl p-3 text-left transition-colors hover:bg-surface-muted/70">
                  <span className="relative grid size-11 shrink-0 place-items-center rounded-2xl bg-gradient-to-br from-primary to-accent text-sm font-semibold text-white">
                    {initials(contact.name)}
                    <span className={cn("absolute -bottom-0.5 -right-0.5 size-3 rounded-full border-2 border-surface", contact.online ? "bg-emerald-500" : "bg-slate-300")} />
                  </span>
                  <span className="min-w-0 flex-1">
                    <span className="flex items-center justify-between gap-2">
                      <span className="truncate text-sm font-semibold text-ink">{contact.name}</span>
                      {conversation && conversation.unreadCount > 0 && (
                        <span className="grid min-w-5 shrink-0 place-items-center rounded-full bg-primary px-1.5 text-[10px] font-bold leading-5 text-white">
                          {conversation.unreadCount > 99 ? "99+" : conversation.unreadCount}
                        </span>
                      )}
                    </span>
                    <span className="mt-0.5 block truncate text-xs font-medium text-primary">{contact.roleName}</span>
                    <span className="mt-1 block truncate text-xs text-muted">
                      {conversation?.lastMessagePreview || contact.email || "Start a conversation"}
                    </span>
                  </span>
                </button>
              );
            })}
            {visibleContacts.length === 0 && (
              <div className="grid place-items-center px-5 py-14 text-center text-sm text-muted">
                No staff members match your search.
              </div>
            )}
          </div>
        </aside>

        <section className={cn("min-h-0", selectedContact ? "flex" : "hidden md:flex", "flex-col")}>
          {selectedContact ? (
            <>
              <header className="flex shrink-0 items-center gap-3 border-b border-line/70 px-4 py-3 sm:px-5">
                <button
                  type="button"
                  onClick={() => {
                    setSelectedContact(null);
                    setSelectedConversationId(null);
                  }}
                  className="grid size-9 shrink-0 place-items-center rounded-xl border border-line text-muted md:hidden"
                  aria-label="Back to team directory">
                  <ArrowLeft className="size-4" />
                </button>
                <span className="grid size-10 shrink-0 place-items-center rounded-2xl bg-primary/10 text-sm font-bold text-primary">
                  {initials(selectedContact.name)}
                </span>
                <div className="min-w-0 flex-1">
                  <div className="flex flex-wrap items-center gap-2">
                    <h2 className="truncate font-display font-semibold text-ink">{selectedContact.name}</h2>
                    <span className="rounded-full border border-primary/20 bg-primary/10 px-2 py-0.5 text-[10px] font-semibold text-primary">
                      {selectedContact.roleName}
                    </span>
                  </div>
                  <p className="flex items-center gap-1 truncate text-xs text-muted">
                    <Mail className="size-3" /> {selectedContact.email || "No email available"}
                  </p>
                </div>
                <span className={cn("text-xs font-medium", selectedContact.online ? "text-emerald-600" : "text-muted")}>
                  {selectedContact.online ? "Online" : "Offline"}
                </span>
              </header>

              <div className="min-h-0 flex-1 overflow-y-auto bg-surface-muted/20 px-4 py-5 sm:px-6" data-lenis-prevent="true">
                {messagesLoading || startConversation.isPending ? (
                  <div className="grid h-full place-items-center text-sm text-muted">Loading conversation…</div>
                ) : messages.length === 0 ? (
                  <div className="grid h-full place-items-center text-center">
                    <div>
                      <span className="mx-auto grid size-12 place-items-center rounded-2xl bg-primary/10 text-primary">
                        <MessageSquare className="size-5" />
                      </span>
                      <p className="mt-3 font-medium text-ink">Start the conversation</p>
                      <p className="mt-1 text-sm text-muted">Messages are private between you and {selectedContact.name}.</p>
                    </div>
                  </div>
                ) : (
                  <div className="space-y-3">
                    {messages.map((message) => {
                      const mine = message.sender.id === me?.id;
                      return (
                        <div key={message.id} className={cn("flex", mine ? "justify-end" : "justify-start")}>
                          <div className={cn("max-w-[82%] rounded-2xl px-4 py-2.5", mine ? "rounded-br-md bg-primary text-white" : "rounded-bl-md border border-line bg-surface text-ink")}>
                            {!mine && <p className="mb-1 text-[10px] font-semibold text-primary">{message.sender.name} · {message.sender.roleName}</p>}
                            <ChatImage src={message.imageUrl} />
                            <p className="whitespace-pre-wrap break-words [overflow-wrap:anywhere] text-sm leading-5" data-testid="internal-message-text">
                              {message.text}
                            </p>
                            <p className={cn("mt-1 text-right text-[10px]", mine ? "text-white/70" : "text-muted")}>{timeLabel(message.createdAt)}</p>
                          </div>
                        </div>
                      );
                    })}
                    <div ref={endRef} />
                  </div>
                )}
              </div>

              <ChatComposer key={selectedConversationId || selectedContact.id} placeholder={`Message ${selectedContact.name}`} sendLabel="Send message"
                disabled={!selectedConversationId || startConversation.isPending}
                onSend={(text, image) => sendMessage.mutateAsync({ conversationId: selectedConversationId!, text, image })} />
            </>
          ) : (
            <div className="grid h-full place-items-center p-8 text-center">
              <div>
                <span className="mx-auto grid size-14 place-items-center rounded-2xl bg-primary/10 text-primary">
                  <MessageSquare className="size-6" />
                </span>
                <h2 className="mt-4 font-display text-xl text-ink">Choose a teammate</h2>
                <p className="mt-1 max-w-sm text-sm text-muted">Select any staff member to view your private conversation or send a new message.</p>
              </div>
            </div>
          )}
        </section>
      </div>
    </div>
  );
}
