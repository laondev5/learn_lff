import { NextRequest, NextResponse } from "next/server"
import { auth } from "@/auth"
import { verifyPaystackPayment } from "@/lib/paystack"
import { connectDB } from "@/lib/mongoose"
import PaymentTransaction from "@/models/PaymentTransaction.model"
import Course from "@/models/Course.model"
import StudentProgress from "@/models/StudentProgress.model"
import { revalidatePath } from "next/cache"

function fail(req: NextRequest, reason: string) {
  return NextResponse.redirect(
    new URL(`/student/dashboard?error=${encodeURIComponent(reason)}`, req.url)
  )
}

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url)
  const ref = searchParams.get("reference") || searchParams.get("trxref")

  // LFF-<timestamp>-<random>; anything longer is not one of ours
  if (!ref || !/^LFF-\d{1,20}-\d{1,10}$/.test(ref)) {
    return fail(req, "No payment reference provided")
  }

  try {
    // The person returning from Paystack must be signed in, and can only ever
    // be enrolled for their own account.
    const session = await auth()
    if (!session?.user || session.user.role !== "student") {
      return fail(req, "Please sign in again to confirm your payment")
    }

    const verification = await verifyPaystackPayment(ref)
    if (!verification.success) {
      return fail(req, "Payment verification failed")
    }

    await connectDB()

    // The record created server-side when checkout started is the source of
    // truth for who paid and what they bought — not the metadata Paystack echoes back.
    const transaction = await PaymentTransaction.findOne({ reference: ref })
    if (!transaction) {
      return fail(req, "Unknown payment reference")
    }
    if (transaction.student.toString() !== session.user.id) {
      return fail(req, "This payment belongs to a different account")
    }

    const courseId = transaction.course
    const course = await Course.findById(courseId).lean()
    if (!course || !course.isPaid) {
      return fail(req, "Course not available")
    }

    // Amount and currency must clear the price on the course, not on the request.
    const paid = verification.data.amount as number
    const currency = (verification.data.currency as string | undefined) ?? "NGN"
    const settledAt = verification.data.paid_at as string | undefined
    const paidAt = settledAt && !Number.isNaN(new Date(settledAt).getTime())
      ? new Date(settledAt)
      : new Date()
    if (
      currency !== transaction.currency ||
      !Number.isFinite(paid) ||
      paid < Math.max(transaction.amount, course.price) * 100
    ) {
      await PaymentTransaction.updateOne(
        { _id: transaction._id, status: { $ne: "success" } },
        { $set: { status: "failed", providerResponse: verification.data } }
      )
      return fail(req, "Payment amount does not match the course price")
    }

    // Flip pending -> success exactly once, so a replayed callback cannot re-enrol.
    const settled = await PaymentTransaction.findOneAndUpdate(
      { _id: transaction._id, status: "pending" },
      { $set: { status: "success", paidAt, providerResponse: verification.data } },
      { new: true }
    )

    if (settled) {
      const enrolled = await StudentProgress.exists({ student: session.user.id, course: courseId })
      if (!enrolled) {
        await StudentProgress.create({
          student: session.user.id,
          course: courseId,
          enrolledAt: paidAt,
        })
      }
    }

    revalidatePath("/student/dashboard")
    revalidatePath(`/student/courses/${courseId}`)
    return NextResponse.redirect(
      new URL(`/student/courses/${courseId}?success=${encodeURIComponent("Enrolled successfully")}`, req.url)
    )
  } catch (error) {
    console.error("Payment verification error:", error)
    return fail(req, "An error occurred during verification")
  }
}
