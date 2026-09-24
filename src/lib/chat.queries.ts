import "server-only"
import { cache } from "react"
import { getForumsForUser } from "@/actions/chat.actions"

/** Deduped per request: the chat layout and the open room both need the group list. */
export const getForumsCached = cache(getForumsForUser)
