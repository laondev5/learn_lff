import "server-only"
import { createHash, randomBytes } from "node:crypto"

export const RESET_TOKEN_TTL_MS = 30 * 60 * 1000
/** Admission emails are opened days later, so onboarding links live longer than a reset link. */
export const SET_PASSWORD_TTL_MS = 7 * 24 * 60 * 60 * 1000

/** Tokens are only ever stored hashed, so a database leak cannot reset accounts. */
export function hashResetToken(token: string) {
  return createHash("sha256").update(token).digest("hex")
}

export function createResetToken(ttlMs: number = RESET_TOKEN_TTL_MS) {
  const token = randomBytes(32).toString("base64url")
  return {
    token,
    tokenHash: hashResetToken(token),
    expiresAt: new Date(Date.now() + ttlMs),
  }
}
