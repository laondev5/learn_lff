import { NextRequest, NextResponse } from "next/server"
import { auth } from "@/auth"
import Pusher from "pusher"

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

  const body = await req.text()
  const params = new URLSearchParams(body)
  const socketId = params.get("socket_id")!
  const channel = params.get("channel_name")!

  const userData = {
    user_id: session.user.id,
    user_info: { name: session.user.name },
  }

  const authResponse = pusher.authorizeChannel(socketId, channel, userData)
  return NextResponse.json(authResponse)
}
