import "server-only"
import { Types } from "mongoose"
import cloudinary from "@/lib/cloudinary"
import Course from "@/models/Course.model"
import Module from "@/models/Module.model"
import Lesson from "@/models/Lesson.model"
import Test from "@/models/Test.model"
import TestSubmission from "@/models/TestSubmission.model"
import Exam from "@/models/Exam.model"
import ExamSubmission from "@/models/ExamSubmission.model"
import StudentProgress from "@/models/StudentProgress.model"
import Certificate from "@/models/Certificate.model"
import CourseQuestion from "@/models/CourseQuestion.model"
import CourseSettings from "@/models/CourseSettings.model"
import Assessment from "@/models/Assessment.model"
import Submission from "@/models/Submission.model"
import ProctoringSession from "@/models/ProctoringSession.model"
import PaymentTransaction from "@/models/PaymentTransaction.model"
import Announcement from "@/models/Announcement.model"
import LiveClass from "@/models/LiveClass.model"

type ResourceType = "image" | "video" | "raw"

export interface CloudinaryAsset {
  publicId: string
  resourceType: ResourceType
}

/**
 * Parses a Cloudinary delivery URL into its public id and resource type.
 * Returns null for anything that is not an upload in *our* Cloudinary account
 * (YouTube links, other clouds, arbitrary URLs), so we never try to delete those.
 *
 *   https://res.cloudinary.com/<cloud>/video/upload/v1712/lff-lms/videos/abc.mp4
 *   -> { publicId: "lff-lms/videos/abc", resourceType: "video" }
 */
export function parseCloudinaryUrl(url: string | null | undefined): CloudinaryAsset | null {
  if (!url) return null
  try {
    const parsed = new URL(url)
    if (parsed.hostname !== "res.cloudinary.com") return null

    const [cloud, resourceType, deliveryType, ...rest] = parsed.pathname.split("/").filter(Boolean)
    if (cloud !== process.env.CLOUDINARY_CLOUD_NAME) return null
    if (resourceType !== "image" && resourceType !== "video" && resourceType !== "raw") return null
    if (deliveryType !== "upload") return null

    // Skip transformation segments (e.g. "c_limit,w_1280,q_auto") and the version ("v1712…")
    let i = 0
    const versionIdx = rest.findIndex((p) => /^v\d+$/.test(p))
    if (versionIdx !== -1) i = versionIdx + 1
    else while (i < rest.length - 1 && (rest[i].includes(",") || /^[a-z]{1,3}_[^/]+$/.test(rest[i]))) i++

    const parts = rest.slice(i).map(decodeURIComponent)
    if (parts.length === 0) return null
    // Raw files keep their extension as part of the public id; images/videos don't
    if (resourceType !== "raw") parts[parts.length - 1] = parts[parts.length - 1].replace(/\.[^/.]+$/, "")

    return { publicId: parts.join("/"), resourceType }
  } catch {
    return null
  }
}

/** True if any course cover or lesson video in the database still points at this URL. */
async function isStillReferenced(url: string) {
  const [lesson, course] = await Promise.all([
    Lesson.exists({ videoUrl: url }),
    Course.exists({ coverImageUrl: url }),
  ])
  return !!lesson || !!course
}

export interface MediaCleanupResult {
  deleted: string[]
  skipped: string[]
  failed: string[]
}

/**
 * Deletes Cloudinary files for the given URLs. Call this *after* removing the
 * database records: any URL that is still referenced elsewhere (e.g. the same
 * video pasted into two lessons) is kept. Never throws, so a Cloudinary outage
 * can't block a course/module/lesson from being deleted.
 */
export async function destroyCloudinaryMedia(urls: (string | null | undefined)[]): Promise<MediaCleanupResult> {
  const result: MediaCleanupResult = { deleted: [], skipped: [], failed: [] }
  const unique = [...new Set(urls.filter((u): u is string => !!u))]

  await Promise.all(
    unique.map(async (url) => {
      const asset = parseCloudinaryUrl(url)
      if (!asset) {
        result.skipped.push(url) // not one of our uploads (YouTube, external link, …)
        return
      }
      try {
        if (await isStillReferenced(url)) {
          result.skipped.push(url)
          return
        }
        const res = await cloudinary.uploader.destroy(asset.publicId, {
          resource_type: asset.resourceType,
          invalidate: true, // also purge CDN copies and derived (compressed) versions
        })
        // "not found" means it was already gone, which is the outcome we want
        if (res?.result === "ok" || res?.result === "not found") result.deleted.push(url)
        else result.failed.push(url)
      } catch (err) {
        console.error("[media-cleanup] Failed to delete", asset.publicId, err)
        result.failed.push(url)
      }
    })
  )

  if (result.failed.length) {
    console.error(`[media-cleanup] ${result.failed.length} Cloudinary file(s) could not be deleted`, result.failed)
  }
  return result
}

/** Deletes Cloudinary files stored by public id (e.g. certificates). */
async function destroyByPublicIds(publicIds: string[], resourceType: ResourceType) {
  await Promise.allSettled(
    publicIds.map((id) => cloudinary.uploader.destroy(id, { resource_type: resourceType, invalidate: true }))
  )
}

/**
 * Removes a lesson set completely: tests and test attempts, progress references,
 * the lessons themselves, then their videos on Cloudinary.
 */
export async function deleteLessonsCascade(lessonIds: Types.ObjectId[], courseId: Types.ObjectId) {
  if (lessonIds.length === 0) return { media: { deleted: [], skipped: [], failed: [] } as MediaCleanupResult }

  const [lessons, tests] = await Promise.all([
    Lesson.find({ _id: { $in: lessonIds } }).select("videoUrl").lean(),
    Test.find({ lesson: { $in: lessonIds } }).select("_id").lean(),
  ])
  const testIds = tests.map((t) => t._id)

  await Promise.all([
    TestSubmission.deleteMany({ test: { $in: testIds } }),
    Test.deleteMany({ _id: { $in: testIds } }),
    StudentProgress.updateMany(
      { course: courseId },
      { $pull: { completedLessons: { $in: lessonIds }, completedTests: { $in: testIds } } }
    ),
    Lesson.deleteMany({ _id: { $in: lessonIds } }),
  ])

  const media = await destroyCloudinaryMedia(lessons.map((l) => l.videoUrl))
  return { media }
}

/**
 * Removes courses and everything that belongs to them, then their media on
 * Cloudinary (cover images, lesson videos, certificate files).
 */
export async function deleteCoursesCascade(courseIds: Types.ObjectId[]) {
  if (courseIds.length === 0) return { media: { deleted: [], skipped: [], failed: [] } as MediaCleanupResult }

  // Collect media before the records that point at it are gone
  const [courses, lessons, certificates] = await Promise.all([
    Course.find({ _id: { $in: courseIds } }).select("coverImageUrl").lean(),
    Lesson.find({ course: { $in: courseIds } }).select("videoUrl").lean(),
    Certificate.find({ course: { $in: courseIds }, cloudinaryPublicId: { $exists: true } }).select("cloudinaryPublicId").lean(),
  ])

  await Promise.all([
    Announcement.deleteMany({ course: { $in: courseIds } }),
    LiveClass.deleteMany({ course: { $in: courseIds } }),
    CourseQuestion.deleteMany({ course: { $in: courseIds } }),
    CourseSettings.deleteMany({ course: { $in: courseIds } }),
    Assessment.deleteMany({ course: { $in: courseIds } }),
    Submission.deleteMany({ course: { $in: courseIds } }),
    ProctoringSession.deleteMany({ course: { $in: courseIds } }),
    TestSubmission.deleteMany({ course: { $in: courseIds } }),
    ExamSubmission.deleteMany({ course: { $in: courseIds } }),
    StudentProgress.deleteMany({ course: { $in: courseIds } }),
    Certificate.deleteMany({ course: { $in: courseIds } }),
    PaymentTransaction.deleteMany({ course: { $in: courseIds } }),
    Test.deleteMany({ course: { $in: courseIds } }),
    Exam.deleteMany({ course: { $in: courseIds } }),
    Lesson.deleteMany({ course: { $in: courseIds } }),
    Module.deleteMany({ course: { $in: courseIds } }),
    Course.deleteMany({ _id: { $in: courseIds } }),
  ])

  // Certificate files may have been stored as image (PDF) or raw uploads; try both
  const certificateIds = certificates.map((c) => c.cloudinaryPublicId).filter((id): id is string => !!id)
  const [media] = await Promise.all([
    destroyCloudinaryMedia([
      ...courses.map((c) => c.coverImageUrl),
      ...lessons.map((l) => l.videoUrl),
    ]),
    destroyByPublicIds(certificateIds, "image"),
    destroyByPublicIds(certificateIds, "raw"),
  ])
  return { media }
}
