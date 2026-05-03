import "server-only"
import { connectDB } from "@/lib/mongoose"
import SecurityAuditLog, { type SecurityAuditEvent } from "@/models/SecurityAuditLog.model"

interface WriteSecurityAuditLogInput {
  event: SecurityAuditEvent
  actorUserId?: string
  targetUserId?: string
  email?: string
  role?: string
  status: "success" | "failure" | "blocked"
  ipAddress?: string
  userAgent?: string
  metadata?: Record<string, unknown>
}

export async function writeSecurityAuditLog(input: WriteSecurityAuditLogInput) {
  try {
    await connectDB()
    await SecurityAuditLog.create(input)
  } catch (error) {
    console.error("Failed to write security audit log:", error)
  }
}
