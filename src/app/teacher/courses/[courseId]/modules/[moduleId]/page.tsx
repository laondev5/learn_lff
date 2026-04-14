import { notFound } from "next/navigation"
import { getModuleWithLessons } from "@/lib/course.queries"
import { ModuleDetailClient } from "@/components/teacher/ModuleDetailClient"

export const dynamic = "force-dynamic"

interface Props {
  params: Promise<{ courseId: string; moduleId: string }>
}

export default async function ModuleDetailPage({ params }: Props) {
  const { moduleId } = await params
  const mod = await getModuleWithLessons(moduleId)
  
  if (!mod || 'error' in mod) {
    notFound()
  }

  return <ModuleDetailClient mod={mod} />
}
