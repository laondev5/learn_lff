import { NextRequest, NextResponse } from "next/server"
import { auth } from "@/auth"
import { verifyPaystackPayment } from "@/lib/paystack"
import { settlePaymentFromProvider, type ProviderCharge } from "@/lib/payments"
import { connectDB } from "@/lib/mongoose"
import PaymentTransaction from "@/models/PaymentTransaction.model"
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

    await connectDB()
    // The record created server-side when checkout started is the source of
    // truth for who paid and what they bought — not the metadata Paystack echoes back.
    const transaction = await PaymentTransaction.findOne({ reference: ref }).select("student course status").lean()
    if (!transaction) return fail(req, "Unknown payment reference")
    if (transaction.student.toString() !== session.user.id) {
      return fail(req, "This payment belongs to a different account")
    }

    // Revisiting a settled callback is harmless: settlement is idempotent.
    if (transaction.status === "success") {
      revalidatePath("/student/dashboard")
      return NextResponse.redirect(
        new URL(`/student/courses/${transaction.course}?success=${encodeURIComponent("Payment already confirmed")}`, req.url)
      )
    }

    const verification = await verifyPaystackPayment(ref)
    const charge = (verification.data ?? {}) as ProviderCharge
    const settlement = verification.success
      ? await settlePaymentFromProvider(ref, { ...charge, status: "success" })
      : charge.status
        ? await settlePaymentFromProvider(ref, charge)
        : { status: "pending" as const, reason: "verification_unavailable" }

    if (settlement.status === "success") {
      revalidatePath("/student/dashboard")
      revalidatePath(`/student/courses/${transaction.course}`)
      return NextResponse.redirect(
        new URL(`/student/courses/${transaction.course}?success=${encodeURIComponent("Enrolled successfully")}`, req.url)
      )
    }

    if (settlement.status === "failed") {
      return fail(req, "Payment was not completed. You were not charged access; you can try again.")
    }

    // Provider unreachable or still pending: nothing is enrolled and the attempt stays open.
    return fail(req, "We could not confirm this payment yet. Retry from the course page in a moment.")
  } catch (error) {
    console.error("Payment verification error:", error)
    return fail(req, "An error occurred during verification")
  }
}
