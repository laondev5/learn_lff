import { NextRequest, NextResponse } from "next/server"
import { verifyPaystackPayment } from "@/lib/paystack"
import { settlePaymentFromProvider, type ProviderCharge } from "@/lib/payments"
import { connectDB } from "@/lib/mongoose"
import PaymentTransaction from "@/models/PaymentTransaction.model"

/**
 * Paystack return URL for applicants who paid on the application form.
 * They do not have a session yet, so ownership comes from the server-side
 * transaction record created at checkout, not from a logged-in user.
 */
function back(req: NextRequest, status: string) {
  return NextResponse.redirect(new URL(`/apply?payment=${status}`, req.url))
}

export async function GET(req: NextRequest) {
  const params = new URL(req.url).searchParams
  const reference = params.get("reference") ?? params.get("trxref")
  if (!reference || !/^LFF-\d{1,20}-\d{1,10}$/.test(reference)) return back(req, "unknown")

  try {
    await connectDB()
    const transaction = await PaymentTransaction.findOne({ reference }).select("status").lean()
    if (!transaction) return back(req, "unknown")
    // Replays of a settled callback are harmless because settlement is idempotent.
    if (transaction.status === "success") return back(req, "success")

    const verification = await verifyPaystackPayment(reference)
    const charge = (verification.data ?? {}) as ProviderCharge
    const settlement = verification.success
      ? await settlePaymentFromProvider(reference, { ...charge, status: "success" })
      : charge.status
        ? await settlePaymentFromProvider(reference, charge)
        : { status: "pending" as const }

    return back(req, settlement.status === "success" ? "success" : "pending")
  } catch (error) {
    console.error("Application payment callback error:", error)
    return back(req, "unknown")
  }
}
