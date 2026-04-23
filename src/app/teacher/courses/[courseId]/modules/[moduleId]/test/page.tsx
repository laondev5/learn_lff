import { notFound, redirect } from "next/navigation"
import { auth } from "@/auth"
import { connectDB } from "@/lib/mongoose"
import Course from "@/models/Course.model"
import Module from "@/models/Module.model"
import Assessment from "@/models/Assessment.model"
import { AssessmentBuilderClient } from "@/components/teacher/AssessmentBuilderClient"

export const dynamic = "force-dynamic"

interface Props {
  params: Promise<{ courseId: string; moduleId: string }>
}

export default async function ModuleTestPage({ params }: Props) {
  const { courseId, moduleId } = await params
  const session = await auth()
  
  if (!session?.user || session.user.role !== "teacher") {
    redirect("/auth/login")
  }

  await connectDB()
  
  // Verify course
  const course = await Course.findOne({ _id: courseId, teacher: session.user.id }).lean()
  if (!course) notFound()

  // Verify module
  const mod = await Module.findOne({ _id: moduleId, course: courseId }).lean()
  if (!mod) notFound()

  // Check if test already exists for this module
  const assessment = await Assessment.findOne({ 
    module: moduleId,
    type: "test" // we specifically look for the module test
  }).lean()

  // Parse for client component
  const parsedAssessment = assessment ? JSON.parse(JSON.stringify(assessment)) : null

  return (
    <div className="space-y-6">
      <div className="space-y-1">
        <h1 className="text-2xl font-bold">
          {assessment ? "Edit Module Test" : "Create Module Test"}
        </h1>
        <p className="text-muted-foreground">
          For Module: <span className="font-medium text-foreground">{mod.title ?? ""}</span>
        </p>
      </div>
      
      <AssessmentBuilderClient 
        courseId={courseId} 
        moduleId={moduleId}
        assessment={parsedAssessment}
      />
    </div>
  )
}
