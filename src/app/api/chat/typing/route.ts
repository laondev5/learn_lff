import { NextRequest, NextResponse } from "next/server"
import { auth } from "@/auth"
import { hasForumAccess } from "@/actions/chat.actions"
import { forumChannel, pusherServer } from "@/lib/pusher-server"

/** Broadcasts "<name> is typing…" to a group. Clients throttle calls to ~1 every 3s. */
export async function POST(req: NextRequest) {
  const session = await auth()
  if (!session?.user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  }

  const { forumId } = await req.json()
  if (!forumId || !(await hasForumAccess(forumId))) {
    return NextResponse.json({ error: "Not found" }, { status: 404 })
  }

  await pusherServer.trigger(forumChannel(forumId), "typing", {
    userId: session.user.id,
    name: session.user.name ?? "Someone",
  })
  return NextResponse.json({ success: true })
}
