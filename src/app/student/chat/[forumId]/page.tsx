import { notFound } from "next/navigation"
import { getMessages } from "@/actions/chat.actions"
import { getForumsCached } from "@/lib/chat.queries"
import { auth } from "@/auth"
import { ChatRoom } from "@/components/chat/ChatRoom"

interface Props {
  params: Promise<{ forumId: string }>
}

export default async function ChatRoomPage({ params }: Props) {
  const { forumId } = await params
  const session = await auth()
  const forums = await getForumsCached()
  const forum = forums.find((f) => f.id === forumId)
  if (!forum) notFound()

  const messages = await getMessages(forumId, { limit: 50 })

  return (
    <ChatRoom
      key={forumId}
      forum={forum}
      initialMessages={messages}
      currentUserRole={session!.user.role}
    />
  )
}
