import { NextRequest, NextResponse } from "next/server"
import { createHmac, timingSafeEqual } from "node:crypto"
import { verifyPaystackPayment } from "@/lib/paystack"
import { settlePaymentFromProvider } from "@/lib/payments"

/**
 * Paystack webhook. It is the reliable settlement path when a student closes the
 * tab or loses connection before the browser redirect happens.
 *
 * The payload is never trusted for money values: the signature is verified, then
 * the charge is re-fetched from Paystack and settled idempotently.
 */
export async function POST(req: NextRequest) {
  const secret = process.env.PAYSTACK_SECRET_KEY
  if (!secret) return NextResponse.json({ error: "Not configured" }, { status: 503 })

  const raw = await req.text()
  const signature = req.headers.get("x-paystack-signature") ?? ""
  const expected = createHmac("sha512", secret).update(raw).digest("hex")
  const signatureValid =
    signature.length === expected.length &&
    (() => {
      try {
        return timingSafeEqual(Buffer.from(signature, "utf8"), Buffer.from(expected, "utf8"))
      } catch {
        return false
      }
    })()

  if (!signatureValid) return NextResponse.json({ error: "Invalid signature" }, { status: 401 })

  let event: { event?: string; data?: { reference?: string; status?: string } }
  try {
    event = JSON.parse(raw)
  } catch {
    return NextResponse.json({ error: "Invalid payload" }, { status: 400 })
  }

  const reference = event.data?.reference
  if (!reference) return NextResponse.json({ received: true })

  try {
    if (event.event === "charge.success") {
      const verification = await verifyPaystackPayment(reference)
      if (verification.success && verification.data) {
        await settlePaymentFromProvider(reference, { ...verification.data, status: "success" })
      }
    } else if (event.event === "charge.failed" || event.event === "charge.abandoned") {
      await settlePaymentFromProvider(reference, {
        reference,
        status: event.event.replace("charge.", ""),
      })
    }
  } catch (error) {
    // A 500 makes Paystack retry; settlement is idempotent so retries are safe.
    console.error("Paystack webhook error:", error)
    return NextResponse.json({ error: "Settlement failed" }, { status: 500 })
  }

  return NextResponse.json({ received: true })
}
