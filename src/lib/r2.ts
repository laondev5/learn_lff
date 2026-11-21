import "server-only"
import { createHmac, randomUUID, timingSafeEqual } from "node:crypto"
import { S3Client, GetObjectCommand, DeleteObjectCommand, CreateMultipartUploadCommand, UploadPartCommand, ListPartsCommand, CompleteMultipartUploadCommand, AbortMultipartUploadCommand, HeadObjectCommand } from "@aws-sdk/client-s3"
import { getSignedUrl } from "@aws-sdk/s3-request-presigner"

export const R2_PART_SIZE = 8 * 1024 * 1024
export const R2_MAX_SIZE = 500 * 1024 * 1024
function config() {
  const { R2_ACCOUNT_ID: account, R2_BUCKET_NAME: bucket, R2_ACCESS_KEY_ID: accessKeyId, R2_SECRET_ACCESS_KEY: secretAccessKey } = process.env
  if (!account || !/^[a-f0-9]{32}$/.test(account) || !bucket || !/^[a-z0-9][a-z0-9.-]+$/.test(bucket) || !accessKeyId || !secretAccessKey) throw new Error("R2 is not configured")
  return { bucket, endpoint: `https://${account}.r2.cloudflarestorage.com`, accessKeyId, secretAccessKey }
}
export function getR2Client() {
  const c = config()
  return new S3Client({ region: "auto", endpoint: c.endpoint, forcePathStyle: true, credentials: { accessKeyId: c.accessKeyId, secretAccessKey: c.secretAccessKey }, requestChecksumCalculation: "WHEN_REQUIRED", responseChecksumValidation: "WHEN_REQUIRED" })
}
export function r2VideoUrl(key: string) {
  const c = config()
  return `${c.endpoint}/${c.bucket}/${key.split("/").map(encodeURIComponent).join("/")}`
}
/** Accept only canonical, unsigned URLs in this account and bucket. */
export function parseR2Url(value: string | null | undefined): string | null {
  if (!value) return null
  try {
    const c = config(), u = new URL(value)
    if (u.origin !== c.endpoint || u.username || u.password || u.search || u.hash) return null
    const prefix = `/${c.bucket}/`
    if (!u.pathname.startsWith(prefix)) return null
    const key = decodeURIComponent(u.pathname.slice(prefix.length))
    if (!key || key.split("/").some(p => !p || p === "." || p === "..") || /[\\\x00-\x1f\x7f]/.test(key)) return null
    return r2VideoUrl(key) === value ? key : null
  } catch { return null }
}
export async function getR2PlaybackUrl(url: string, expiresInSeconds = 3600): Promise<string> {
  const asset = parseR2Url(url)
  if (!asset) throw new Error("Invalid R2 video URL")
  if (!Number.isFinite(expiresInSeconds) || expiresInSeconds < 1) throw new Error("Playback access has expired")
  return getSignedUrl(getR2Client(), new GetObjectCommand({ Bucket: config().bucket, Key: asset }), { expiresIn: Math.min(86400, Math.floor(expiresInSeconds)) })
}
export async function deleteR2Video(url: string) {
  const asset = parseR2Url(url)
  if (!asset) throw new Error("Invalid R2 video URL")
  await getR2Client().send(new DeleteObjectCommand({ Bucket: config().bucket, Key: asset }))
}
type Upload = { teacher: string; key: string; uploadId: string; size: number; expires: number }
function mac(payload: string) {
  const secret = process.env.AUTH_SECRET || process.env.NEXTAUTH_SECRET
  if (!secret) throw new Error("Upload signing secret missing")
  return createHmac("sha256", secret).update(`r2-upload-v1:${payload}`).digest()
}
export function validateUploadToken(token: unknown, teacher: string): Upload {
  if (typeof token !== "string" || token.length > 8192) throw new Error("Invalid upload token")
  const [payload, signature, extra] = token.split(".")
  if (!payload || !signature || extra) throw new Error("Invalid upload token")
  const expected = mac(payload), actual = Buffer.from(signature, "base64url")
  if (actual.length !== expected.length || !timingSafeEqual(actual, expected)) throw new Error("Invalid upload token")
  const data = JSON.parse(Buffer.from(payload, "base64url").toString()) as Upload
  if (data.teacher !== teacher || data.expires < Date.now() || !data.key.startsWith(`teachers/${teacher}/videos/`) || !data.uploadId || !Number.isSafeInteger(data.size) || data.size <= 0 || data.size > R2_MAX_SIZE) throw new Error("Invalid or expired upload token")
  return data
}
export async function startR2Upload(teacher: string, size: number, contentType: string) {
  if (!/^[a-zA-Z0-9_-]+$/.test(teacher) || !Number.isSafeInteger(size) || size <= 0 || size > R2_MAX_SIZE || !/^video\/[a-zA-Z0-9.+-]+$/.test(contentType)) throw new Error("Invalid video (maximum 500 MB)")
  // Validate signing configuration before allocating an upload.
  mac("check")
  const key = `teachers/${teacher}/videos/${randomUUID()}`
  const result = await getR2Client().send(new CreateMultipartUploadCommand({ Bucket: config().bucket, Key: key, ContentType: contentType, CacheControl: "private, no-store" }))
  if (!result.UploadId) throw new Error("Could not start upload")
  const data: Upload = { teacher, key, uploadId: result.UploadId, size, expires: Date.now() + 24 * 3600_000 }
  const payload = Buffer.from(JSON.stringify(data)).toString("base64url")
  return { token: `${payload}.${mac(payload).toString("base64url")}`, partSize: R2_PART_SIZE }
}
export async function signR2Part(data: Upload, part: number) {
  if (!Number.isInteger(part) || part < 1 || part > Math.ceil(data.size / R2_PART_SIZE)) throw new Error("Invalid part number")
  return getSignedUrl(getR2Client(), new UploadPartCommand({ Bucket: config().bucket, Key: data.key, UploadId: data.uploadId, PartNumber: part, ContentLength: Math.min(R2_PART_SIZE, data.size - (part - 1) * R2_PART_SIZE) }), { expiresIn: 3600 })
}
export async function abortR2Upload(data: Upload) {
  try { await getR2Client().send(new AbortMultipartUploadCommand({ Bucket: config().bucket, Key: data.key, UploadId: data.uploadId })) }
  catch (e) { if ((e as { name?: string }).name !== "NoSuchUpload") throw e }
}
export async function completeR2Upload(data: Upload) {
  const client = getR2Client(), input = { Bucket: config().bucket, Key: data.key }
  // Server-listed parts prevent clients supplying arbitrary completion manifests.
  let listed
  try { listed = await client.send(new ListPartsCommand({ ...input, UploadId: data.uploadId })) }
  catch (e) {
    if ((e as { name?: string }).name !== "NoSuchUpload") throw e
    const head = await client.send(new HeadObjectCommand(input))
    if (head.ContentLength !== data.size) throw new Error("Completed object size mismatch")
    return r2VideoUrl(data.key)
  }
  const parts = listed.Parts ?? []
  if (listed.IsTruncated || parts.length !== Math.ceil(data.size / R2_PART_SIZE) || parts.some((p, i) => p.PartNumber !== i + 1 || !p.ETag || p.Size !== Math.min(R2_PART_SIZE, data.size - i * R2_PART_SIZE))) throw new Error("Upload parts are incomplete or have incorrect sizes")
  await client.send(new CompleteMultipartUploadCommand({ ...input, UploadId: data.uploadId, MultipartUpload: { Parts: parts.map(p => ({ PartNumber: p.PartNumber, ETag: p.ETag })) } }))
  const head = await client.send(new HeadObjectCommand(input))
  if (head.ContentLength !== data.size) throw new Error("Completed object size mismatch")
  return r2VideoUrl(data.key)
}
