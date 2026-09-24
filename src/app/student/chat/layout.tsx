import { redirect } from "next/navigation"
import { auth } from "@/auth"
import { getForumsCached } from "@/lib/chat.queries"
import { ChatShell } from "@/components/chat/ChatShell"

export default async function ChatLayout({ children }: { children: React.ReactNode }) {
  const session = await auth()
  if (!session?.user) redirect("/auth/login")

  const groups = await getForumsCached()

  return (
    <ChatShell initialGroups={groups} me={{ id: session.user.id, name: session.user.name ?? "You" }}>
      {children}
    </ChatShell>
  )
}
