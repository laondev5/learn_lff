/**
 * Client-side face / movement monitoring for proctored assessments.
 *
 * Uses MediaPipe Tasks Vision (`@mediapipe/tasks-vision`, Apache-2.0) running
 * entirely in the browser. No video frames ever leave the device — only the
 * derived numeric signals below are used, and only aggregate events reach the
 * server.
 *
 * The wasm runtime is loaded from a pinned CDN URL; the model itself is served
 * same-origin from `public/mediapipe/face_landmarker.task` so an exam does not
 * depend on a third party being reachable.
 */

const WASM_CDN = "https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision@0.10.14/wasm"
const MODEL_PATH = "/mediapipe/face_landmarker.task"

/** Landmark indices we rely on (478-point face mesh). */
const NOSE_TIP = 1
const EYE_OUTER_LEFT = 33
const EYE_OUTER_RIGHT = 263
const FOREHEAD = 10
const CHIN = 152

export interface FaceSample {
  /** Number of faces in frame. 0 means the student is not visible. */
  faceCount: number
  /** Normalised centroid of the primary face (0..1). */
  x: number
  y: number
  /** Horizontal head rotation proxy, roughly -1..1 (0 = facing camera). */
  yaw: number
  /** Vertical head tilt proxy, roughly -1..1 (0 = level). */
  pitch: number
  /** Centroid speed in normalised units per second. */
  speed: number
}

export type FaceMonitorStatus = "idle" | "loading" | "running" | "unavailable"

export interface FaceMonitor {
  /** Begin sampling. Resolves once the model is ready (or has failed). */
  start: () => Promise<boolean>
  stop: () => void
  getStatus: () => FaceMonitorStatus
}

interface Landmark {
  x: number
  y: number
  z: number
}

interface FaceLandmarkerLike {
  detectForVideo: (video: HTMLVideoElement, timestampMs: number) => {
    faceLandmarks: Landmark[][]
  }
  close: () => void
}

function centroid(points: Landmark[]): { x: number; y: number } {
  let sx = 0
  let sy = 0
  for (const p of points) {
    sx += p.x
    sy += p.y
  }
  return { x: sx / points.length, y: sy / points.length }
}

/**
 * Creates a monitor bound to a <video> element.
 *
 * @param getVideo Resolves the element to sample. Called each frame, so the
 *                 caller may swap between a preview and an in-exam thumbnail.
 * @param onSample Called at most ~10 times per second with the latest signal.
 */
export function createFaceMonitor(
  getVideo: () => HTMLVideoElement | null,
  onSample: (sample: FaceSample) => void
): FaceMonitor {
  let status: FaceMonitorStatus = "idle"
  let landmarker: FaceLandmarkerLike | null = null
  let rafId = 0
  let lastDetect = 0
  let prev: { x: number; y: number; t: number } | null = null

  const SAMPLE_INTERVAL_MS = 100

  const loop = () => {
    rafId = requestAnimationFrame(loop)
    if (!landmarker) return

    const now = performance.now()
    if (now - lastDetect < SAMPLE_INTERVAL_MS) return

    const video = getVideo()
    if (!video || video.readyState < 2 || video.videoWidth === 0) return
    lastDetect = now

    let result: { faceLandmarks: Landmark[][] }
    try {
      // detectForVideo requires strictly increasing timestamps.
      result = landmarker.detectForVideo(video, now)
    } catch {
      return
    }

    const faces = result.faceLandmarks ?? []
    if (faces.length === 0) {
      prev = null
      onSample({ faceCount: 0, x: 0.5, y: 0.5, yaw: 0, pitch: 0, speed: 0 })
      return
    }

    const primary = faces[0]
    const c = centroid(primary)

    let speed = 0
    if (prev) {
      const dt = (now - prev.t) / 1000
      if (dt > 0) {
        const dist = Math.hypot(c.x - prev.x, c.y - prev.y)
        // Clamp so a single re-detection jump cannot look like a sprint.
        speed = Math.min(dist / dt, 5)
      }
    }
    prev = { x: c.x, y: c.y, t: now }

    const eyeL = primary[EYE_OUTER_LEFT]
    const eyeR = primary[EYE_OUTER_RIGHT]
    const nose = primary[NOSE_TIP]
    const top = primary[FOREHEAD]
    const bottom = primary[CHIN]

    let yaw = 0
    let pitch = 0
    if (eyeL && eyeR && nose && top && bottom) {
      const eyeSpan = Math.abs(eyeR.x - eyeL.x) || 1e-6
      const midEyeX = (eyeL.x + eyeR.x) / 2
      yaw = (nose.x - midEyeX) / eyeSpan

      const faceHeight = Math.abs(bottom.y - top.y) || 1e-6
      const midY = (top.y + bottom.y) / 2
      pitch = (nose.y - midY) / faceHeight
    }

    onSample({
      faceCount: faces.length,
      x: c.x,
      y: c.y,
      yaw,
      pitch,
      speed,
    })
  }

  const start = async (): Promise<boolean> => {
    if (status === "running") return true
    status = "loading"

    try {
      const vision = await import("@mediapipe/tasks-vision")
      const fileset = await vision.FilesetResolver.forVisionTasks(WASM_CDN)

      // GPU first, then fall back to CPU on machines without WebGL2.
      for (const delegate of ["GPU", "CPU"] as const) {
        try {
          landmarker = (await vision.FaceLandmarker.createFromOptions(fileset, {
            baseOptions: { modelAssetPath: MODEL_PATH, delegate },
            runningMode: "VIDEO",
            numFaces: 3,
            minFaceDetectionConfidence: 0.5,
            minFacePresenceConfidence: 0.5,
            minTrackingConfidence: 0.5,
          })) as unknown as FaceLandmarkerLike
          break
        } catch {
          landmarker = null
        }
      }

      if (!landmarker) {
        status = "unavailable"
        return false
      }

      status = "running"
      rafId = requestAnimationFrame(loop)
      return true
    } catch {
      status = "unavailable"
      return false
    }
  }

  const stop = () => {
    if (rafId) cancelAnimationFrame(rafId)
    rafId = 0
    prev = null
    try {
      landmarker?.close()
    } catch {
      /* already torn down */
    }
    landmarker = null
    status = "idle"
  }

  return { start, stop, getStatus: () => status }
}
