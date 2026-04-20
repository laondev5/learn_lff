import { notFound } from "next/navigation"
import { getCourseForStudent } from "@/actions/student.actions"
import Link from "next/link"
import Image from "next/image"
import { Badge } from "@/components/ui/badge"
import { Button, buttonVariants } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Progress } from "@/components/ui/progress"
import { CheckCircle2, Circle, Lock, Award, ChevronRight, PlayCircle, BookOpen, Clock, MessageCircle } from "lucide-react"
import { CourseQAClient } from "@/components/shared/CourseQAClient"
import { getCourseQuestions } from "@/actions/qa.actions"
import { auth } from "@/auth"
import { cn } from "@/lib/utils"

interface Props {
  params: Promise<{ courseId: string }>
}

export default async function StudentCoursePage({ params }: Props) {
  const { courseId } = await params
  const session = await auth()
  const [course, questions] = await Promise.all([
    getCourseForStudent(courseId),
    getCourseQuestions(courseId),
  ])

  if (!course || "error" in course) notFound()

  // Calculate generic progress layout data
  const progressPercent = course.totalLessons > 0 
    ? Math.round((course.completedLessonsCount / course.totalLessons) * 100) 
    : 0

  let primaryActionUrl: string | null = null
  let primaryActionLabel = "Start Course"
  let ActionIcon = PlayCircle

  if (course.totalLessons === 0) {
    primaryActionLabel = "Coming Soon"
  } else if (course.examPassed) {
    primaryActionLabel = "View Certificate"
    primaryActionUrl = `/student/certificates`
    ActionIcon = Award
  } else if (course.allModulesComplete && course.hasExam) {
    primaryActionLabel = "Take Final Exam"
    primaryActionUrl = `/student/courses/${courseId}/exam`
    ActionIcon = Award
  } else if (course.completedLessonsCount === course.totalLessons) {
    primaryActionLabel = "Review Course"
    primaryActionUrl = course.modules[0]?.lessons[0]?.id ? `/student/courses/${courseId}/lessons/${course.modules[0]?.lessons[0]?.id}` : null
    ActionIcon = BookOpen
  } else {
    // Find next lesson
    let nextLessonId = null
    for (const mod of course.modules) {
      for (const lesson of mod.lessons) {
        if (!lesson.isCompleted) {
          nextLessonId = lesson.id
          break
        }
      }
      if (nextLessonId) break
    }
    
    primaryActionLabel = course.completedLessonsCount === 0 ? "Start Course" : "Continue Course"
    primaryActionUrl = nextLessonId ? `/student/courses/${courseId}/lessons/${nextLessonId}` : null
    ActionIcon = PlayCircle
  }

  return (
    <div className="space-y-8 max-w-4xl mx-auto pb-10">
      {/* Hero Section */}
      <div className="relative overflow-hidden rounded-2xl bg-gradient-to-br from-primary/10 via-background to-muted border shadow-sm">
        <div className="grid md:grid-cols-[1.5fr_1fr] gap-6 h-full min-h-[320px]">
          <div className="p-8 md:p-10 flex flex-col justify-center space-y-6 z-10">
            <div className="space-y-2">
              <div className="flex items-center gap-2 mb-4">
                <Badge variant="outline" className="bg-background/80 backdrop-blur-sm shadow-sm font-medium">
                  Course
                </Badge>
                {course.examPassed && (
                  <Badge variant="default" className="gap-1 shadow-sm font-medium bg-green-600 hover:bg-green-700">
                    <Award className="h-3 w-3" />
                    Completed
                  </Badge>
                )}
              </div>
              <h1 className="text-3xl md:text-4xl font-extrabold tracking-tight text-foreground leading-tight">{course.title}</h1>
              <p className="text-muted-foreground text-base md:text-lg max-w-xl leading-relaxed mt-4 line-clamp-3">
                {course.description}
              </p>
            </div>
            
            {(course.totalLessons > 0) && (
              <div className="bg-background/80 backdrop-blur-md p-5 rounded-xl border border-border flex-1 max-w-md w-full shadow-sm">
                <div className="flex items-end justify-between mb-2">
                  <div className="space-y-1">
                    <p className="text-sm font-semibold text-foreground">Course Progress</p>
                    <p className="text-xs text-muted-foreground">{course.completedLessonsCount} of {course.totalLessons} lessons completed</p>
                  </div>
                  <span className="text-lg font-bold text-primary">{progressPercent}%</span>
                </div>
                <Progress value={progressPercent} className="h-2.5 bg-primary/20" />
              </div>
            )}

            <div className="flex items-center gap-3 pt-2">
              {primaryActionUrl ? (
                <Link 
                  href={primaryActionUrl}
                  className={cn(
                    buttonVariants({ size: "lg" }),
                    "rounded-full shadow-md font-semibold px-8 hover:scale-[1.02] transition-transform"
                  )}
                >
                  <ActionIcon className="mr-2 h-5 w-5" />
                  {primaryActionLabel}
                </Link>
              ) : (
                <Button disabled size="lg" className="rounded-full shadow-md font-semibold px-8">
                  <ActionIcon className="mr-2 h-5 w-5" />
                  {primaryActionLabel}
                </Button>
              )}
            </div>
          </div>
          
          {/* Cover Image */}
          <div className="relative hidden md:block h-full w-full bg-muted overflow-hidden">
            {course.coverImageUrl ? (
              <Image 
                src={course.coverImageUrl} 
                alt={course.title} 
                fill 
                className="object-cover transition-transform hover:scale-105 duration-700" 
                priority
                sizes="(max-width: 768px) 100vw, 50vw"
              />
            ) : (
              <div className="absolute inset-0 bg-primary/5 flex items-center justify-center">
                <BookOpen className="h-24 w-24 text-primary/20" />
              </div>
            )}
            {/* Soft gradient fade so the text is fully readable on boundaries */}
            <div className="absolute inset-y-0 left-0 w-24 bg-gradient-to-r from-background to-transparent" />
          </div>
        </div>
      </div>

      <div className="space-y-6">
        <h2 className="text-2xl font-bold tracking-tight">Course Curriculum</h2>
        
        {course.modules.length === 0 ? (
          <Card className="bg-muted/30 border-dashed">
            <CardContent className="flex flex-col items-center justify-center py-20 text-center space-y-4">
              <Clock className="h-12 w-12 text-muted-foreground/50" />
              <div>
                <p className="text-lg font-semibold text-foreground">Modules coming soon</p>
                <p className="text-sm text-muted-foreground mt-1 max-w-sm mx-auto">
                  The instructor is currently working on adding content. Check back later to start your learning journey!
                </p>
              </div>
            </CardContent>
          </Card>
        ) : (
          <div className="space-y-4">
            {course.modules.map((mod, modIdx) => {
              const prevModuleComplete = modIdx === 0 || course.modules[modIdx - 1].isCompleted
              return (
                <Card key={mod.id} className="overflow-hidden border-border/80 shadow-sm transition-colors hover:border-primary/20">
                  <CardHeader className="bg-muted/30 pb-4 border-b">
                    <div className="flex items-center gap-3">
                      {mod.isCompleted ? (
                        <CheckCircle2 className="h-6 w-6 text-green-500 shrink-0" />
                      ) : (
                        <div className="flex items-center justify-center h-6 w-6 rounded-full border-2 border-primary/30 bg-background font-bold text-xs text-primary">
                          {modIdx + 1}
                        </div>
                      )}
                      <CardTitle className="text-lg font-semibold">{mod.title}</CardTitle>
                      {mod.isCompleted && <Badge variant="secondary" className="ml-auto text-xs bg-green-500/10 text-green-600 hover:bg-green-500/20 border-green-500/20">Completed</Badge>}
                    </div>
                  </CardHeader>
                  <CardContent className="p-0">
                    <div className="divide-y divide-border/60">
                      {mod.lessons.length === 0 ? (
                        <div className="p-6 text-sm text-muted-foreground italic text-center bg-background/50">No lessons in this module yet.</div>
                      ) : (
                        mod.lessons.map((lesson, lessonIdx) => {
                          const prevLessonComplete =
                            lessonIdx === 0
                              ? prevModuleComplete
                              : mod.lessons[lessonIdx - 1].isCompleted
                          const locked = !prevLessonComplete && !lesson.isCompleted

                          return (
                            <div key={lesson.id} className={`flex items-center gap-4 p-4 lg:p-5 transition-colors ${locked ? "bg-muted/10" : "hover:bg-muted/40 cursor-pointer"}`}>
                              {lesson.isCompleted ? (
                                <CheckCircle2 className="h-5 w-5 text-green-500 shrink-0" />
                              ) : locked ? (
                                <Lock className="h-5 w-5 text-muted-foreground/50 shrink-0" />
                              ) : (
                                <Circle className="h-5 w-5 text-primary/40 shrink-0" />
                              )}
                              
                              <span className={`text-base flex-1 font-medium ${locked ? "text-muted-foreground/70" : "text-foreground"}`}>
                                {lesson.title}
                              </span>
                              
                              {!locked && (
                                <Link 
                                  href={`/student/courses/${courseId}/lessons/${lesson.id}`}
                                  className={cn(
                                    buttonVariants({ variant: lesson.isCompleted ? "outline" : "secondary", size: "sm" }),
                                    lesson.isCompleted ? "opacity-70 hover:opacity-100" : "font-semibold shadow-sm"
                                  )}
                                >
                                  {lesson.isCompleted ? "Review" : "Start lesson"}
                                  <ChevronRight className="ml-1 h-3.5 w-3.5" />
                                </Link>
                              )}
                            </div>
                          )
                        })
                      )}
                    </div>
                  </CardContent>
                </Card>
              )
            })}
          </div>
        )}

        {/* Exam */}
        {course.hasExam && (
          <Card className={`border-border/80 shadow-sm mt-8 ${!course.allModulesComplete ? "opacity-60 bg-muted/20" : "border-primary/30"}`}>
            <CardHeader className="p-6">
              <div className="flex items-center justify-between gap-4">
                <div className="flex items-center gap-4">
                  <div className={`p-3 rounded-xl ${course.examPassed ? "bg-green-500/10" : "bg-primary/10 shadow-inner"}`}>
                    {course.examPassed ? (
                      <CheckCircle2 className="h-6 w-6 text-green-500 shrink-0 flex-none" />
                    ) : course.allModulesComplete ? (
                      <Award className="h-6 w-6 text-primary shrink-0 flex-none" />
                    ) : (
                      <Lock className="h-6 w-6 text-muted-foreground shrink-0 flex-none" />
                    )}
                  </div>
                  <div>
                    <CardTitle className="text-xl">Final Certification Exam</CardTitle>
                    <p className="text-sm text-muted-foreground mt-1">
                      {!course.allModulesComplete 
                        ? "Complete all modules first to unlock the final exam."
                        : "Test your knowledge and earn your official certificate of completion."}
                    </p>
                  </div>
                </div>
                {course.allModulesComplete && !course.examPassed && (
                  <Button asChild size="lg" className="font-semibold shadow-md hover:scale-[1.02] transition-transform bg-primary">
                    <Link href={`/student/courses/${courseId}/exam`}>
                      Take Exam
                      <ChevronRight className="ml-2 h-4 w-4" />
                    </Link>
                  </Button>
                )}
                {course.examPassed && (
                  <Badge className="bg-green-500 hover:bg-green-600 text-white px-4 py-1.5 shadow-sm text-sm">
                    Passed!
                  </Badge>
                )}
              </div>
            </CardHeader>
          </Card>
        )}
      </div>

      <hr className="my-10" />

      <CourseQAClient 
        courseId={courseId}
        initialQuestions={questions}
        currentUserId={session!.user.id}
        userRole={session!.user.role}
        isTeacherOfCourse={false}
      />

    </div>
  )
}
