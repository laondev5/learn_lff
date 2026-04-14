import { getForumsForUser } from "@/actions/chat.actions"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { MessageSquare, Users, ChevronRight } from "lucide-react"
import Link from "next/link"

export default async function ChatForumsPage() {
  const forums = await getForumsForUser()

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold">Chat Forums</h1>
        <p className="text-muted-foreground text-sm mt-1">Discuss and collaborate with your peers</p>
      </div>

      {forums.length === 0 ? (
        <Card>
          <CardContent className="py-12 text-center text-muted-foreground">
            <MessageSquare className="h-10 w-10 mx-auto mb-3 opacity-40" />
            <p>No forums available yet.</p>
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-3">
          {forums.map((forum) => (
            <Link key={forum.id} href={`/student/chat/${forum.id}`}>
              <Card className="hover:border-primary/50 transition-colors cursor-pointer">
                <CardHeader className="pb-3">
                  <div className="flex items-center justify-between gap-3">
                    <div className="flex items-center gap-3">
                      {forum.type === "cohort" ? (
                        <Users className="h-5 w-5 text-primary shrink-0" />
                      ) : (
                        <MessageSquare className="h-5 w-5 text-primary shrink-0" />
                      )}
                      <div>
                        <CardTitle className="text-base">{forum.name}</CardTitle>
                        {forum.description && (
                          <CardDescription className="mt-0.5">{forum.description}</CardDescription>
                        )}
                      </div>
                    </div>
                    <ChevronRight className="h-4 w-4 text-muted-foreground shrink-0" />
                  </div>
                </CardHeader>
              </Card>
            </Link>
          ))}
        </div>
      )}
    </div>
  )
}
