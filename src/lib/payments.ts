import "server-only"
import { connectDB } from "./mongoose"
import PaymentTransaction from "@/models/PaymentTransaction.model"
import Course from "@/models/Course.model"
import StudentProgress from "@/models/StudentProgress.model"

const REFERENCE_PATTERN = /^LFF-\d{1,20}-\d{1,10}$/

export type ProviderCharge = {
  amount?: number
  currency?: string
  paid_at?: string
  status?: string
  reference?: string
  [key: string]: unknown
}

export type SettlementResult =
  | { status: "success"; studentId: string; courseId: string }
  | { status: "failed"; reason: string }
  | { status: "pending"; reason: string }
  | { status: "unknown" }

/** Enrollment is an idempotent upsert: replays and concurrent callbacks cannot double-enrol. */
async function ensureEnrollment(studentId: string, courseId: string, enrolledAt: Date) {
  try {
    await StudentProgress.updateOne(
      { student: studentId, course: courseId },
      { $setOnInsert: { student: studentId, course: courseId, enrolledAt } },
      { upsert: true },
    )
  } catch (error) {
    // A concurrent settlement may have inserted it between the check and the upsert.
    if ((error as { code?: number }).code !== 11000) throw error
  }
}

async function markFailed(reference: string, response: ProviderCharge, reason: string) {
  // Only a pending attempt can fail; a settled success is never downgraded by a late event.
  await PaymentTransaction.updateOne(
    { reference, status: "pending" },
    { $set: { status: "failed", failureReason: reason, providerResponse: response } },
  )
}

/**
 * Applies a verified provider charge to the transaction created at checkout.
 * Safe to call any number of times, from the browser redirect and from the webhook:
 * the pending -> success flip happens exactly once and enrollment is an upsert.
 */
export async function settlePaymentFromProvider(reference: string, charge: ProviderCharge): Promise<SettlementResult> {
  if (!REFERENCE_PATTERN.test(reference)) return { status: "unknown" }
  await connectDB()

  const transaction = await PaymentTransaction.findOne({ reference })
  if (!transaction) return { status: "unknown" }
  const studentId = transaction.student.toString()
  const courseId = transaction.course.toString()

  // Replay of an already settled payment: never charge logic again, just make sure access exists.
  if (transaction.status === "success") {
    await ensureEnrollment(studentId, courseId, transaction.paidAt ?? transaction.updatedAt)
    return { status: "success", studentId, courseId }
  }

  const providerStatus = charge.status?.toLowerCase()
  if (providerStatus && providerStatus !== "success") {
    await markFailed(reference, charge, `provider_${providerStatus}`)
    return { status: "failed", reason: `provider_${providerStatus}` }
  }

  const course = await Course.findById(courseId).select("isPaid price").lean()
  if (!course?.isPaid) {
    // The charge exists but the course is no longer purchasable: leave it pending for an admin.
    return { status: "pending", reason: "course_not_purchasable" }
  }

  const currency = charge.currency ?? transaction.currency
  const amount = Number(charge.amount)
  const requiredKobo = Math.max(transaction.amount, course.price ?? 0) * 100

  if (currency !== transaction.currency || !Number.isFinite(amount) || amount < requiredKobo) {
    await markFailed(reference, charge, "amount_or_currency_mismatch")
    return { status: "failed", reason: "amount_or_currency_mismatch" }
  }

  const paidAtRaw = charge.paid_at ? new Date(charge.paid_at) : new Date()
  const paidAt = Number.isNaN(paidAtRaw.getTime()) ? new Date() : paidAtRaw

  const settled = await PaymentTransaction.findOneAndUpdate(
    { _id: transaction._id, status: "pending" },
    { $set: { status: "success", paidAt, providerResponse: charge }, $unset: { failureReason: 1 } },
    { new: true },
  )

  if (!settled) {
    // Another worker settled it first; access is still guaranteed below.
    const current = await PaymentTransaction.findById(transaction._id).select("status paidAt updatedAt").lean()
    if (current?.status !== "success") return { status: "pending", reason: "settlement_race" }
    await ensureEnrollment(studentId, courseId, current.paidAt ?? current.updatedAt)
    return { status: "success", studentId, courseId }
  }

  await ensureEnrollment(studentId, courseId, paidAt)
  return { status: "success", studentId, courseId }
}

/** Marks an abandoned checkout failed without touching a settled payment. */
export async function abandonPayment(reference: string, reason = "abandoned") {
  if (!REFERENCE_PATTERN.test(reference)) return
  await connectDB()
  await markFailed(reference, { status: "abandoned" }, reason)
}
