import "server-only"
import Pusher from "pusher"

export const pusherServer = new Pusher({
  appId: process.env.PUSHER_APP_ID!,
  key: process.env.PUSHER_KEY!,
  secret: process.env.PUSHER_SECRET!,
  cluster: process.env.PUSHER_CLUSTER!,
  useTLS: true,
})

/** Private: only members whose access /api/pusher/auth checks can subscribe. */
export const forumChannel = (forumId: string) => `private-forum-${forumId}`
export const forumPresenceChannel = (forumId: string) => `presence-forum-${forumId}`
