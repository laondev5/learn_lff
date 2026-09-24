import { NextRequest, NextResponse } from "next/server"
import { auth } from "@/auth"
import { hasForumAccess } from "@/actions/chat.actions"
import { pusherServer } from "@/lib/pusher-server"

export async function POST(req: NextRequest) {
  const session = await auth()
  if (!session?.user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  }

  const body = await req.text()
  const params = new URLSearchParams(body)
  const socketId = params.get("socket_id")!
  const channel = params.get("channel_name")!

  // Group presence channels (who's online) are limited to members of that group
  const forumMatch = channel.match(/^presence-forum-([a-f0-9]{24})$/)
  if (forumMatch && !(await hasForumAccess(forumMatch[1]))) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 })
  }

  const userData = {
    user_id: session.user.id,
    user_info: { name: session.user.name, role: session.user.role },
  }

  const authResponse = pusherServer.authorizeChannel(socketId, channel, userData)
  return NextResponse.json(authResponse)
}
