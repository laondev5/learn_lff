"use server"

import { connectDB } from "@/lib/mongoose"
import { auth } from "@/auth"
import ChatForum from "@/models/ChatForum.model"
import Message from "@/models/Message.model"
import ChatReadState from "@/models/ChatReadState.model"
import User from "@/models/User.model"
import { Types } from "mongoose"
import type { Session } from "next-auth"

// ─── Types ────────────────────────────────────────────────────────────────────

export interface ChatMessageDTO {
  id: string
  content: string
  createdAt: string
  deleted: boolean
  replyTo: { id: string; senderName: string; content: string } | null
  sender: { id: string; name: string; role: string; avatarUrl: string | null }
}

type SessionUser = NonNullable<Session["user"]>

// ─── Access control ───────────────────────────────────────────────────────────

/** Students may only see the General group and their own cohort; staff see every group. */
function forumFilterFor(user: SessionUser) {
  if (user.role === "admin" || user.role === "teacher") return {}
  const conditions: object[] = [{ type: "general" }]
  if (user.cohort) conditions.push({ type: "cohort", cohort: user.cohort })
  return { $or: conditions }
}

async function canAccessForum(user: SessionUser, forumId: string) {
  if (!Types.ObjectId.isValid(forumId)) return false
  return !!(await ChatForum.exists({ _id: forumId, ...forumFilterFor(user) }))
}

type LeanMessage = {
  _id: Types.ObjectId
  content: string
  createdAt: Date
  deletedAt?: Date
  replyTo?: { message: Types.ObjectId; senderName: string; content: string }
  sender: unknown
}

function toMessageDTO(m: LeanMessage): ChatMessageDTO {
  const sender = m.sender as { _id: Types.ObjectId; name: string; role: string; avatarUrl?: string } | null
  const deleted = !!m.deletedAt
  return {
    id: m._id.toString(),
    content: deleted ? "" : m.content,
    createdAt: m.createdAt.toISOString(),
    deleted,
    replyTo: !deleted && m.replyTo
      ? { id: m.replyTo.message.toString(), senderName: m.replyTo.senderName, content: m.replyTo.content }
      : null,
    sender: sender
      ? { id: sender._id.toString(), name: sender.name, role: sender.role, avatarUrl: sender.avatarUrl ?? null }
      : { id: "unknown", name: "Unknown User", role: "student", avatarUrl: null },
  }
}

// ─── Groups ───────────────────────────────────────────────────────────────────

export async function getForumsForUser() {
  const session = await auth()
  if (!session?.user) return []

  await connectDB()

  // Ensure "General" always exists
  await ChatForum.findOneAndUpdate(
    { type: "general" },
    { $setOnInsert: { name: "General", description: "General discussion for all members" } },
    { upsert: true }
  )

  // Ensure the user's specific cohort exists
  if (session.user.cohort) {
    await ChatForum.findOneAndUpdate(
      { type: "cohort", cohort: session.user.cohort },
      { $setOnInsert: { name: session.user.cohort } },
      { upsert: true }
    )
  }

  const forums = await ChatForum.find(forumFilterFor(session.user)).sort({ type: 1, name: 1 }).lean()
  const forumIds = forums.map((f) => f._id)
  const userId = new Types.ObjectId(session.user.id)

  const [lastMessages, readStates, activeUsers, staffCount] = await Promise.all([
    Message.aggregate<{ _id: Types.ObjectId; content: string; createdAt: Date; sender: Types.ObjectId; deletedAt?: Date }>([
      { $match: { forum: { $in: forumIds } } },
      { $sort: { createdAt: -1 } },
      { $group: { _id: "$forum", content: { $first: "$content" }, createdAt: { $first: "$createdAt" }, sender: { $first: "$sender" }, deletedAt: { $first: "$deletedAt" } } },
    ]),
    ChatReadState.find({ user: userId, forum: { $in: forumIds } }).lean(),
    User.countDocuments({ isActive: true }),
    User.countDocuments({ isActive: true, role: { $in: ["teacher", "admin"] } }),
  ])

  const senderIds = [...new Set(lastMessages.map((m) => m.sender.toString()))]
  const senders = await User.find({ _id: { $in: senderIds } }).select("name").lean()
  const senderName = new Map(senders.map((u) => [u._id.toString(), u.name]))
  const lastByForum = new Map(lastMessages.map((m) => [m._id.toString(), m]))
  const readByForum = new Map(readStates.map((r) => [r.forum.toString(), r.lastReadAt]))

  const cohortNames = forums.filter((f) => f.type === "cohort" && f.cohort).map((f) => f.cohort as string)
  const cohortCounts = cohortNames.length
    ? await User.aggregate<{ _id: string; count: number }>([
        { $match: { isActive: true, role: "student", cohort: { $in: cohortNames } } },
        { $group: { _id: "$cohort", count: { $sum: 1 } } },
      ])
    : []
  const cohortCount = new Map(cohortCounts.map((c) => [c._id, c.count]))

  // A group the user has never opened starts at 0 unread (like joining a WhatsApp group),
  // otherwise existing members would see every historical message as unread.
  const unreadCounts = await Promise.all(
    forums.map((f) => {
      const lastRead = readByForum.get(f._id.toString())
      if (!lastRead) return 0
      return Message.countDocuments({
        forum: f._id,
        sender: { $ne: userId },
        deletedAt: { $exists: false },
        createdAt: { $gt: lastRead },
      })
    })
  )

  const result = forums.map((f, i) => {
    const last = lastByForum.get(f._id.toString())
    return {
      id: f._id.toString(),
      name: f.name,
      type: f.type,
      cohort: f.cohort ?? null,
      description: f.description ?? null,
      memberCount: f.type === "general" ? activeUsers : (cohortCount.get(f.cohort ?? "") ?? 0) + staffCount,
      unreadCount: unreadCounts[i],
      lastMessage: last
        ? {
            content: last.deletedAt ? "This message was deleted" : last.content,
            createdAt: last.createdAt.toISOString(),
            senderId: last.sender.toString(),
            senderName: senderName.get(last.sender.toString()) ?? "Someone",
            deleted: !!last.deletedAt,
          }
        : null,
    }
  })

  // Most recent activity first, like WhatsApp
  return result.sort((a, b) => {
    const ta = a.lastMessage ? Date.parse(a.lastMessage.createdAt) : 0
    const tb = b.lastMessage ? Date.parse(b.lastMessage.createdAt) : 0
    return tb - ta
  })
}

export async function getForumMembers(forumId: string) {
  const session = await auth()
  if (!session?.user) return null

  await connectDB()
  const forum = await ChatForum.findOne({ _id: forumId, ...forumFilterFor(session.user) }).lean()
  if (!forum) return null

  const filter =
    forum.type === "general"
      ? { isActive: true }
      : { isActive: true, $or: [{ role: "student", cohort: forum.cohort }, { role: { $in: ["teacher", "admin"] } }] }

  const [total, users] = await Promise.all([
    User.countDocuments(filter),
    User.find(filter).select("name role avatarUrl").sort({ name: 1 }).limit(300).lean(),
  ])

  const roleOrder: Record<string, number> = { admin: 0, teacher: 1, student: 2 }
  return {
    total,
    members: users
      .map((u) => ({ id: u._id.toString(), name: u.name, role: u.role as string, avatarUrl: u.avatarUrl ?? null }))
      .sort((a, b) => (roleOrder[a.role] ?? 3) - (roleOrder[b.role] ?? 3)),
  }
}

/** Lightweight membership check used by the realtime API routes. */
export async function hasForumAccess(forumId: string) {
  const session = await auth()
  if (!session?.user) return false
  await connectDB()
  return canAccessForum(session.user, forumId)
}

export async function markForumRead(forumId: string) {
  const session = await auth()
  if (!session?.user) return { error: "Unauthorized" }

  await connectDB()
  if (!(await canAccessForum(session.user, forumId))) return { error: "Not found" }

  await ChatReadState.findOneAndUpdate(
    { user: session.user.id, forum: forumId },
    { lastReadAt: new Date() },
    { upsert: true }
  )
  return { success: true }
}

// ─── Messages ─────────────────────────────────────────────────────────────────

export async function getMessages(forumId: string, options: { limit?: number; before?: string } = {}) {
  const session = await auth()
  if (!session?.user) return []

  await connectDB()
  if (!(await canAccessForum(session.user, forumId))) return []

  const limit = Math.min(options.limit ?? 50, 100)
  const query: Record<string, unknown> = { forum: forumId }
  if (options.before) query.createdAt = { $lt: new Date(options.before) }

  const messages = await Message.find(query)
    .sort({ createdAt: -1 })
    .limit(limit)
    .populate("sender", "name role avatarUrl")
    .lean()

  return messages.reverse().map((m) => toMessageDTO(m as unknown as LeanMessage))
}

export async function sendMessage(forumId: string, content: string, replyToId?: string | null) {
  const session = await auth()
  if (!session?.user) return { error: "Unauthorized" }

  const trimmed = content.trim()
  if (!trimmed || trimmed.length > 2000) return { error: "Invalid message" }

  await connectDB()
  if (!(await canAccessForum(session.user, forumId))) return { error: "You are not a member of this group" }

  let replyTo: { message: Types.ObjectId; senderName: string; content: string } | undefined
  if (replyToId && Types.ObjectId.isValid(replyToId)) {
    const original = await Message.findOne({ _id: replyToId, forum: forumId, deletedAt: { $exists: false } })
      .populate("sender", "name")
      .lean()
    if (original) {
      replyTo = {
        message: original._id,
        senderName: (original.sender as unknown as { name?: string } | null)?.name ?? "Someone",
        content: original.content.slice(0, 300),
      }
    }
  }

  const [msg, me] = await Promise.all([
    Message.create({ forum: forumId, sender: session.user.id, content: trimmed, replyTo }),
    User.findById(session.user.id).select("avatarUrl").lean(),
  ])

  // Sending a message means you've seen everything up to now
  await ChatReadState.findOneAndUpdate(
    { user: session.user.id, forum: forumId },
    { lastReadAt: new Date() },
    { upsert: true }
  )

  const message: ChatMessageDTO = {
    id: msg._id.toString(),
    content: msg.content,
    createdAt: msg.createdAt.toISOString(),
    deleted: false,
    replyTo: replyTo ? { id: replyTo.message.toString(), senderName: replyTo.senderName, content: replyTo.content } : null,
    sender: {
      id: session.user.id,
      name: session.user.name ?? "User",
      role: session.user.role,
      avatarUrl: me?.avatarUrl ?? null,
    },
  }
  return { success: true, message }
}

/** "Delete for everyone": senders can delete their own messages, admins can delete any. */
export async function deleteMessage(messageId: string) {
  const session = await auth()
  if (!session?.user) return { error: "Unauthorized" }
  if (!Types.ObjectId.isValid(messageId)) return { error: "Invalid message" }

  await connectDB()
  const msg = await Message.findById(messageId)
  if (!msg) return { error: "Message not found" }
  if (msg.sender.toString() !== session.user.id && session.user.role !== "admin") {
    return { error: "You can only delete your own messages" }
  }
  if (!(await canAccessForum(session.user, msg.forum.toString()))) return { error: "Not found" }

  msg.deletedAt = new Date()
  msg.content = "[deleted]"
  msg.replyTo = undefined
  await msg.save()

  return { success: true, forumId: msg.forum.toString() }
}

export async function ensureDefaultForums() {
  await connectDB()
  const general = await ChatForum.findOne({ type: "general" })
  if (!general) {
    await ChatForum.create({ name: "General", type: "general", description: "General discussion for all members" })
  }
}
