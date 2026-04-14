"use client"

import { useState, useEffect, useRef } from "react"
import Link from "next/link"
import Pusher from "pusher-js"
import { toast } from "sonner"
import { ChevronRight, Send, Loader2 } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { UserAvatar } from "@/components/shared/UserAvatar"
import { cn } from "@/lib/utils"

interface Message {
  id: string
  content: string
  createdAt: string
  sender: {
    id: string
    name: string
    role: string
  }
}

interface Forum {
  id: string
  name: string
  type: string
  description: string | null
}

export function ChatRoomClient({
  forum,
  initialMessages,
  currentUserId,
  currentUserName,
}: {
  forum: Forum
  initialMessages: Message[]
  currentUserId: string
  currentUserName: string
}) {
  const [messages, setMessages] = useState<Message[]>(initialMessages)
  const [input, setInput] = useState("")
  const [sending, setSending] = useState(false)
  const bottomRef = useRef<HTMLDivElement>(null)
  const pusherRef = useRef<Pusher | null>(null)

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" })
  }, [messages])

  useEffect(() => {
    const pusher = new Pusher(process.env.NEXT_PUBLIC_PUSHER_KEY!, {
      cluster: process.env.NEXT_PUBLIC_PUSHER_CLUSTER!,
      authEndpoint: "/api/pusher/auth",
    })
    pusherRef.current = pusher

    const channel = pusher.subscribe(`forum-${forum.id}`)
    channel.bind("new-message", (msg: Message) => {
      setMessages((prev) => {
        // Avoid duplicate if we already added it optimistically
        if (prev.some((m) => m.id === msg.id)) return prev
        return [...prev, msg]
      })
    })

    return () => {
      channel.unbind_all()
      pusher.unsubscribe(`forum-${forum.id}`)
      pusher.disconnect()
    }
  }, [forum.id])

  async function handleSend(e: React.FormEvent) {
    e.preventDefault()
    if (!input.trim() || sending) return

    setSending(true)
    const content = input.trim()
    setInput("")

    try {
      const res = await fetch("/api/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ forumId: forum.id, content }),
      })
      const data = await res.json()
      if (data.error) {
        toast.error(data.error)
        setInput(content) // restore
      }
    } catch {
      toast.error("Failed to send message")
      setInput(content)
    }
    setSending(false)
  }

  function formatTime(iso: string) {
    return new Date(iso).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })
  }

  function formatDate(iso: string) {
    return new Date(iso).toLocaleDateString([], { month: "short", day: "numeric" })
  }

  return (
    <div className="flex flex-col h-full -m-4 md:-m-6 lg:-m-8">
      {/* Header */}
      <div className="flex items-center gap-3 px-4 md:px-6 py-3 border-b bg-background shrink-0">
        <div className="flex items-center gap-2 text-sm text-muted-foreground">
          <Link href="/student/chat" className="hover:underline">Chat</Link>
          <ChevronRight className="h-3 w-3" />
        </div>
        <div>
          <p className="font-semibold text-sm">{forum.name}</p>
          {forum.description && (
            <p className="text-xs text-muted-foreground">{forum.description}</p>
          )}
        </div>
      </div>

      {/* Messages */}
      <div className="flex-1 overflow-y-auto px-4 md:px-6 py-4 space-y-4">
        {messages.length === 0 && (
          <div className="text-center text-muted-foreground text-sm py-12">
            No messages yet. Start the conversation!
          </div>
        )}
        {messages.map((msg, idx) => {
          const isOwn = msg.sender.id === currentUserId
          const prevMsg = messages[idx - 1]
          const showDate =
            idx === 0 || formatDate(msg.createdAt) !== formatDate(prevMsg.createdAt)

          return (
            <div key={msg.id}>
              {showDate && (
                <div className="text-center text-xs text-muted-foreground my-4">
                  {formatDate(msg.createdAt)}
                </div>
              )}
              <div className={cn("flex items-end gap-2", isOwn ? "flex-row-reverse" : "flex-row")}>
                {!isOwn && (
                  <UserAvatar name={msg.sender.name} size="sm" className="shrink-0" />
                )}
                <div className={cn("max-w-[75%] space-y-1", isOwn ? "items-end" : "items-start", "flex flex-col")}>
                  {!isOwn && (
                    <span className="text-xs text-muted-foreground px-1">
                      {msg.sender.name}
                      {msg.sender.role !== "student" && (
                        <span className="ml-1 capitalize text-primary">· {msg.sender.role}</span>
                      )}
                    </span>
                  )}
                  <div
                    className={cn(
                      "rounded-2xl px-4 py-2 text-sm break-words",
                      isOwn
                        ? "bg-primary text-primary-foreground rounded-br-sm"
                        : "bg-muted rounded-bl-sm"
                    )}
                  >
                    {msg.content}
                  </div>
                  <span className="text-xs text-muted-foreground px-1">{formatTime(msg.createdAt)}</span>
                </div>
              </div>
            </div>
          )
        })}
        <div ref={bottomRef} />
      </div>

      {/* Input */}
      <div className="border-t px-4 md:px-6 py-3 bg-background shrink-0">
        <form onSubmit={handleSend} className="flex gap-2">
          <Input
            value={input}
            onChange={(e) => setInput(e.target.value)}
            placeholder="Type a message..."
            disabled={sending}
            className="flex-1"
            maxLength={2000}
          />
          <Button type="submit" size="icon" disabled={!input.trim() || sending}>
            {sending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />}
          </Button>
        </form>
      </div>
    </div>
  )
}
