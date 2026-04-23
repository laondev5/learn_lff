import { NextRequest, NextResponse } from "next/server"
import { verifyPaystackPayment } from "@/lib/paystack"
import { connectDB } from "@/lib/mongoose"
import PaymentTransaction from "@/models/PaymentTransaction.model"
import StudentProgress from "@/models/StudentProgress.model"
import { revalidatePath } from "next/cache"

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url)
  const reference = searchParams.get("reference")
  const trxref = searchParams.get("trxref")

  const ref = reference || trxref

  if (!ref) {
    return NextResponse.redirect(new URL("/student/dashboard?error=No reference provided", req.url))
  }

  try {
    const verification = await verifyPaystackPayment(ref)

    if (verification.success) {
      const { metadata, amount, paid_at } = verification.data
      const { courseId, studentId } = metadata

      await connectDB()

      // Update transaction status
      const transaction = await PaymentTransaction.findOneAndUpdate(
        { reference: ref },
        {
          status: "success",
          paidAt: new Date(paid_at),
          providerResponse: verification.data,
        },
        { new: true }
      )

      // Create student progress (enrollment)
      const existingProgress = await StudentProgress.findOne({
        student: studentId,
        course: courseId,
      })

      if (!existingProgress) {
        await StudentProgress.create({
          student: studentId,
          course: courseId,
          enrolledAt: new Date(paid_at),
        })
      }

      revalidatePath("/student/dashboard")
      return NextResponse.redirect(new URL(`/student/courses/${courseId}?success=Enrolled successfully`, req.url))
    } else {
      return NextResponse.redirect(new URL("/student/dashboard?error=Payment verification failed", req.url))
    }
  } catch (error) {
    console.error("Payment verification error:", error)
    return NextResponse.redirect(new URL("/student/dashboard?error=An error occurred during verification", req.url))
  }
}
