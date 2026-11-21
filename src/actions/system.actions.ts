"use server"

import { connectDB } from "@/lib/mongoose"
import SystemConfig from "@/models/SystemConfig.model"
import { auth } from "@/auth"
import { revalidatePath } from "next/cache"
import { deleteR2Image, uploadR2Image } from "@/lib/r2-files"

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

  if (file.size <= 0 || file.size > 10 * 1024 * 1024) return { error: "Image must be 10 MB or smaller" }
  const ext = (file.name.split(".").pop() ?? "").toLowerCase()
  if (!["jpg", "jpeg", "png", "webp", "gif"].includes(ext) || !file.type.startsWith("image/")) {
    return { error: "Only jpg, png, webp or gif images are allowed" }
  }

  await connectDB()
  const existing = await SystemConfig.findOne().lean()
  const previous = type === "logo" ? existing?.logoUrl : existing?.signatureUrl

  const result = await uploadR2Image(Buffer.from(await file.arrayBuffer()), "lff-lms/system", ext, file.type)

  const update =
    type === "logo"
      ? { logoUrl: result.url, logoPublicId: result.key }
      : { signatureUrl: result.url, signaturePublicId: result.key }

  await SystemConfig.findOneAndUpdate({}, update, { upsert: true, new: true })
  if (previous) await deleteR2Image(previous)

  revalidatePath("/admin/settings")
  return { success: true, url: result.url }
}
