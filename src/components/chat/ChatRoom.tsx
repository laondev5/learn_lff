"use client"

import { Fragment, useCallback, useEffect, useLayoutEffect, useRef, useState } from "react"
import Link from "next/link"
import { toast } from "sonner"
import type { PresenceChannel } from "pusher-js"
import {
  AlertCircle, ArrowLeft, Ban, CheckCheck, ChevronDown, Clock, Copy, Info, Loader2,
  Reply, Search, SendHorizontal, ShieldCheck, Smile, Trash2, X,
} from "lucide-react"
import {
  DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import { getMessages, markForumRead } from "@/actions/chat.actions"
import { CHAT_BASE, GroupAvatar, useChat } from "@/components/chat/ChatShell"
import { GroupInfoPanel, MessageSearchPanel } from "@/components/chat/GroupPanels"
import {
  EMOJIS, colorFor, formatDayChip, formatTime, initials, linkify, sameDay,
  type ChatMessage,
} from "@/components/chat/chat-utils"
import { cn } from "@/lib/utils"

const PAGE_SIZE = 50
const GROUP_GAP_MS = 5 * 60 * 1000

// Subtle WhatsApp-style doodle wallpaper (tiled SVG)
const WALLPAPER = `url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='120' height='120' viewBox='0 0 120 120'%3E%3Cg fill='none' stroke='%23000' stroke-opacity='.06' stroke-width='1.5'%3E%3Ccircle cx='18' cy='20' r='7'/%3E%3Cpath d='M60 12v16M52 20h16'/%3E%3Crect x='88' y='12' width='18' height='14' rx='2'/%3E%3Cpath d='M97 12v14'/%3E%3Cpath d='M14 70c6-8 14-8 20 0'/%3E%3Ccircle cx='62' cy='64' r='3'/%3E%3Cpath d='M92 60l8 8m0-8l-8 8'/%3E%3Cpath d='M20 100l6 8 10-14'/%3E%3Crect x='54' y='94' width='14' height='18' rx='3'/%3E%3Cpath d='M92 104c0-6 12-6 12 0s-12 6-12 0'/%3E%3C/g%3E%3C/svg%3E")`

interface Props {
  forum: { id: string; name: string; type: string; description: string | null; memberCount: number }
  initialMessages: ChatMessage[]
  currentUserRole: string
}

export function ChatRoom({ forum, initialMessages, currentUserRole }: Props) {
  const { me, pusher, typing, groups, clearUnread } = useChat()
  const [messages, setMessages] = useState<ChatMessage[]>(initialMessages)
  const [hasMore, setHasMore] = useState(initialMessages.length >= PAGE_SIZE)
  const [loadingOlder, setLoadingOlder] = useState(false)
  const [input, setInput] = useState("")
  const [replyTo, setReplyTo] = useState<ChatMessage | null>(null)
  const [emojiOpen, setEmojiOpen] = useState(false)
  const [panel, setPanel] = useState<"info" | "search" | null>(null)
  const [atBottom, setAtBottom] = useState(true)
  const [newWhileAway, setNewWhileAway] = useState(0)
  const [onlineCount, setOnlineCount] = useState<number | null>(null)
  const [highlightId, setHighlightId] = useState<string | null>(null)

  // Unread divider: placed before the first message the user hasn't seen, computed once on open
  const [unreadMarker] = useState(() => {
    const unread = groups.find((g) => g.id === forum.id)?.unreadCount ?? 0
    if (unread === 0) return null
    let remaining = unread
    for (let i = initialMessages.length - 1; i >= 0; i--) {
      if (initialMessages[i].sender.id === me.id) continue
      remaining--
      if (remaining === 0) return { id: initialMessages[i].id, count: unread }
    }
    return initialMessages[0] ? { id: initialMessages[0].id, count: unread } : null
  })

  const scrollRef = useRef<HTMLDivElement>(null)
  const inputRef = useRef<HTMLTextAreaElement>(null)
  const atBottomRef = useRef(true)
  const prependHeight = useRef<number | null>(null)
  const lastTypingSent = useRef(0)
  const readTimer = useRef<ReturnType<typeof setTimeout> | null>(null)

  const typingHere = (typing[forum.id] ?? []).filter((t) => t.userId !== me.id)
  const canModerate = currentUserRole === "admin"

  // ── Mark as read on open ────────────────────────────────────────────────────
  useEffect(() => {
    const frame = requestAnimationFrame(() => clearUnread(forum.id))
    markForumRead(forum.id)
    return () => cancelAnimationFrame(frame)
  }, [forum.id, clearUnread])

  const scheduleMarkRead = useCallback(() => {
    if (readTimer.current) clearTimeout(readTimer.current)
    readTimer.current = setTimeout(() => markForumRead(forum.id), 1500)
  }, [forum.id])

  // ── Initial scroll: jump to the unread divider, otherwise to the bottom ────
  useLayoutEffect(() => {
    const el = scrollRef.current
    if (!el) return
    const marker = unreadMarker && document.getElementById("unread-divider")
    if (marker) marker.scrollIntoView({ block: "start" })
    else el.scrollTop = el.scrollHeight
  }, [unreadMarker])

  // Keep position stable when older messages are prepended
  useLayoutEffect(() => {
    const el = scrollRef.current
    if (el && prependHeight.current !== null) {
      el.scrollTop += el.scrollHeight - prependHeight.current
      prependHeight.current = null
    }
  }, [messages])

  const scrollToBottom = useCallback((smooth = true) => {
    const el = scrollRef.current
    if (!el) return
    el.scrollTo({ top: el.scrollHeight, behavior: smooth ? "smooth" : "auto" })
    setNewWhileAway(0)
  }, [])

  // ── Realtime: new messages, deletions ───────────────────────────────────────
  useEffect(() => {
    if (!pusher) return
    const channel = pusher.subscribe(`forum-${forum.id}`)

    const onMessage = (msg: ChatMessage) => {
      setMessages((prev) => {
        if (prev.some((m) => m.id === msg.id)) return prev
        // Replace our own optimistic copy if the realtime event beats the HTTP response
        if (msg.sender.id === me.id) {
          const idx = prev.findIndex((m) => m.pending && m.content === msg.content)
          if (idx !== -1) {
            const next = [...prev]
            next[idx] = msg
            return next
          }
        }
        return [...prev, msg]
      })
      if (msg.sender.id !== me.id) {
        scheduleMarkRead()
        if (atBottomRef.current) requestAnimationFrame(() => scrollToBottom())
        else setNewWhileAway((n) => n + 1)
      }
    }
    const onDeleted = ({ id }: { id: string }) => {
      setMessages((prev) => prev.map((m) => (m.id === id ? { ...m, deleted: true, content: "", replyTo: null } : m)))
    }

    channel.bind("new-message", onMessage)
    channel.bind("message-deleted", onDeleted)
    return () => {
      // The chat list keeps this channel subscribed; only remove our handlers
      channel.unbind("new-message", onMessage)
      channel.unbind("message-deleted", onDeleted)
    }
  }, [pusher, forum.id, me.id, scheduleMarkRead, scrollToBottom])

  // ── Realtime: who's online ──────────────────────────────────────────────────
  useEffect(() => {
    if (!pusher) return
    const name = `presence-forum-${forum.id}`
    const presence = pusher.subscribe(name) as PresenceChannel
    const update = () => setOnlineCount(presence.members.count)
    presence.bind("pusher:subscription_succeeded", update)
    presence.bind("pusher:member_added", update)
    presence.bind("pusher:member_removed", update)
    return () => {
      presence.unbind_all()
      pusher.unsubscribe(name)
    }
  }, [pusher, forum.id])

  useEffect(() => () => { if (readTimer.current) clearTimeout(readTimer.current) }, [])

  // ── Scrolling & history ─────────────────────────────────────────────────────
  async function loadOlder() {
    if (loadingOlder || !hasMore || messages.length === 0) return
    setLoadingOlder(true)
    const older = await getMessages(forum.id, { limit: PAGE_SIZE, before: messages.find((m) => !m.pending)?.createdAt })
    prependHeight.current = scrollRef.current?.scrollHeight ?? null
    setMessages((prev) => {
      const known = new Set(prev.map((m) => m.id))
      return [...older.filter((m) => !known.has(m.id)), ...prev]
    })
    setHasMore(older.length >= PAGE_SIZE)
    setLoadingOlder(false)
  }

  function handleScroll() {
    const el = scrollRef.current
    if (!el) return
    const bottom = el.scrollHeight - el.scrollTop - el.clientHeight < 80
    atBottomRef.current = bottom
    setAtBottom(bottom)
    if (bottom && newWhileAway) setNewWhileAway(0)
    if (el.scrollTop < 150) loadOlder()
  }

  function jumpToMessage(id: string) {
    const el = document.getElementById(`msg-${id}`)
    if (!el) {
      toast.info("That message is further up. Scroll up to load older messages.")
      return
    }
    el.scrollIntoView({ behavior: "smooth", block: "center" })
    setHighlightId(id)
    setTimeout(() => setHighlightId((h) => (h === id ? null : h)), 1600)
  }

  // ── Sending ─────────────────────────────────────────────────────────────────
  function notifyTyping() {
    const now = Date.now()
    if (now - lastTypingSent.current < 3000) return
    lastTypingSent.current = now
    fetch("/api/chat/typing", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ forumId: forum.id }),
    }).catch(() => {})
  }

  async function deliver(temp: ChatMessage) {
    try {
      const res = await fetch("/api/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ forumId: forum.id, content: temp.content, replyToId: temp.replyTo?.id ?? null }),
      })
      const data = await res.json()
      if (!res.ok || data.error) throw new Error(data.error ?? "Failed to send")
      setMessages((prev) => {
        const withoutTemp = prev.filter((m) => m.id !== temp.id)
        if (withoutTemp.some((m) => m.id === data.message.id)) return withoutTemp
        return prev.map((m) => (m.id === temp.id ? data.message : m))
      })
    } catch (err) {
      setMessages((prev) => prev.map((m) => (m.id === temp.id ? { ...m, pending: false, failed: true } : m)))
      toast.error(err instanceof Error ? err.message : "Message not sent")
    }
  }

  function handleSend() {
    const content = input.trim()
    if (!content) return
    if (content.length > 2000) {
      toast.error("Messages can be at most 2000 characters")
      return
    }
    const temp: ChatMessage = {
      id: `temp-${Date.now()}`,
      content,
      createdAt: new Date().toISOString(),
      deleted: false,
      replyTo: replyTo ? { id: replyTo.id, senderName: replyTo.sender.name, content: replyTo.content.slice(0, 300) } : null,
      sender: { id: me.id, name: me.name, role: currentUserRole, avatarUrl: null },
      pending: true,
    }
    setMessages((prev) => [...prev, temp])
    setInput("")
    setReplyTo(null)
    setEmojiOpen(false)
    requestAnimationFrame(() => {
      scrollToBottom()
      if (inputRef.current) inputRef.current.style.height = "auto"
    })
    deliver(temp)
  }

  function retry(msg: ChatMessage) {
    setMessages((prev) => prev.map((m) => (m.id === msg.id ? { ...m, pending: true, failed: false } : m)))
    deliver({ ...msg, pending: true, failed: false })
  }

  async function handleDelete(msg: ChatMessage) {
    if (!confirm("Delete this message for everyone?")) return
    setMessages((prev) => prev.map((m) => (m.id === msg.id ? { ...m, deleted: true, content: "", replyTo: null } : m)))
    const res = await fetch("/api/chat", {
      method: "DELETE",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ messageId: msg.id }),
    })
    if (!res.ok) {
      toast.error("Couldn't delete the message")
      setMessages((prev) => prev.map((m) => (m.id === msg.id ? msg : m)))
    }
  }

  function startReply(msg: ChatMessage) {
    setReplyTo(msg)
    inputRef.current?.focus()
  }

  function insertEmoji(emoji: string) {
    const el = inputRef.current
    if (!el) return setInput((v) => v + emoji)
    const start = el.selectionStart ?? input.length
    const end = el.selectionEnd ?? input.length
    const next = input.slice(0, start) + emoji + input.slice(end)
    setInput(next)
    requestAnimationFrame(() => {
      el.focus()
      el.setSelectionRange(start + emoji.length, start + emoji.length)
    })
  }

  function autoGrow(el: HTMLTextAreaElement) {
    el.style.height = "auto"
    el.style.height = `${Math.min(el.scrollHeight, 140)}px`
  }

  // ── Render ──────────────────────────────────────────────────────────────────
  const subtitle = typingHere.length
    ? typingHere.length === 1
      ? `${typingHere[0].name.split(" ")[0]} is typing…`
      : `${typingHere.map((t) => t.name.split(" ")[0]).slice(0, 2).join(", ")} are typing…`
    : [
        `${forum.memberCount} member${forum.memberCount !== 1 ? "s" : ""}`,
        onlineCount ? `${onlineCount} online` : null,
      ].filter(Boolean).join(" · ")

  return (
    <div className="relative flex h-full min-h-0 w-full">
      <div className="flex min-w-0 flex-1 flex-col">
        {/* Header */}
        <header className="flex h-16 shrink-0 items-center gap-3 border-l border-black/5 bg-[#f0f2f5] px-3 dark:border-white/5 dark:bg-[#202c33]">
          <Link href={CHAT_BASE} className="rounded-full p-1.5 text-[#54656f] hover:bg-black/5 md:hidden dark:text-[#aebac1]" aria-label="Back to chats">
            <ArrowLeft className="h-5 w-5" />
          </Link>
          <button type="button" onClick={() => setPanel(panel === "info" ? null : "info")} className="flex min-w-0 flex-1 items-center gap-3 text-left">
            <GroupAvatar group={forum} size={40} />
            <div className="min-w-0">
              <p className="truncate font-medium text-[#111b21] dark:text-[#e9edef]">{forum.name}</p>
              <p className={cn("truncate text-xs", typingHere.length ? "font-medium text-[#00a884]" : "text-[#667781] dark:text-[#8696a0]")}>
                {subtitle || "tap here for group info"}
              </p>
            </div>
          </button>
          <button
            type="button"
            onClick={() => setPanel(panel === "search" ? null : "search")}
            className={cn("rounded-full p-2 text-[#54656f] hover:bg-black/5 dark:text-[#aebac1]", panel === "search" && "bg-black/5")}
            aria-label="Search messages"
          >
            <Search className="h-5 w-5" />
          </button>
          <button
            type="button"
            onClick={() => setPanel(panel === "info" ? null : "info")}
            className={cn("rounded-full p-2 text-[#54656f] hover:bg-black/5 dark:text-[#aebac1]", panel === "info" && "bg-black/5")}
            aria-label="Group info"
          >
            <Info className="h-5 w-5" />
          </button>
        </header>

        {/* Messages */}
        <div className="relative min-h-0 flex-1 bg-[#efeae2] dark:bg-[#0b141a]">
          <div className="pointer-events-none absolute inset-0 dark:invert" style={{ backgroundImage: WALLPAPER }} />
          <div ref={scrollRef} onScroll={handleScroll} className="relative h-full overflow-y-auto px-3 py-3 sm:px-[6%]">
            {loadingOlder && (
              <div className="flex justify-center py-2">
                <Loader2 className="h-5 w-5 animate-spin text-[#667781]" />
              </div>
            )}
            {!hasMore && (
              <div className="mx-auto mb-3 max-w-md rounded-lg bg-[#ffeecd] px-3 py-2 text-center text-xs text-[#54656f] shadow-sm dark:bg-[#182229] dark:text-[#ffd279]">
                <ShieldCheck className="mr-1 inline h-3.5 w-3.5 -translate-y-px" />
                Messages in this group are visible to all {forum.memberCount} members. Please be kind and respectful.
              </div>
            )}
            {messages.length === 0 && (
              <div className="mx-auto mt-10 max-w-xs rounded-lg bg-white/90 px-4 py-3 text-center text-sm text-[#54656f] shadow-sm dark:bg-[#202c33] dark:text-[#8696a0]">
                No messages yet. Say hello to the group!
              </div>
            )}

            {messages.map((msg, i) => {
              const prev = messages[i - 1]
              const newDay = !prev || !sameDay(prev.createdAt, msg.createdAt)
              const showDivider = unreadMarker?.id === msg.id
              const firstInGroup =
                newDay ||
                showDivider ||
                prev.sender.id !== msg.sender.id ||
                Date.parse(msg.createdAt) - Date.parse(prev.createdAt) > GROUP_GAP_MS
              return (
                <Fragment key={msg.id}>
                  {newDay && (
                    <div className="sticky top-1 z-10 my-2 flex justify-center">
                      <span className="rounded-lg bg-white px-3 py-1 text-xs uppercase text-[#54656f] shadow-sm dark:bg-[#182229] dark:text-[#8696a0]">
                        {formatDayChip(msg.createdAt)}
                      </span>
                    </div>
                  )}
                  {showDivider && (
                    <div id="unread-divider" className="-mx-3 my-3 bg-white/40 py-1 text-center sm:-mx-[6.5%] dark:bg-black/20">
                      <span className="rounded-full bg-white px-3 py-1 text-xs font-medium text-[#54656f] shadow-sm dark:bg-[#182229] dark:text-[#8696a0]">
                        {unreadMarker.count} unread message{unreadMarker.count !== 1 ? "s" : ""}
                      </span>
                    </div>
                  )}
                  <MessageBubble
                    msg={msg}
                    isOwn={msg.sender.id === me.id}
                    firstInGroup={firstInGroup}
                    highlighted={highlightId === msg.id}
                    canDelete={msg.sender.id === me.id || canModerate}
                    onReply={() => startReply(msg)}
                    onDelete={() => handleDelete(msg)}
                    onRetry={() => retry(msg)}
                    onQuoteClick={jumpToMessage}
                  />
                </Fragment>
              )
            })}

            {typingHere.length > 0 && (
              <div className="mt-2 flex">
                <div className="flex items-center gap-1 rounded-lg rounded-tl-none bg-white px-3 py-2.5 shadow-sm dark:bg-[#202c33]">
                  {[0, 150, 300].map((d) => (
                    <span key={d} className="h-2 w-2 animate-bounce rounded-full bg-[#8696a0]" style={{ animationDelay: `${d}ms` }} />
                  ))}
                </div>
              </div>
            )}
          </div>

          {/* Jump to latest */}
          {!atBottom && (
            <button
              type="button"
              onClick={() => scrollToBottom()}
              className="absolute bottom-4 right-4 flex h-10 w-10 items-center justify-center rounded-full bg-white text-[#54656f] shadow-md transition hover:bg-[#f5f6f6] dark:bg-[#202c33] dark:text-[#aebac1]"
              aria-label="Scroll to latest message"
            >
              <ChevronDown className="h-5 w-5" />
              {newWhileAway > 0 && (
                <span className="absolute -top-2 -right-1 flex h-5 min-w-5 items-center justify-center rounded-full bg-[#25d366] px-1 text-[11px] font-semibold text-white">
                  {newWhileAway}
                </span>
              )}
            </button>
          )}
        </div>

        {/* Composer */}
        <footer className="relative shrink-0 bg-[#f0f2f5] px-3 py-2 dark:bg-[#202c33]">
          {replyTo && (
            <div className="mb-2 flex items-stretch gap-2 rounded-lg bg-white p-2 dark:bg-[#1d282f] animate-in slide-in-from-bottom-2 fade-in-0 duration-150">
              <div className="w-1 shrink-0 rounded-full" style={{ background: colorFor(replyTo.sender.id) }} />
              <div className="min-w-0 flex-1">
                <p className="text-xs font-semibold" style={{ color: colorFor(replyTo.sender.id) }}>
                  {replyTo.sender.id === me.id ? "You" : replyTo.sender.name}
                </p>
                <p className="line-clamp-2 text-sm text-[#667781] dark:text-[#8696a0]">{replyTo.content}</p>
              </div>
              <button type="button" onClick={() => setReplyTo(null)} className="self-start rounded-full p-1 text-[#54656f] hover:bg-black/5" aria-label="Cancel reply">
                <X className="h-4 w-4" />
              </button>
            </div>
          )}

          {emojiOpen && (
            <div className="absolute bottom-full left-2 right-2 mb-1 rounded-xl border bg-white p-2 shadow-lg sm:right-auto sm:w-80 dark:border-white/10 dark:bg-[#233138] animate-in fade-in-0 zoom-in-95 duration-150">
              <div className="grid grid-cols-9 gap-0.5">
                {EMOJIS.map((e) => (
                  <button key={e} type="button" onClick={() => insertEmoji(e)} className="rounded-md p-1 text-xl hover:bg-black/5 dark:hover:bg-white/10">
                    {e}
                  </button>
                ))}
              </div>
            </div>
          )}

          <form
            onSubmit={(e) => { e.preventDefault(); handleSend() }}
            className="flex items-end gap-2"
          >
            <button
              type="button"
              onClick={() => setEmojiOpen((o) => !o)}
              className={cn("mb-1 rounded-full p-2 text-[#54656f] hover:bg-black/5 dark:text-[#8696a0]", emojiOpen && "text-[#00a884]")}
              aria-label="Emoji"
            >
              <Smile className="h-6 w-6" />
            </button>
            <div className="flex min-h-[42px] flex-1 items-center rounded-lg bg-white px-3 dark:bg-[#2a3942]">
              <textarea
                ref={inputRef}
                value={input}
                rows={1}
                placeholder="Type a message"
                maxLength={2000}
                onChange={(e) => { setInput(e.target.value); autoGrow(e.target); notifyTyping() }}
                onKeyDown={(e) => {
                  if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); handleSend() }
                  if (e.key === "Escape") { setReplyTo(null); setEmojiOpen(false) }
                }}
                onFocus={() => setEmojiOpen(false)}
                className="max-h-[140px] w-full resize-none bg-transparent py-2.5 text-[15px] leading-5 text-[#111b21] outline-none placeholder:text-[#667781] dark:text-[#e9edef] dark:placeholder:text-[#8696a0]"
              />
            </div>
            <button
              type="submit"
              disabled={!input.trim()}
              className="mb-0.5 flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-[#00a884] text-white transition hover:bg-[#008f6f] disabled:opacity-40 disabled:hover:bg-[#00a884]"
              aria-label="Send"
            >
              <SendHorizontal className="h-5 w-5" />
            </button>
          </form>
          {input.length > 1800 && (
            <p className="mt-1 text-right text-[11px] text-[#667781]">{input.length}/2000</p>
          )}
        </footer>
      </div>

      {/* Side panel: group info / search (full screen on mobile) */}
      {panel && (
        <div className="absolute inset-0 z-30 flex bg-white md:static md:w-[360px] md:shrink-0 md:border-l md:border-black/10 dark:bg-[#111b21] dark:md:border-white/10 animate-in slide-in-from-right-8 fade-in-0 duration-200">
          {panel === "info" ? (
            <GroupInfoPanel forum={forum} meId={me.id} onlineCount={onlineCount} onClose={() => setPanel(null)} />
          ) : (
            <MessageSearchPanel
              messages={messages}
              meId={me.id}
              onClose={() => setPanel(null)}
              onPick={(id) => { jumpToMessage(id); if (window.innerWidth < 768) setPanel(null) }}
            />
          )}
        </div>
      )}
    </div>
  )
}

// ─── Message bubble ───────────────────────────────────────────────────────────

function MessageBubble({
  msg, isOwn, firstInGroup, highlighted, canDelete, onReply, onDelete, onRetry, onQuoteClick,
}: {
  msg: ChatMessage
  isOwn: boolean
  firstInGroup: boolean
  highlighted: boolean
  canDelete: boolean
  onReply: () => void
  onDelete: () => void
  onRetry: () => void
  onQuoteClick: (id: string) => void
}) {
  const nameColor = colorFor(msg.sender.id)
  const staff = msg.sender.role === "teacher" || msg.sender.role === "admin"

  const status = isOwn && !msg.deleted && (
    msg.failed ? <AlertCircle className="h-3.5 w-3.5 text-red-500" />
      : msg.pending ? <Clock className="h-3 w-3" />
        : <CheckCheck className="h-4 w-4" aria-label="Sent" />
  )

  return (
    <div
      id={`msg-${msg.id}`}
      className={cn(
        "group flex items-start gap-1.5 rounded-lg transition-colors duration-700",
        isOwn ? "justify-end" : "justify-start",
        firstInGroup ? "mt-2" : "mt-0.5",
        highlighted && "bg-[#00a884]/20"
      )}
    >
      {/* Avatar column for other people (WhatsApp group style) */}
      {!isOwn && (
        <div className="w-8 shrink-0">
          {firstInGroup && (
            msg.sender.avatarUrl ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={msg.sender.avatarUrl} alt={msg.sender.name} className="h-8 w-8 rounded-full object-cover" />
            ) : (
              <div className="flex h-8 w-8 items-center justify-center rounded-full text-xs font-semibold text-white" style={{ background: nameColor }}>
                {initials(msg.sender.name)}
              </div>
            )
          )}
        </div>
      )}

      <div
        onDoubleClick={() => !msg.deleted && onReply()}
        className={cn(
          "relative max-w-[85%] rounded-lg px-2 pb-1.5 pt-1.5 text-[14.2px] leading-[19px] shadow-[0_1px_0.5px_rgba(11,20,26,0.13)] sm:max-w-[65%]",
          isOwn ? "bg-[#d9fdd3] text-[#111b21] dark:bg-[#005c4b] dark:text-[#e9edef]" : "bg-white text-[#111b21] dark:bg-[#202c33] dark:text-[#e9edef]",
          firstInGroup && (isOwn ? "rounded-tr-none" : "rounded-tl-none"),
          msg.failed && "ring-1 ring-red-400"
        )}
      >
        {/* Bubble tail on the first message of a run */}
        {firstInGroup && (
          <svg
            viewBox="0 0 8 13"
            className={cn(
              "absolute top-0 h-[13px] w-2",
              isOwn ? "-right-2 fill-[#d9fdd3] dark:fill-[#005c4b]" : "-left-2 -scale-x-100 fill-white dark:fill-[#202c33]"
            )}
            aria-hidden
          >
            <path d="M0 0h8L1.5 9.5C.9 10.3 0 9.8 0 8.8V0z" />
          </svg>
        )}

        {/* Hover menu */}
        {!msg.deleted && !msg.pending && !msg.failed && (
          <DropdownMenu>
            <DropdownMenuTrigger
              render={
                <button
                  type="button"
                  className={cn(
                    "absolute top-0.5 right-0.5 z-10 rounded-full p-0.5 text-[#8696a0] transition-opacity sm:opacity-0 sm:group-hover:opacity-100 focus:opacity-100",
                    isOwn ? "bg-[#d9fdd3] dark:bg-[#005c4b]" : "bg-white dark:bg-[#202c33]"
                  )}
                  aria-label="Message options"
                />
              }
            >
              <ChevronDown className="h-4 w-4" />
            </DropdownMenuTrigger>
            <DropdownMenuContent align={isOwn ? "end" : "start"}>
              <DropdownMenuItem onClick={onReply}>
                <Reply className="mr-2 h-4 w-4" />Reply
              </DropdownMenuItem>
              <DropdownMenuItem onClick={() => { navigator.clipboard.writeText(msg.content); toast.success("Copied") }}>
                <Copy className="mr-2 h-4 w-4" />Copy
              </DropdownMenuItem>
              {canDelete && (
                <DropdownMenuItem onClick={onDelete} className="text-destructive focus:text-destructive">
                  <Trash2 className="mr-2 h-4 w-4" />Delete for everyone
                </DropdownMenuItem>
              )}
            </DropdownMenuContent>
          </DropdownMenu>
        )}

        {!isOwn && firstInGroup && (
          <p className="mb-0.5 flex items-center gap-1.5 pr-5 text-[13px] font-medium" style={{ color: nameColor }}>
            <span className="truncate">{msg.sender.name}</span>
            {staff && (
              <span className="shrink-0 rounded bg-[#00a884]/15 px-1 text-[10px] font-semibold uppercase tracking-wide text-[#008069] dark:text-[#00a884]">
                {msg.sender.role}
              </span>
            )}
          </p>
        )}

        {msg.replyTo && !msg.deleted && (
          <button
            type="button"
            onClick={() => onQuoteClick(msg.replyTo!.id)}
            className="mb-1 flex w-full min-w-0 overflow-hidden rounded-md bg-black/5 text-left dark:bg-black/20"
          >
            <span className="w-1 shrink-0" style={{ background: colorFor(msg.replyTo.senderName) }} />
            <span className="min-w-0 px-2 py-1">
              <span className="block truncate text-xs font-semibold" style={{ color: colorFor(msg.replyTo.senderName) }}>
                {msg.replyTo.senderName}
              </span>
              <span className="line-clamp-2 text-xs text-[#667781] dark:text-[#8696a0]">{msg.replyTo.content}</span>
            </span>
          </button>
        )}

        {msg.deleted ? (
          <p className="flex items-center gap-1.5 pr-14 italic text-[#667781] dark:text-[#8696a0]">
            <Ban className="h-4 w-4" />
            {isOwn ? "You deleted this message" : "This message was deleted"}
          </p>
        ) : (
          <p className="whitespace-pre-wrap break-words pr-1">
            {linkify(msg.content).map((part, idx) =>
              part.href ? (
                <a key={idx} href={part.href} target="_blank" rel="noopener noreferrer" className="text-[#027eb5] underline-offset-2 hover:underline dark:text-[#53bdeb]">
                  {part.text}
                </a>
              ) : (
                <Fragment key={idx}>{part.text}</Fragment>
              )
            )}
            {/* Spacer so the timestamp never overlaps the last line */}
            <span className={cn("inline-block", isOwn ? "w-[68px]" : "w-12")} aria-hidden />
          </p>
        )}

        <span className="absolute bottom-1 right-2 flex items-center gap-1 text-[11px] leading-none text-[#667781] dark:text-[#ffffff99]">
          {formatTime(msg.createdAt)}
          {status}
        </span>

        {msg.failed && (
          <button type="button" onClick={onRetry} className="mt-1 block text-xs font-medium text-red-600">
            Not sent. Tap to retry
          </button>
        )}
      </div>
    </div>
  )
}
