import "server-only"
import { randomBytes } from "node:crypto"
import Certificate from "@/models/Certificate.model"
import CertificateTemplate from "@/models/CertificateTemplate.model"
import Course from "@/models/Course.model"

export const DEFAULT_CERTIFICATE_TITLE = "Certificate of Completion"

export type CertificateDesign = {
  title: string
  institutionName: string
  logos: string[]
  signatures: { name: string; role: string; url: string | null }[]
  isEnabled: boolean
}

/** Course design with the legacy single logo/signature as the fallback. */
export async function getCertificateDesign(courseId: string, fallback?: { institutionName?: string; logoUrl?: string | null; signatureUrl?: string | null }): Promise<CertificateDesign> {
  const template = await CertificateTemplate.findOne({ course: courseId }).lean()
  const logos = (template?.logos ?? []).map((l) => l.url).filter(Boolean)
  const signatures = (template?.signatures ?? []).map((s) => ({ name: s.name ?? "", role: s.role ?? "", url: s.url ?? null }))
  return {
    title: template?.title?.trim() || DEFAULT_CERTIFICATE_TITLE,
    institutionName: template?.institutionName?.trim() || fallback?.institutionName || "Living Faith Foundation",
    logos: logos.length ? logos : fallback?.logoUrl ? [fallback.logoUrl] : [],
    signatures: signatures.length
      ? signatures
      : fallback?.signatureUrl
        ? [{ name: "", role: "Authorized Signature", url: fallback.signatureUrl }]
        : [],
    isEnabled: template?.isEnabled ?? true,
  }
}

/**
 * Issues a completion certificate once. The serial is generated server-side and is
 * unique per certificate; replays return the existing record untouched.
 */
export async function issueCertificate(studentId: string, courseId: string) {
  const existing = await Certificate.findOne({ student: studentId, course: courseId }).lean()
  if (existing) return existing

  const course = await Course.findById(courseId).select("title").lean()
  if (!course) return null

  const year = new Date().getFullYear()
  const prefix = (process.env.CERTIFICATE_SERIAL_PREFIX ?? "LFF").toUpperCase().replace(/[^A-Z0-9]/g, "").slice(0, 8) || "LFF"

  for (let attempt = 0; attempt < 5; attempt++) {
    const serial = `${prefix}-${year}-${randomBytes(4).toString("hex").toUpperCase()}`
    try {
      return await Certificate.findOneAndUpdate(
        { student: studentId, course: courseId },
        { $setOnInsert: { student: studentId, course: courseId, issuedAt: new Date(), serial } },
        { upsert: true, new: true },
      )
    } catch (error) {
      const code = (error as { code?: number }).code
      if (code !== 11000) throw error
      const settled = await Certificate.findOne({ student: studentId, course: courseId }).lean()
      if (settled) return settled
    }
  }
  return null
}
