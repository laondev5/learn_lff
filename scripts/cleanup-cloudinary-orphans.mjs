/**
 * Finds course videos and cover images in Cloudinary that no lesson or course
 * uses any more (left behind by deletions before automatic cleanup existed,
 * or by uploads whose save never finished) and optionally deletes them.
 *
 *   npm run cloudinary:orphans            # dry run: only lists what would be deleted
 *   npm run cloudinary:orphans -- --delete
 *
 * Safety:
 *  - Only looks in the lff-lms/videos and lff-lms/covers folders (never KYC, avatars, system images)
 *  - Skips anything uploaded in the last 24 hours (an upload may still be about to be saved)
 *  - Anything referenced by a lesson video or course cover is kept
 */
import nextEnv from "@next/env"
import mongoose from "mongoose"
import { v2 as cloudinary } from "cloudinary"

nextEnv.loadEnvConfig(process.cwd())

const DELETE = process.argv.includes("--delete")
const GRACE_MS = 24 * 60 * 60 * 1000
const TARGETS = [
  { prefix: "lff-lms/videos/", resourceType: "video" },
  { prefix: "lff-lms/covers/", resourceType: "image" },
]

const { CLOUDINARY_CLOUD_NAME, CLOUDINARY_API_KEY, CLOUDINARY_API_SECRET, MONGODB_URI } = process.env
if (!CLOUDINARY_CLOUD_NAME || !CLOUDINARY_API_KEY || !CLOUDINARY_API_SECRET || !MONGODB_URI) {
  console.error("Missing CLOUDINARY_* or MONGODB_URI environment variables (.env.local).")
  process.exit(1)
}
cloudinary.config({ cloud_name: CLOUDINARY_CLOUD_NAME, api_key: CLOUDINARY_API_KEY, api_secret: CLOUDINARY_API_SECRET })

/** Same rules as parseCloudinaryUrl in src/lib/media-cleanup.ts */
function parseCloudinaryUrl(url) {
  if (!url) return null
  try {
    const parsed = new URL(url)
    if (parsed.hostname !== "res.cloudinary.com") return null
    const [cloud, resourceType, deliveryType, ...rest] = parsed.pathname.split("/").filter(Boolean)
    if (cloud !== CLOUDINARY_CLOUD_NAME || deliveryType !== "upload") return null
    let i = 0
    const versionIdx = rest.findIndex((p) => /^v\d+$/.test(p))
    if (versionIdx !== -1) i = versionIdx + 1
    else while (i < rest.length - 1 && (rest[i].includes(",") || /^[a-z]{1,3}_[^/]+$/.test(rest[i]))) i++
    const parts = rest.slice(i).map(decodeURIComponent)
    if (parts.length === 0) return null
    if (resourceType !== "raw") parts[parts.length - 1] = parts[parts.length - 1].replace(/\.[^/.]+$/, "")
    return `${resourceType}:${parts.join("/")}`
  } catch {
    return null
  }
}

async function listResources(prefix, resourceType) {
  const all = []
  let next_cursor
  do {
    const res = await cloudinary.api.resources({ type: "upload", resource_type: resourceType, prefix, max_results: 500, next_cursor })
    all.push(...res.resources)
    next_cursor = res.next_cursor
  } while (next_cursor)
  return all
}

async function main() {
  await mongoose.connect(MONGODB_URI)
  const db = mongoose.connection.db

  const [videoUrls, coverUrls] = await Promise.all([
    db.collection("lessons").distinct("videoUrl", { videoUrl: { $type: "string" } }),
    db.collection("courses").distinct("coverImageUrl", { coverImageUrl: { $type: "string" } }),
  ])
  const referenced = new Set([...videoUrls, ...coverUrls].map(parseCloudinaryUrl).filter(Boolean))
  console.log(`Database references ${referenced.size} Cloudinary file(s).`)

  let totalOrphans = 0
  let totalBytes = 0

  for (const { prefix, resourceType } of TARGETS) {
    const resources = await listResources(prefix, resourceType)
    const cutoff = Date.now() - GRACE_MS
    const orphans = resources.filter(
      (r) => !referenced.has(`${resourceType}:${r.public_id}`) && Date.parse(r.created_at) < cutoff
    )
    const bytes = orphans.reduce((n, r) => n + (r.bytes ?? 0), 0)
    totalOrphans += orphans.length
    totalBytes += bytes

    console.log(`\n${prefix} (${resourceType}): ${resources.length} file(s), ${orphans.length} unused (${(bytes / 1024 / 1024).toFixed(1)} MB)`)
    for (const r of orphans) console.log(`  - ${r.public_id}  ${(r.bytes / 1024 / 1024).toFixed(1)} MB  uploaded ${r.created_at}`)

    if (DELETE && orphans.length) {
      for (let i = 0; i < orphans.length; i += 100) {
        const batch = orphans.slice(i, i + 100).map((r) => r.public_id)
        const res = await cloudinary.api.delete_resources(batch, { resource_type: resourceType, invalidate: true })
        const failed = Object.entries(res.deleted ?? {}).filter(([, status]) => status !== "deleted" && status !== "not_found")
        console.log(`  Deleted batch of ${batch.length}${failed.length ? `, ${failed.length} failed: ${failed.map(([id]) => id).join(", ")}` : ""}`)
      }
    }
  }

  console.log(`\nTotal unused: ${totalOrphans} file(s), ${(totalBytes / 1024 / 1024).toFixed(1)} MB.`)
  if (!DELETE && totalOrphans) console.log("Dry run only. Re-run with --delete to remove them.")
  await mongoose.disconnect()
}

main().catch(async (err) => {
  console.error(err)
  await mongoose.disconnect().catch(() => {})
  process.exit(1)
})
