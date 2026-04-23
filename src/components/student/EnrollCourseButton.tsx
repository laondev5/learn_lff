"use client"

import { useState } from "react"
import { useRouter } from "next/navigation"
import { toast } from "sonner"
import { CreditCard, Loader2, Plus } from "lucide-react"
import { Button } from "@/components/ui/button"
import { enrollInCourse, initializeCoursePayment } from "@/actions/student.actions"

interface EnrollCourseButtonProps {
  courseId: string
  isPaid?: boolean
  price?: number
}

export function EnrollCourseButton({ courseId, isPaid, price }: EnrollCourseButtonProps) {
  const [loading, setLoading] = useState(false)
  const router = useRouter()

  async function handleEnroll() {
    setLoading(true)

    if (isPaid && price && price > 0) {
      const result = await initializeCoursePayment(courseId)
      if (result.error) {
        toast.error(result.error)
      } else if (result.authorizationUrl) {
        window.location.href = result.authorizationUrl
      }
    } else {
      const result = await enrollInCourse(courseId)
      if (result.error) {
        toast.error(result.error)
      } else {
        toast.success("Enrolled successfully!")
        router.push(`/student/courses/${courseId}`)
      }
    }
    setLoading(false)
  }

  return (
    <Button onClick={handleEnroll} disabled={loading} className="w-full">
      {loading ? (
        <Loader2 className="mr-2 h-4 w-4 animate-spin" />
      ) : isPaid ? (
        <CreditCard className="mr-2 h-4 w-4" />
      ) : (
        <Plus className="mr-2 h-4 w-4" />
      )}
      {isPaid ? `Pay NGN ${price?.toLocaleString()}` : "Enroll for Free"}
    </Button>
  )
}
