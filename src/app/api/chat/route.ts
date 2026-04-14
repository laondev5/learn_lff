import { NextRequest, NextResponse } from "next/server"
import { auth } from "@/auth"
import Pusher from "pusher"
import { sendMessage } from "@/actions/chat.actions"

const pusher = new Pusher({
  appId: process.env.PUSHER_APP_ID!,
  key: process.env.PUSHER_KEY!,
  secret: process.env.PUSHER_SECRET!,
  cluster: process.env.PUSHER_CLUSTER!,
  useTLS: true,
})

export async function POST(req: NextRequest) {
  const session = await auth()
  if (!session?.user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  }

  const { forumId, content } = await req.json()
  if (!forumId || !content) {
    return NextResponse.json({ error: "Missing fields" }, { status: 400 })
  }

  const result = await sendMessage(forumId, content)
  if (result.error) {
    return NextResponse.json({ error: result.error }, { status: 400 })
  }

  // Trigger Pusher event
  await pusher.trigger(`forum-${forumId}`, "new-message", result.message)

  return NextResponse.json({ success: true, message: result.message })
}
