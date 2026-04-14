import { notFound } from "next/navigation"
import { getForumsForUser, getMessages } from "@/actions/chat.actions"
import { auth } from "@/auth"
import { ChatRoomClient } from "@/components/student/ChatRoomClient"

interface Props {
  params: Promise<{ forumId: string }>
}

export default async function ChatRoomPage({ params }: Props) {
  const { forumId } = await params
  const session = await auth()
  const forums = await getForumsForUser()
  const forum = forums.find((f) => f.id === forumId)
  if (!forum) notFound()

  const messages = await getMessages(forumId)

  return (
    <ChatRoomClient
      forum={forum}
      initialMessages={messages}
      currentUserId={session!.user.id}
      currentUserName={session!.user.name ?? "User"}
    />
  )
}
