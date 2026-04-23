import { connectDB } from "./mongoose"
import PaymentTransaction from "@/models/PaymentTransaction.model"

const PAYSTACK_SECRET_KEY = process.env.PAYSTACK_SECRET_KEY

export async function initializePaystackPayment({
  email,
  amount,
  courseId,
  studentId,
}: {
  email: string
  amount: number
  courseId: string
  studentId: string
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
      callback_url: `${process.env.NEXTAUTH_URL}/api/payments/verify`,
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

  if (!data.status || data.data.status !== "success") {
    return { success: false, message: data.message || "Verification failed" }
  }

  return {
    success: true,
    data: data.data,
  }
}
