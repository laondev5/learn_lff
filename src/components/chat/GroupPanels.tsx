"use client"

import { useEffect, useState } from "react"
import { Loader2, Search, X } from "lucide-react"
import { getForumMembers } from "@/actions/chat.actions"
import { GroupAvatar } from "@/components/chat/ChatShell"
import { colorFor, formatListTime, initials, type ChatMessage } from "@/components/chat/chat-utils"

interface Member { id: string; name: string; role: string; avatarUrl: string | null }

function PanelHeader({ title, onClose }: { title: string; onClose: () => void }) {
  return (
    <div className="flex h-16 shrink-0 items-center gap-6 bg-[#f0f2f5] px-5 dark:bg-[#202c33]">
      <button type="button" onClick={onClose} className="text-[#54656f] dark:text-[#aebac1]" aria-label="Close">
        <X className="h-5 w-5" />
      </button>
      <p className="text-base font-medium text-[#111b21] dark:text-[#e9edef]">{title}</p>
    </div>
  )
}

function MemberAvatar({ member, size = 40 }: { member: Member; size?: number }) {
  if (member.avatarUrl) {
    // eslint-disable-next-line @next/next/no-img-element
    return <img src={member.avatarUrl} alt={member.name} className="shrink-0 rounded-full object-cover" style={{ width: size, height: size }} />
  }
  return (
    <div className="flex shrink-0 items-center justify-center rounded-full text-sm font-semibold text-white" style={{ width: size, height: size, background: colorFor(member.id) }}>
      {initials(member.name)}
    </div>
  )
}

export function GroupInfoPanel({
  forum, meId, onlineCount, onClose,
}: {
  forum: { id: string; name: string; type: string; description: string | null; memberCount: number }
  meId: string
  onlineCount: number | null
  onClose: () => void
}) {
  const [data, setData] = useState<{ total: number; members: Member[] } | null>(null)
  const [query, setQuery] = useState("")

  useEffect(() => {
    let cancelled = false
    getForumMembers(forum.id).then((res) => { if (!cancelled) setData(res ?? { total: 0, members: [] }) })
    return () => { cancelled = true }
  }, [forum.id])

  const members = (data?.members ?? []).filter((m) => m.name.toLowerCase().includes(query.trim().toLowerCase()))

  return (
    <div className="flex min-w-0 flex-1 flex-col">
      <PanelHeader title="Group info" onClose={onClose} />
      <div className="flex-1 overflow-y-auto bg-[#f0f2f5] dark:bg-[#0b141a]">
        <div className="flex flex-col items-center gap-2 bg-white px-6 py-7 text-center dark:bg-[#111b21]">
          <GroupAvatar group={forum} size={120} />
          <p className="mt-2 text-2xl text-[#111b21] dark:text-[#e9edef]">{forum.name}</p>
          <p className="text-sm text-[#667781] dark:text-[#8696a0]">
            Group · {data?.total ?? forum.memberCount} members{onlineCount ? ` · ${onlineCount} online` : ""}
          </p>
        </div>

        <div className="mt-2 bg-white px-6 py-4 dark:bg-[#111b21]">
          <p className="text-sm text-[#667781] dark:text-[#8696a0]">About this group</p>
          <p className="mt-1 text-[15px] text-[#111b21] dark:text-[#e9edef]">
            {forum.description ??
              (forum.type === "cohort"
                ? `Group for students in the ${forum.name} cohort, with their teachers.`
                : "Community group for everyone in Living Faith Foundation.")}
          </p>
        </div>

        <div className="mt-2 bg-white pb-4 dark:bg-[#111b21]">
          <div className="flex items-center justify-between px-6 pt-4 pb-2">
            <p className="text-sm text-[#667781] dark:text-[#8696a0]">{data?.total ?? forum.memberCount} members</p>
          </div>
          <label className="mx-4 mb-2 flex items-center gap-3 rounded-lg bg-[#f0f2f5] px-3 py-1.5 dark:bg-[#202c33]">
            <Search className="h-4 w-4 text-[#54656f]" />
            <input
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Search members"
              className="w-full bg-transparent py-1 text-sm outline-none dark:text-[#e9edef]"
            />
          </label>
          {!data ? (
            <div className="flex justify-center py-6"><Loader2 className="h-5 w-5 animate-spin text-[#667781]" /></div>
          ) : (
            <ul>
              {members.map((m) => (
                <li key={m.id} className="flex items-center gap-3 px-6 py-2.5 hover:bg-[#f5f6f6] dark:hover:bg-[#202c33]">
                  <MemberAvatar member={m} />
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-[15px] text-[#111b21] dark:text-[#e9edef]">{m.id === meId ? "You" : m.name}</p>
                    <p className="text-xs capitalize text-[#667781] dark:text-[#8696a0]">{m.role}</p>
                  </div>
                  {(m.role === "teacher" || m.role === "admin") && (
                    <span className="shrink-0 rounded bg-[#d9fdd3] px-1.5 py-0.5 text-[11px] font-medium text-[#008069] dark:bg-[#0a332c] dark:text-[#00a884]">
                      Group admin
                    </span>
                  )}
                </li>
              ))}
              {data.total > data.members.length && !query && (
                <li className="px-6 py-2 text-xs text-[#667781]">and {data.total - data.members.length} more…</li>
              )}
            </ul>
          )}
        </div>
      </div>
    </div>
  )
}

export function MessageSearchPanel({
  messages, meId, onClose, onPick,
}: {
  messages: ChatMessage[]
  meId: string
  onClose: () => void
  onPick: (id: string) => void
}) {
  const [query, setQuery] = useState("")
  const q = query.trim().toLowerCase()
  const results = q
    ? messages.filter((m) => !m.deleted && !m.pending && m.content.toLowerCase().includes(q)).reverse()
    : []

  function highlight(text: string) {
    const i = text.toLowerCase().indexOf(q)
    if (i === -1) return text
    const start = Math.max(0, i - 30)
    return (
      <>
        {start > 0 && "…"}
        {text.slice(start, i)}
        <mark className="rounded-sm bg-transparent font-semibold text-[#00a884]">{text.slice(i, i + q.length)}</mark>
        {text.slice(i + q.length, i + q.length + 80)}
      </>
    )
  }

  return (
    <div className="flex min-w-0 flex-1 flex-col">
      <PanelHeader title="Search messages" onClose={onClose} />
      <div className="px-3 py-2">
        <label className="flex items-center gap-3 rounded-lg bg-[#f0f2f5] px-3 py-1.5 dark:bg-[#202c33]">
          <Search className="h-4 w-4 text-[#54656f]" />
          <input
            autoFocus
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search…"
            className="w-full bg-transparent py-1 text-sm outline-none dark:text-[#e9edef]"
          />
        </label>
      </div>
      <div className="flex-1 overflow-y-auto">
        {!q ? (
          <p className="px-6 py-10 text-center text-sm text-[#667781] dark:text-[#8696a0]">
            Search messages in this group. Scroll up in the chat to include older messages.
          </p>
        ) : results.length === 0 ? (
          <p className="px-6 py-10 text-center text-sm text-[#667781] dark:text-[#8696a0]">No messages found</p>
        ) : (
          <ul>
            {results.map((m) => (
              <li key={m.id}>
                <button type="button" onClick={() => onPick(m.id)} className="w-full border-b border-black/[0.06] px-5 py-3 text-left hover:bg-[#f5f6f6] dark:border-white/[0.06] dark:hover:bg-[#202c33]">
                  <div className="flex items-baseline justify-between gap-2">
                    <span className="truncate text-sm font-medium" style={{ color: colorFor(m.sender.id) }}>
                      {m.sender.id === meId ? "You" : m.sender.name}
                    </span>
                    <span className="shrink-0 text-xs text-[#667781]">{formatListTime(m.createdAt)}</span>
                  </div>
                  <p className="mt-0.5 line-clamp-2 text-sm text-[#667781] dark:text-[#8696a0]">{highlight(m.content)}</p>
                </button>
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  )
}
