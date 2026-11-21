import { connectDB } from "./mongoose"
import PaymentTransaction from "@/models/PaymentTransaction.model"
import { getAppUrl } from "@/lib/app-url"

const PAYSTACK_SECRET_KEY = process.env.PAYSTACK_SECRET_KEY

export async function initializePaystackPayment({
  email,
  amount,
  courseId,
  studentId,
  callbackPath = "/api/payments/verify",
}: {
  email: string
  amount: number
  courseId: string
  studentId: string
  /** Where Paystack returns the payer; differs for applicants who have no session yet. */
  callbackPath?: string
}) {
  if (!PAYSTACK_SECRET_KEY) {
    throw new Error("Paystack secret key is not configured")
  }

  const reference = `LFF-${Date.now()}-${Math.floor(Math.random() * 1000000)}`

  const response = await fetch("https://api.paystack.co/transaction/initialize", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${PAYSTACK_SECRET_KEY}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      email,
      amount: amount * 100, // Paystack expects amount in kobo
      reference,
      callback_url: `${getAppUrl()}${callbackPath}`,
      metadata: {
        courseId,
        studentId,
      },
    }),
  })

  const data = await response.json()

  if (!data.status) {
    throw new Error(data.message || "Failed to initialize payment")
  }

  await connectDB()
  await PaymentTransaction.create({
    student: studentId,
    course: courseId,
    amount,
    reference,
    status: "pending",
    authorizationUrl: data.data.authorization_url,
  })

  return data.data
}

export async function verifyPaystackPayment(reference: string) {
  if (!PAYSTACK_SECRET_KEY) {
    throw new Error("Paystack secret key is not configured")
  }

  const response = await fetch(`https://api.paystack.co/transaction/verify/${reference}`, {
    method: "GET",
    headers: {
      Authorization: `Bearer ${PAYSTACK_SECRET_KEY}`,
    },
  })

  const data = await response.json()
  const charge = data?.data as Record<string, unknown> | undefined

  if (!response.ok || !data.status || charge?.status !== "success") {
    // The provider's own status (failed/abandoned/reversed) is passed through so the
    // transaction can be closed instead of lingering as pending forever.
    return {
      success: false as const,
      message: data?.message || "Verification failed",
      status: typeof charge?.status === "string" ? charge.status : undefined,
      data: charge,
    }
  }

  return {
    success: true as const,
    data: charge,
  }
}
