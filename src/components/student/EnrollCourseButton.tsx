"use client"

import { useState } from "react"
import { useRouter } from "next/navigation"
import { toast } from "sonner"
import { Loader2, Plus } from "lucide-react"
import { Button } from "@/components/ui/button"
import { enrollInCourse } from "@/actions/student.actions"

export function EnrollCourseButton({ courseId }: { courseId: string }) {
  const [loading, setLoading] = useState(false)
  const router = useRouter()

  async function handleEnroll() {
    setLoading(true)
    const result = await enrollInCourse(courseId)
    if (result.error) {
      toast.error(result.error)
    } else {
      toast.success("Enrolled successfully!")
      router.push(`/student/courses/${courseId}`)
    }
    setLoading(false)
  }

  return (
    <Button onClick={handleEnroll} disabled={loading} className="w-full">
      {loading ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Plus className="mr-2 h-4 w-4" />}
      Enroll
    </Button>
  )
}
