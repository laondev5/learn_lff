import "server-only"
import { createHash } from "crypto"
import { connectDB } from "@/lib/mongoose"
import RateWindow from "@/models/RateWindow.model"

export interface RateLimitResult {
  allowed: boolean
  retryAfterSeconds: number
}

/**
 * Fixed-window counter backed by Mongo, so it survives multiple server
 * instances without needing Redis. `scope` is anything identifying the caller
 * (email, IP); it is hashed before storage.
 */
export async function checkRateLimit(
  bucket: string,
  scope: string,
  limit: number,
  windowSeconds: number
): Promise<RateLimitResult> {
  const key = `${bucket}:${createHash("sha256").update(scope.toLowerCase()).digest("hex")}`
  const now = Date.now()

  await connectDB()

  const existing = await RateWindow.findOneAndUpdate(
    { key, expiresAt: { $gt: new Date(now) } },
    { $inc: { count: 1 } },
    { new: true }
  )

  if (existing) {
    if (existing.count > limit) {
      return {
        allowed: false,
        retryAfterSeconds: Math.max(1, Math.ceil((existing.expiresAt.getTime() - now) / 1000)),
      }
    }
    return { allowed: true, retryAfterSeconds: 0 }
  }

  try {
    await RateWindow.create({ key, count: 1, expiresAt: new Date(now + windowSeconds * 1000) })
  } catch {
    // Another request won the insert for this key; treat it as the first attempt.
  }

  return { allowed: true, retryAfterSeconds: 0 }
}

export async function clearRateLimit(bucket: string, scope: string) {
  const key = `${bucket}:${createHash("sha256").update(scope.toLowerCase()).digest("hex")}`
  await connectDB()
  await RateWindow.deleteOne({ key })
}
