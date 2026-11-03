import { NextRequest, NextResponse } from "next/server"
import { auth } from "@/auth"
import { hasForumAccess } from "@/actions/chat.actions"
import { pusherServer } from "@/lib/pusher-server"

const FORUM_CHANNEL = /^(private|presence)-forum-([a-f0-9]{24})$/

export async function POST(req: NextRequest) {
  const session = await auth()
  if (!session?.user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  }

  const body = await req.text()
  const params = new URLSearchParams(body)
  const socketId = params.get("socket_id")
  const channel = params.get("channel_name")

  if (!socketId || !channel) {
    return NextResponse.json({ error: "Bad request" }, { status: 400 })
  }

  // This endpoint hands out Pusher signatures: it must only ever sign the chat
  // channels of forums this user belongs to, never an arbitrary channel name.
  const match = channel.match(FORUM_CHANNEL)
  if (!match) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 })
  }
  if (!(await hasForumAccess(match[2]))) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 })
  }

  const userData = {
    user_id: session.user.id,
    user_info: { name: session.user.name, role: session.user.role },
  }

  const authResponse = pusherServer.authorizeChannel(socketId, channel, userData)
  return NextResponse.json(authResponse)
}
