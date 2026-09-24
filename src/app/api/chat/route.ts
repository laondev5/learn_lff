import { NextRequest, NextResponse } from "next/server"
import { auth } from "@/auth"
import { deleteMessage, sendMessage } from "@/actions/chat.actions"
import { forumChannel, pusherServer } from "@/lib/pusher-server"

export async function POST(req: NextRequest) {
  const session = await auth()
  if (!session?.user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  }

  const { forumId, content, replyToId } = await req.json()
  if (!forumId || !content) {
    return NextResponse.json({ error: "Missing fields" }, { status: 400 })
  }

  const result = await sendMessage(forumId, content, replyToId)
  if (result.error || !result.message) {
    return NextResponse.json({ error: result.error ?? "Failed to send" }, { status: 400 })
  }

  await pusherServer.trigger(forumChannel(forumId), "new-message", result.message)

  return NextResponse.json({ success: true, message: result.message })
}

export async function DELETE(req: NextRequest) {
  const session = await auth()
  if (!session?.user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  }

  const { messageId } = await req.json()
  const result = await deleteMessage(messageId)
  if (result.error || !result.forumId) {
    return NextResponse.json({ error: result.error ?? "Failed to delete" }, { status: 400 })
  }

  await pusherServer.trigger(forumChannel(result.forumId), "message-deleted", { id: messageId })
  return NextResponse.json({ success: true })
}
