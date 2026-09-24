import { Lock, MessagesSquare } from "lucide-react"

/** Desktop placeholder shown next to the chat list, like WhatsApp Web's intro screen. */
export default function ChatHomePage() {
  return (
    <div className="flex h-full flex-col items-center justify-center border-l border-black/5 bg-[#f0f2f5] px-8 text-center dark:border-white/5 dark:bg-[#222e35]">
      <div className="flex h-28 w-28 items-center justify-center rounded-full bg-[#d9fdd3] text-[#00a884] dark:bg-[#0a332c]">
        <MessagesSquare className="h-14 w-14" />
      </div>
      <h2 className="mt-8 text-3xl font-light text-[#41525d] dark:text-[#e9edef]">LFF Community</h2>
      <p className="mt-3 max-w-md text-sm leading-relaxed text-[#667781] dark:text-[#8696a0]">
        Chat with your cohort and the whole Living Faith Foundation family. Pick a group on the left to start the conversation.
      </p>
      <p className="mt-10 flex items-center gap-1.5 text-xs text-[#8696a0]">
        <Lock className="h-3 w-3" />
        Group messages are only visible to members of that group
      </p>
    </div>
  )
}
