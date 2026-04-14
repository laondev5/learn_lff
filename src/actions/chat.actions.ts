"use server"

import { connectDB } from "@/lib/mongoose"
import { auth } from "@/auth"
import ChatForum from "@/models/ChatForum.model"
import Message from "@/models/Message.model"
import { Types } from "mongoose"

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

  let forums
  if (session.user.role === "admin" || session.user.role === "teacher") {
    forums = await ChatForum.find().sort({ type: 1, name: 1 }).lean()
  } else {
    // Student: see their cohort forum + general
    const conditions: object[] = [{ type: "general" }]
    if (session.user.cohort) {
      conditions.push({ type: "cohort", cohort: session.user.cohort })
    }
    forums = await ChatForum.find({ $or: conditions }).sort({ type: 1, name: 1 }).lean()
  }

  return forums.map((f) => ({
    id: f._id.toString(),
    name: f.name,
    type: f.type,
    cohort: f.cohort ?? null,
    description: f.description ?? null,
  }))
}

export async function getMessages(forumId: string, limit = 50) {
  const session = await auth()
  if (!session?.user) return []

  await connectDB()

  const messages = await Message.find({ forum: forumId })
    .sort({ createdAt: -1 })
    .limit(limit)
    .populate("sender", "name role")
    .lean()

  return messages.reverse().map((m) => {
    const sender = m.sender as unknown as { _id: Types.ObjectId; name: string; role: string }
    return {
      id: m._id.toString(),
      content: m.content,
      createdAt: m.createdAt.toISOString(),
      sender: {
        id: sender._id.toString(),
        name: sender.name,
        role: sender.role,
      },
    }
  })
}

export async function sendMessage(forumId: string, content: string) {
  const session = await auth()
  if (!session?.user) return { error: "Unauthorized" }

  const trimmed = content.trim()
  if (!trimmed || trimmed.length > 2000) return { error: "Invalid message" }

  await connectDB()
  const msg = await Message.create({
    forum: forumId,
    sender: session.user.id,
    content: trimmed,
  })

  return {
    success: true,
    message: {
      id: msg._id.toString(),
      content: msg.content,
      createdAt: msg.createdAt.toISOString(),
      sender: {
        id: session.user.id,
        name: session.user.name ?? "User",
        role: session.user.role,
      },
    },
  }
}

export async function ensureDefaultForums() {
  await connectDB()
  const general = await ChatForum.findOne({ type: "general" })
  if (!general) {
    await ChatForum.create({ name: "General", type: "general", description: "General discussion for all members" })
  }
}
