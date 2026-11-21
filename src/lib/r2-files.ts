import "server-only"
import { randomUUID } from "node:crypto"
import { PutObjectCommand, GetObjectCommand, DeleteObjectCommand } from "@aws-sdk/client-s3"
import { getR2Client } from "./r2"

/** Object key prefix for non-video assets (covers, avatars, certificate logos, signatures). */
const IMAGE_PREFIX = "images/"

function bucket() {
  const name = process.env.R2_BUCKET_NAME
  if (!name) throw new Error("R2 is not configured")
  return name
}

const SAFE_FOLDER = /^[a-z0-9][a-z0-9/_-]{0,80}$/

/** Public, stable URL served by /api/files, so the private bucket can back <img> tags. */
export function r2ImageUrl(key: string) {
  return `/api/files/${key.split("/").map(encodeURIComponent).join("/")}`
}

export function parseR2ImageUrl(url: string | null | undefined): string | null {
  if (!url || !url.startsWith("/api/files/")) return null
  const key = url.slice("/api/files/".length).split("/").map(decodeURIComponent).join("/")
  if (!key.startsWith(IMAGE_PREFIX)) return null
  if (key.split("/").some((part) => !part || part === "." || part === "..")) return null
  return key
}

export async function uploadR2Image(buffer: Buffer, folder: string, extension: string, contentType: string) {
  if (!SAFE_FOLDER.test(folder)) throw new Error("Upload destination not allowed")
  if (!/^[a-z0-9]{2,5}$/.test(extension)) throw new Error("Unsupported file extension")
  const key = `${IMAGE_PREFIX}${folder.replace(/^\/+|\/+$/g, "")}/${randomUUID()}.${extension}`
  await getR2Client().send(new PutObjectCommand({
    Bucket: bucket(),
    Key: key,
    Body: buffer,
    ContentType: contentType,
    CacheControl: "public, max-age=31536000, immutable",
  }))
  return { key, url: r2ImageUrl(key) }
}

export async function readR2Image(key: string) {
  if (!key.startsWith(IMAGE_PREFIX)) return null
  const result = await getR2Client().send(new GetObjectCommand({ Bucket: bucket(), Key: key }))
  if (!result.Body) return null
  const bytes = await result.Body.transformToByteArray()
  return {
    bytes,
    contentType: result.ContentType ?? "application/octet-stream",
    cacheControl: result.CacheControl ?? "public, max-age=31536000, immutable",
  }
}

export async function deleteR2Image(url: string) {
  const key = parseR2ImageUrl(url)
  if (!key) return false
  try {
    await getR2Client().send(new DeleteObjectCommand({ Bucket: bucket(), Key: key }))
    return true
  } catch {
    return false
  }
}
