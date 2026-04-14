import { getTeacherCourses } from "@/lib/course.queries"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { BookOpen, Plus, ChevronRight } from "lucide-react"
import Link from "next/link"
import { CreateCourseDialog } from "@/components/teacher/CreateCourseDialog"

export default async function TeacherCoursesPage() {
  const courses = await getTeacherCourses()

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold">My Courses</h1>
          <p className="text-muted-foreground text-sm mt-1">Create and manage your courses</p>
        </div>
        <CreateCourseDialog>
          <Button className="w-full sm:w-auto">
            <Plus className="mr-2 h-4 w-4" />
            New Course
          </Button>
        </CreateCourseDialog>
      </div>

      {courses.length === 0 ? (
        <Card>
          <CardContent className="flex flex-col items-center justify-center py-16 gap-4">
            <BookOpen className="h-12 w-12 text-muted-foreground" />
            <div className="text-center">
              <p className="font-medium">No courses yet</p>
              <p className="text-sm text-muted-foreground mt-1">Create your first course to get started</p>
            </div>
            <CreateCourseDialog>
              <Button>
                <Plus className="mr-2 h-4 w-4" />
                New Course
              </Button>
            </CreateCourseDialog>
          </CardContent>
        </Card>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
          {courses.map((course) => (
            <Card key={course.id} className="flex flex-col">
              <CardHeader className="pb-3">
                <div className="flex items-start justify-between gap-2">
                  <CardTitle className="text-base leading-snug">{course.title}</CardTitle>
                  <Badge variant={course.isPublished ? "default" : "secondary"} className="shrink-0">
                    {course.isPublished ? "Published" : "Draft"}
                  </Badge>
                </div>
                <CardDescription className="line-clamp-2">{course.description}</CardDescription>
              </CardHeader>
              <CardContent className="mt-auto">
                <Button asChild variant="outline" className="w-full">
                  <Link href={`/teacher/courses/${course.id}`}>
                    Manage Course
                    <ChevronRight className="ml-2 h-4 w-4" />
                  </Link>
                </Button>
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </div>
  )
}
