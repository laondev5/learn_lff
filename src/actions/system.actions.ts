"use server"

import { connectDB } from "@/lib/mongoose"
import SystemConfig from "@/models/SystemConfig.model"
import { auth } from "@/auth"
import { revalidatePath } from "next/cache"
import cloudinary from "@/lib/cloudinary"

export async function getSystemConfig() {
  await connectDB()
  const config = await SystemConfig.findOne().lean()
  if (!config) {
    return { organizationName: "LFF", logoUrl: null, signatureUrl: null }
  }
  return {
    organizationName: config.organizationName,
    logoUrl: config.logoUrl ?? null,
    signatureUrl: config.signatureUrl ?? null,
    stuckDurationHours: config.stuckDurationHours ?? 72,
  }
}

export async function updateSystemSettings(formData: FormData) {
  const session = await auth()
  if (!session?.user || session.user.role !== "admin") return { error: "Unauthorized" }

  const name = formData.get("organizationName")?.toString().trim()
  const stuckDuration = Number(formData.get("stuckDurationHours"))

  if (name && name.length < 2) return { error: "Name must be at least 2 characters" }
  if (isNaN(stuckDuration) || stuckDuration < 1) return { error: "Invalid duration" }

  await connectDB()
  await SystemConfig.findOneAndUpdate(
    {},
    {
      ...(name ? { organizationName: name } : {}),
      stuckDurationHours: stuckDuration,
    },
    { upsert: true, new: true }
  )

  revalidatePath("/admin/settings")
  return { success: true }
}

export async function uploadSystemImage(formData: FormData, type: "logo" | "signature") {
  const session = await auth()
  if (!session?.user || session.user.role !== "admin") return { error: "Unauthorized" }

  const file = formData.get("file") as File | null
  if (!file) return { error: "No file provided" }

  const bytes = await file.arrayBuffer()
  const buffer = Buffer.from(bytes)
  const base64 = `data:${file.type};base64,${buffer.toString("base64")}`

  await connectDB()
  const existing = await SystemConfig.findOne().lean()

  // Delete old image from Cloudinary if it exists
  if (existing) {
    const oldId = type === "logo" ? existing.logoPublicId : existing.signaturePublicId
    if (oldId) {
      await cloudinary.uploader.destroy(oldId).catch(() => {})
    }
  }

  const result = await cloudinary.uploader.upload(base64, {
    folder: `lff-lms/system`,
    resource_type: "image",
  })

  const update =
    type === "logo"
      ? { logoUrl: result.secure_url, logoPublicId: result.public_id }
      : { signatureUrl: result.secure_url, signaturePublicId: result.public_id }

  await SystemConfig.findOneAndUpdate({}, update, { upsert: true, new: true })

  revalidatePath("/admin/settings")
  return { success: true, url: result.secure_url }
}
