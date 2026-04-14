import { getAllStudentAnnouncements } from "@/actions/announcement.actions"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Megaphone } from "lucide-react"
import Link from "next/link"

export default async function StudentAnnouncementsPage() {
  const announcements = await getAllStudentAnnouncements()

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold flex items-center gap-2">
          <Megaphone className="h-6 w-6" />
          Announcements
        </h1>
        <p className="text-muted-foreground text-sm mt-1">
          Latest updates from your enrolled courses
        </p>
      </div>

      {announcements.length === 0 ? (
        <Card>
          <CardContent className="py-12 text-center text-muted-foreground text-sm">
            No announcements yet. Check back later!
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-4">
          {announcements.map((ann) => (
            <Card key={ann.id}>
              <CardHeader className="pb-2">
                <div className="flex items-start justify-between gap-3 flex-wrap">
                  <div>
                    <CardTitle className="text-base">{ann.title}</CardTitle>
                    <div className="flex items-center gap-2 mt-0.5 flex-wrap">
                      <Link
                        href={`/student/courses/${ann.courseId}`}
                        className="text-xs text-primary hover:underline"
                      >
                        {ann.courseTitle}
                      </Link>
                      <span className="text-xs text-muted-foreground">·</span>
                      <span className="text-xs text-muted-foreground">
                        {new Date(ann.createdAt).toLocaleDateString("en-US", {
                          year: "numeric", month: "long", day: "numeric",
                        })}
                      </span>
                    </div>
                  </div>
                </div>
              </CardHeader>
              <CardContent>
                <p className="text-sm text-muted-foreground whitespace-pre-wrap">{ann.content}</p>
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </div>
  )
}
