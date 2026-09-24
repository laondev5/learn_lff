export interface ChatSender {
  id: string
  name: string
  role: string
  avatarUrl: string | null
}

export interface ChatMessage {
  id: string
  content: string
  createdAt: string
  deleted: boolean
  replyTo: { id: string; senderName: string; content: string } | null
  sender: ChatSender
  /** Client-only: optimistic message waiting for the server. */
  pending?: boolean
  failed?: boolean
}

export interface ChatGroup {
  id: string
  name: string
  type: string
  cohort: string | null
  description: string | null
  memberCount: number
  unreadCount: number
  lastMessage: {
    content: string
    createdAt: string
    senderId: string
    senderName: string
    deleted: boolean
  } | null
}

// WhatsApp-like palette for sender names and group avatars
const NAME_COLORS = [
  "#e542a3", "#1f7aec", "#d97706", "#059669", "#7c3aed", "#dc2626",
  "#0891b2", "#c2410c", "#4f46e5", "#16a34a", "#db2777", "#0d9488",
]

export function colorFor(id: string) {
  let hash = 0
  for (let i = 0; i < id.length; i++) hash = (hash * 31 + id.charCodeAt(i)) | 0
  return NAME_COLORS[Math.abs(hash) % NAME_COLORS.length]
}

export function initials(name: string) {
  return name.split(/\s+/).filter(Boolean).slice(0, 2).map((p) => p[0]?.toUpperCase()).join("") || "?"
}

function startOfDay(d: Date) {
  return new Date(d.getFullYear(), d.getMonth(), d.getDate()).getTime()
}

export function formatTime(iso: string) {
  return new Date(iso).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })
}

/** Chat-list style: time today, "Yesterday", weekday this week, else a short date. */
export function formatListTime(iso: string) {
  const d = new Date(iso)
  const days = Math.round((startOfDay(new Date()) - startOfDay(d)) / 86_400_000)
  if (days === 0) return formatTime(iso)
  if (days === 1) return "Yesterday"
  if (days < 7) return d.toLocaleDateString([], { weekday: "long" })
  return d.toLocaleDateString([], { day: "2-digit", month: "2-digit", year: "numeric" })
}

/** Date chip between messages: TODAY / YESTERDAY / weekday / full date. */
export function formatDayChip(iso: string) {
  const d = new Date(iso)
  const days = Math.round((startOfDay(new Date()) - startOfDay(d)) / 86_400_000)
  if (days === 0) return "Today"
  if (days === 1) return "Yesterday"
  if (days < 7) return d.toLocaleDateString([], { weekday: "long" })
  return d.toLocaleDateString([], { day: "numeric", month: "long", year: "numeric" })
}

export function sameDay(a: string, b: string) {
  return startOfDay(new Date(a)) === startOfDay(new Date(b))
}

/** Splits text into plain and link parts so URLs render as clickable links. */
export function linkify(text: string): { text: string; href?: string }[] {
  const parts: { text: string; href?: string }[] = []
  const re = /(https?:\/\/[^\s<]+[^\s<.,;:!?)"'\]])/g
  let last = 0
  for (const match of text.matchAll(re)) {
    const i = match.index ?? 0
    if (i > last) parts.push({ text: text.slice(last, i) })
    parts.push({ text: match[0], href: match[0] })
    last = i + match[0].length
  }
  if (last < text.length) parts.push({ text: text.slice(last) })
  return parts
}

export const EMOJIS = [
  "😀", "😂", "🥰", "😊", "😍", "🙏", "👍", "👏", "🙌", "🔥", "❤️", "💯",
  "🎉", "✨", "😇", "🤔", "😢", "😮", "😅", "🤝", "💪", "📖", "✝️", "🕊️",
  "⛪", "🌟", "☀️", "🌿", "✅", "❗", "❓", "👋", "😎", "🤗", "🥳", "😴",
]
