import { getTeacherCourses } from "@/lib/course.queries"
import { TeacherCoursesClient } from "@/components/teacher/TeacherCoursesClient"

export default async function TeacherCoursesPage() {
  const courses = await getTeacherCourses()
  return <TeacherCoursesClient courses={courses} />
}
