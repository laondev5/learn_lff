"use client"

import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from "react"
import Link from "next/link"
import { useSelectedLayoutSegment } from "next/navigation"
import Pusher from "pusher-js"
import { Ban, Check, CheckCheck, Megaphone, Search, Users, X } from "lucide-react"
import { cn } from "@/lib/utils"
import {
  colorFor, formatListTime, initials,
  type ChatGroup, type ChatMessage,
} from "@/components/chat/chat-utils"

interface TypingUser { userId: string; name: string }

interface ChatContextValue {
  me: { id: string; name: string }
  groups: ChatGroup[]
  activeId: string | null
  pusher: Pusher | null
  typing: Record<string, TypingUser[]>
  clearUnread: (forumId: string) => void
}

const ChatContext = createContext<ChatContextValue | null>(null)

export function useChat() {
  const ctx = useContext(ChatContext)
  if (!ctx) throw new Error("useChat must be used inside <ChatShell>")
  return ctx
}

/** Base path of the chat area, e.g. /student/chat */
export const CHAT_BASE = "/student/chat"

export function GroupAvatar({ group, size = 48 }: { group: Pick<ChatGroup, "id" | "name" | "type">; size?: number }) {
  const Icon = group.type === "general" ? Megaphone : Users
  return (
    <div
      className="flex shrink-0 items-center justify-center rounded-full text-white"
      style={{ width: size, height: size, background: colorFor(group.id) }}
      aria-hidden
    >
      {group.type === "cohort" ? (
        <span className="font-semibold" style={{ fontSize: size / 2.8 }}>{initials(group.name)}</span>
      ) : (
        <Icon style={{ width: size / 2.2, height: size / 2.2 }} />
      )}
    </div>
  )
}

export function ChatShell({
  initialGroups,
  me,
  children,
}: {
  initialGroups: ChatGroup[]
  me: { id: string; name: string }
  children: React.ReactNode
}) {
  const activeId = useSelectedLayoutSegment()
  const [groups, setGroups] = useState<ChatGroup[]>(initialGroups)
  const [typing, setTyping] = useState<Record<string, TypingUser[]>>({})
  const [pusher, setPusher] = useState<Pusher | null>(null)
  const [query, setQuery] = useState("")
  const [filter, setFilter] = useState<"all" | "unread">("all")
  const activeRef = useRef(activeId)
  const typingTimers = useRef(new Map<string, ReturnType<typeof setTimeout>>())

  useEffect(() => { activeRef.current = activeId }, [activeId])

  // One shared realtime connection for the whole chat area
  useEffect(() => {
    const client = new Pusher(process.env.NEXT_PUBLIC_PUSHER_KEY!, {
      cluster: process.env.NEXT_PUBLIC_PUSHER_CLUSTER!,
      authEndpoint: "/api/pusher/auth",
    })
    const frame = requestAnimationFrame(() => setPusher(client))
    return () => {
      cancelAnimationFrame(frame)
      client.disconnect()
    }
  }, [])

  const stopTyping = useCallback((forumId: string, userId: string) => {
    setTyping((prev) => ({ ...prev, [forumId]: (prev[forumId] ?? []).filter((t) => t.userId !== userId) }))
  }, [])

  // Keep the chat list (previews, unread badges, typing) live for every group
  const groupIds = groups.map((g) => g.id).join(",")
  useEffect(() => {
    if (!pusher) return
    const ids = groupIds.split(",").filter(Boolean)
    const timers = typingTimers.current
    const channels = ids.map((forumId) => {
      const channel = pusher.subscribe(`forum-${forumId}`)

      const onMessage = (msg: ChatMessage) => {
        stopTyping(forumId, msg.sender.id)
        setGroups((prev) =>
          prev
            .map((g) =>
              g.id !== forumId
                ? g
                : {
                    ...g,
                    lastMessage: {
                      content: msg.content,
                      createdAt: msg.createdAt,
                      senderId: msg.sender.id,
                      senderName: msg.sender.name,
                      deleted: false,
                    },
                    unreadCount:
                      msg.sender.id !== me.id && activeRef.current !== forumId ? g.unreadCount + 1 : g.unreadCount,
                  }
            )
            .sort((a, b) => Date.parse(b.lastMessage?.createdAt ?? "0") - Date.parse(a.lastMessage?.createdAt ?? "0"))
        )
      }
      const onTyping = (t: TypingUser) => {
        if (t.userId === me.id) return
        setTyping((prev) => {
          const list = (prev[forumId] ?? []).filter((x) => x.userId !== t.userId)
          return { ...prev, [forumId]: [...list, t] }
        })
        const key = `${forumId}:${t.userId}`
        clearTimeout(timers.get(key))
        timers.set(key, setTimeout(() => stopTyping(forumId, t.userId), 4000))
      }

      channel.bind("new-message", onMessage)
      channel.bind("typing", onTyping)
      return { channel, onMessage, onTyping }
    })

    return () => {
      channels.forEach(({ channel, onMessage, onTyping }) => {
        channel.unbind("new-message", onMessage)
        channel.unbind("typing", onTyping)
      })
      timers.forEach(clearTimeout)
      timers.clear()
    }
  }, [pusher, groupIds, me.id, stopTyping])

  const clearUnread = useCallback((forumId: string) => {
    setGroups((prev) => prev.map((g) => (g.id === forumId && g.unreadCount > 0 ? { ...g, unreadCount: 0 } : g)))
  }, [])

  const value = useMemo<ChatContextValue>(
    () => ({ me, groups, activeId, pusher, typing, clearUnread }),
    [me, groups, activeId, pusher, typing, clearUnread]
  )

  const visibleGroups = groups.filter((g) => {
    if (filter === "unread" && g.unreadCount === 0) return false
    return g.name.toLowerCase().includes(query.trim().toLowerCase())
  })
  const totalUnread = groups.reduce((n, g) => n + (g.unreadCount > 0 ? 1 : 0), 0)

  return (
    <ChatContext.Provider value={value}>
      {/* Cancel <main>'s padding so the chat fills the whole content area, like WhatsApp Web */}
      <div className="-m-4 flex h-[calc(100%+2rem)] overflow-hidden bg-white md:-m-6 md:h-[calc(100%+3rem)] lg:-m-8 lg:h-[calc(100%+4rem)] dark:bg-[#111b21]">
        {/* ── Chat list ── */}
        <aside
          className={cn(
            "flex w-full flex-col border-r border-black/10 bg-white md:w-[340px] lg:w-[380px] md:shrink-0 dark:border-white/10 dark:bg-[#111b21]",
            activeId ? "hidden md:flex" : "flex"
          )}
        >
          <div className="flex h-16 shrink-0 items-center justify-between bg-[#f0f2f5] px-4 dark:bg-[#202c33]">
            <h1 className="text-xl font-bold text-[#111b21] dark:text-[#e9edef]">Community</h1>
            <span className="text-xs text-[#667781] dark:text-[#8696a0]">{groups.length} group{groups.length !== 1 ? "s" : ""}</span>
          </div>

          <div className="space-y-2 px-3 py-2">
            <label className="flex items-center gap-3 rounded-lg bg-[#f0f2f5] px-3 py-1.5 dark:bg-[#202c33]">
              <Search className="h-4 w-4 shrink-0 text-[#54656f] dark:text-[#8696a0]" />
              <input
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                placeholder="Search groups"
                className="w-full bg-transparent py-1 text-sm text-[#111b21] outline-none placeholder:text-[#667781] dark:text-[#e9edef] dark:placeholder:text-[#8696a0]"
              />
              {query && (
                <button type="button" onClick={() => setQuery("")} aria-label="Clear search">
                  <X className="h-4 w-4 text-[#54656f]" />
                </button>
              )}
            </label>
            <div className="flex gap-2">
              {(["all", "unread"] as const).map((f) => (
                <button
                  key={f}
                  type="button"
                  onClick={() => setFilter(f)}
                  className={cn(
                    "rounded-full px-3 py-1 text-sm transition-colors",
                    filter === f
                      ? "bg-[#d9fdd3] font-medium text-[#008069] dark:bg-[#0a332c] dark:text-[#00a884]"
                      : "bg-[#f0f2f5] text-[#54656f] hover:bg-[#e9edef] dark:bg-[#202c33] dark:text-[#8696a0]"
                  )}
                >
                  {f === "all" ? "All" : `Unread${totalUnread ? ` ${totalUnread}` : ""}`}
                </button>
              ))}
            </div>
          </div>

          <nav className="flex-1 overflow-y-auto">
            {visibleGroups.length === 0 && (
              <p className="px-6 py-10 text-center text-sm text-[#667781] dark:text-[#8696a0]">
                {filter === "unread" ? "You're all caught up." : "No groups found."}
              </p>
            )}
            {visibleGroups.map((g) => (
              <ChatListItem key={g.id} group={g} active={g.id === activeId} typing={typing[g.id] ?? []} meId={me.id} />
            ))}
          </nav>
        </aside>

        {/* ── Conversation pane ── */}
        <section className={cn("min-w-0 flex-1 flex-col", activeId ? "flex" : "hidden md:flex")}>
          {children}
        </section>
      </div>
    </ChatContext.Provider>
  )
}

function ChatListItem({
  group, active, typing, meId,
}: {
  group: ChatGroup
  active: boolean
  typing: TypingUser[]
  meId: string
}) {
  const last = group.lastMessage
  const unread = group.unreadCount > 0
  const fromMe = last?.senderId === meId

  let preview: React.ReactNode = (
    <span className="italic">{group.description ?? "Tap to start chatting"}</span>
  )
  if (typing.length > 0) {
    preview = (
      <span className="font-medium text-[#00a884]">
        {typing.length === 1 ? `${typing[0].name.split(" ")[0]} is typing…` : `${typing.length} people are typing…`}
      </span>
    )
  } else if (last) {
    preview = (
      <span className="flex min-w-0 items-center gap-1">
        {fromMe && !last.deleted && <CheckCheck className="h-4 w-4 shrink-0" />}
        {last.deleted && <Ban className="h-3.5 w-3.5 shrink-0" />}
        <span className={cn("truncate", last.deleted && "italic")}>
          {!last.deleted && (fromMe ? "You: " : `${last.senderName.split(" ")[0]}: `)}
          {last.content}
        </span>
      </span>
    )
  }

  return (
    <Link
      href={`${CHAT_BASE}/${group.id}`}
      className={cn(
        "flex items-center gap-3 px-3 transition-colors",
        active ? "bg-[#f0f2f5] dark:bg-[#2a3942]" : "hover:bg-[#f5f6f6] dark:hover:bg-[#202c33]"
      )}
    >
      <GroupAvatar group={group} size={49} />
      <div className="min-w-0 flex-1 border-b border-black/[0.06] py-3 dark:border-white/[0.06]">
        <div className="flex items-baseline justify-between gap-2">
          <p className="truncate text-[17px] text-[#111b21] dark:text-[#e9edef]">{group.name}</p>
          {last && (
            <span className={cn("shrink-0 text-xs", unread ? "font-medium text-[#25d366]" : "text-[#667781] dark:text-[#8696a0]")}>
              {formatListTime(last.createdAt)}
            </span>
          )}
        </div>
        <div className="mt-0.5 flex items-center justify-between gap-2 text-sm text-[#667781] dark:text-[#8696a0]">
          <div className="min-w-0 flex-1 truncate">{preview}</div>
          {unread ? (
            <span className="flex h-5 min-w-5 shrink-0 items-center justify-center rounded-full bg-[#25d366] px-1.5 text-xs font-semibold text-white">
              {group.unreadCount > 99 ? "99+" : group.unreadCount}
            </span>
          ) : (
            !last && <Check className="h-4 w-4 shrink-0 opacity-0" />
          )}
        </div>
      </div>
    </Link>
  )
}
