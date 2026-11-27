"use client"

import { useState, useEffect, useRef, useCallback, useMemo, type ReactNode, type MutableRefObject } from "react"
import Link from "next/link"
import { useRouter } from "next/navigation"
import { toast } from "sonner"
import {
  ChevronRight, ChevronLeft, Loader2, Clock,
  AlertTriangle, Mic, MicOff, Maximize,
  ShieldCheck, ShieldAlert, Video, VideoOff,
  Info, Camera, PlayCircle, CheckCircle2, Circle,
  Volume2, VolumeX, ScanFace, RefreshCw,
} from "lucide-react"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Progress } from "@/components/ui/progress"
import { Badge } from "@/components/ui/badge"
import {
  createFaceMonitor,
  type FaceMonitor,
  type FaceMonitorStatus,
} from "@/lib/proctoring/vision"

interface Question {
  _id: string
  text: string
  type: "mcq" | "true_false" | "short_answer" | "fill_blank"
  options?: string[]
  points: number
  section?: string
}

interface ExamData {
  title: string
  type: string
  durationMinutes: number
  totalMarks: number
  proctoringEnabled: boolean
  questions: Question[]
}

interface Step {
  key: string
  label: string
  questions: Question[]
}

/** Groups consecutive questions that share a `section` into one wizard step. */
function buildSteps(questions: Question[]): Step[] {
  const steps: Step[] = []
  for (const q of questions) {
    const label = q.section?.trim() || "Questions"
    const last = steps[steps.length - 1]
    if (last && last.label === label) last.questions.push(q)
    else steps.push({ key: `${steps.length}-${label}`, label, questions: [q] })
  }
  return steps
}

/** True when more than one display is attached. Falls back to false when unsupported. */
function hasExtendedDisplay(): boolean {
  if (typeof window === "undefined") return false
  const screen = window.screen as Screen & { isExtended?: boolean }
  if (typeof screen.isExtended === "boolean") return screen.isExtended
  // Older browsers: no reliable API. Don't block the student on a guess.
  return false
}

/** Renders a fill-in-the-blank question with an answer box for the missing word(s). */
function FillInBlank({
  text,
  value,
  onChange,
}: {
  text: string
  value: string
  onChange: (value: string) => void
}) {
  const parts = text.split(/_+/)
  const blankCount = parts.length - 1
  return (
    <div className="space-y-3">
      <p className="text-sm leading-relaxed">
        {parts.map((part, i) => (
          <span key={i}>
            {part}
            {i < blankCount && (
              <span className="mx-1 inline-block min-w-[90px] border-b-2 border-primary/60 bg-primary/5 px-2 text-center font-semibold text-primary">
                &nbsp;{blankCount > 1 ? `(${i + 1})` : "?"}&nbsp;
              </span>
            )}
          </span>
        ))}
      </p>
      <input
        className="w-full border-2 rounded-lg p-3 text-sm bg-background focus:border-primary focus:ring-0 outline-none transition-all"
        placeholder={blankCount > 1 ? "Enter the answers in order, separated by commas" : "Type the missing word..."}
        value={value}
        onChange={(e) => onChange(e.target.value)}
      />
    </div>
  )
}

interface SessionData {
  _id: string
  status: string
  warnings: number
  maxWarnings: number
  startTime: string
  answersSnapshot?: Record<string, string>
}

interface PreExamInfo {
  title: string
  type: string
  durationMinutes: number
  totalMarks: number
  proctoringEnabled: boolean
  maxWarnings: number
  maxAttempts: number
  attemptsLeft: number
}

/** Proctoring thresholds — deliberately conservative to avoid false positives. */
const PROCTOR = {
  /** 0..100 display scale for microphone RMS. */
  QUIET_MAX: 16,
  TALKING_LEVEL: 23,
  /** Sustained durations before a warning is raised. */
  TALKING_MS: 1600,
  MOVEMENT_MS: 2500,
  FACE_GONE_MS: 6000,
  EXTRA_FACE_MS: 3000,
  /** Cooldowns so one incident cannot consume all warnings. */
  TALKING_COOLDOWN: 20000,
  MOVEMENT_COOLDOWN: 25000,
  FACE_COOLDOWN: 30000,
  EXTRA_FACE_COOLDOWN: 30000,
  /** Normalised centroid speed / head-turn proxy. */
  MOVE_SPEED: 0.35,
  YAW_LIMIT: 0.45,
  SAMPLE_MS: 100,
}

type Accumulator = { ms: number; last: number }

function accumulate(ref: MutableRefObject<Accumulator>, now: number, active: boolean) {
  if (active) {
    if (ref.current.last) ref.current.ms += Math.min(now - ref.current.last, 250)
  } else {
    ref.current.ms = 0
  }
  ref.current.last = now
}

function resetAccumulator(ref: MutableRefObject<Accumulator>) {
  ref.current = { ms: 0, last: 0 }
}

/** Convert time-domain samples into a stable 0..100 loudness reading. */
function rmsLevel(analyser: AnalyserNode, buffer: Uint8Array<ArrayBuffer>): number {
  analyser.getByteTimeDomainData(buffer)
  let sum = 0
  for (let i = 0; i < buffer.length; i++) {
    const v = (buffer[i] - 128) / 128
    sum += v * v
  }
  const rms = Math.sqrt(sum / buffer.length)
  return Math.min(100, Math.round(rms * 400))
}

export function ExamTakerClient({
  assessmentId,
  courseId,
  kind = "exam",
}: {
  assessmentId: string
  courseId: string
  kind?: "exam" | "module-test"
}) {
  const router = useRouter()
  const isFinalExam = kind !== "module-test"

  // State
  const [loading, setLoading] = useState(true)
  const [hasStarted, setHasStarted] = useState(false)
  const [preExamInfo, setPreExamInfo] = useState<PreExamInfo | null>(null)
  const [permissionDenied, setPermissionDenied] = useState(false)

  const [session, setSession] = useState<SessionData | null>(null)
  const [exam, setExam] = useState<ExamData | null>(null)
  const [answers, setAnswers] = useState<Record<string, string>>({})
  const [submitting, setSubmitting] = useState(false)
  const [result, setResult] = useState<{ score: number; passed: boolean; percentageScore: number } | null>(null)
  const [secondsLeft, setSecondsLeft] = useState<number | null>(null)
  const [currentStep, setCurrentStep] = useState(0)
  const [proctoringState, setProctoringState] = useState({
    micActive: false,
    camActive: false,
    fullscreen: false,
    tabActive: true,
  })

  // Pre-flight checks
  const [multiScreen, setMultiScreen] = useState(false)
  const [mediaRequesting, setMediaRequesting] = useState(false)
  const [mediaVersion, setMediaVersion] = useState(0)
  const [noiseLevel, setNoiseLevel] = useState(0)
  const [roomQuiet, setRoomQuiet] = useState<boolean | null>(null)
  const [visionStatus, setVisionStatus] = useState<FaceMonitorStatus>("idle")
  const [faceVisible, setFaceVisible] = useState(false)
  const [faceCount, setFaceCount] = useState(0)

  // Refs
  const micStreamRef = useRef<MediaStream | null>(null)
  const videoRef = useRef<HTMLVideoElement>(null)
  const previewRef = useRef<HTMLVideoElement>(null)
  const audioContextRef = useRef<AudioContext | null>(null)
  const monitorRef = useRef<FaceMonitor | null>(null)
  const autoSubmitRef = useRef(false)
  const hadFullscreenRef = useRef(false)
  const answersRef = useRef(answers)
  const startedRef = useRef(false)
  const stateRef = useRef(proctoringState)
  const reportRef = useRef<(type: string, details: string) => Promise<void>>(async () => {})
  const submitRef = useRef<() => Promise<void>>(async () => {})

  const lastMeterPaintRef = useRef(0)
  const calibrationRef = useRef<number[]>([])
  const warnTimesRef = useRef<Record<string, number>>({})
  const moveAccumRef = useRef<Accumulator>({ ms: 0, last: 0 })
  const noiseAccumRef = useRef<Accumulator>({ ms: 0, last: 0 })
  const faceGoneAccumRef = useRef<Accumulator>({ ms: 0, last: 0 })
  const extraFaceAccumRef = useRef<Accumulator>({ ms: 0, last: 0 })

  const steps = useMemo(() => (exam ? buildSteps(exam.questions) : []), [exam])
  const activeStep = steps[currentStep] ?? null
  const isLastStep = steps.length > 0 && currentStep >= steps.length - 1

  useEffect(() => { answersRef.current = answers }, [answers])
  useEffect(() => { stateRef.current = proctoringState }, [proctoringState])
  useEffect(() => { startedRef.current = hasStarted }, [hasStarted])

  const maxWarnings = session?.maxWarnings ?? preExamInfo?.maxWarnings ?? 3
  const usedWarnings = session?.warnings ?? 0

  /* ── Session bootstrap ─────────────────────────────────────────────── */

  const initSession = useCallback(async () => {
    setLoading(true)
    try {
      const res = await fetch(`/api/assessments/${assessmentId}/session`, { method: "POST" })
      const data = await res.json()

      if (res.ok) {
        setSession(data.session)
        setExam(data.assessment)
        setAnswers(data.session.answersSnapshot || {})

        const start = new Date(data.session.startTime).getTime()
        const duration = data.assessment.durationMinutes * 60 * 1000
        const remaining = Math.max(0, Math.floor((start + duration - Date.now()) / 1000))
        setSecondsLeft(remaining)

        if (data.session.status === "terminated") {
          toast.error("This session was terminated due to violations.")
          router.push(`/student/courses/${courseId}`)
        }
      } else {
        toast.error(data.error || "Failed to start session")
        router.push(`/student/courses/${courseId}`)
      }
    } catch {
      toast.error("Network error. Please try again.")
    } finally {
      setLoading(false)
    }
  }, [assessmentId, courseId, router])

  const checkSession = useCallback(async () => {
    try {
      const res = await fetch(`/api/assessments/${assessmentId}/session`)
      const data = await res.json()

      if (res.ok) {
        if (data.hasActiveSession) {
          setHasStarted(true)
          await initSession()
        } else {
          setPreExamInfo(data.assessmentInfo)
          setLoading(false)
        }
      } else {
        toast.error(data.error || "Failed to load assessment")
        router.push(`/student/courses/${courseId}`)
      }
    } catch {
      toast.error("Network error. Please try again.")
      router.push(`/student/courses/${courseId}`)
    }
  }, [assessmentId, courseId, router, initSession])

  useEffect(() => { checkSession() }, [checkSession])

  /* ── Shared teardown ────────────────────────────────────────────────── */

  const releaseProctoring = useCallback(() => {
    monitorRef.current?.stop()
    monitorRef.current = null
    micStreamRef.current?.getTracks().forEach((t) => t.stop())
    micStreamRef.current = null
    try { audioContextRef.current?.close() } catch { /* already closed */ }
    audioContextRef.current = null
    if (document.fullscreenElement) document.exitFullscreen().catch(() => {})
  }, [])

  /* ── Violations ─────────────────────────────────────────────────────── */

  const reportViolation = useCallback(async (type: string, details: string) => {
    if (result || autoSubmitRef.current || !startedRef.current) return
    const st = stateRef.current
    try {
      const res = await fetch(`/api/assessments/${assessmentId}/session/heartbeat`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          microphoneActive: st.micActive,
          fullscreenActive: st.fullscreen,
          tabHidden: !st.tabActive,
          violation: type,
          details,
        }),
      })
      if (!res.ok) return
      const data = await res.json()

      if (typeof data.warnings === "number") {
        setSession((prev) => (prev ? { ...prev, warnings: data.warnings } : prev))
      }

      // The server owns the cap. Stop immediately when it terminates the session.
      if (data.status === "terminated" && data.result) {
        autoSubmitRef.current = true
        setResult({
          score: data.result.score,
          passed: data.result.passed,
          percentageScore: data.result.percentageScore,
        })
        releaseProctoring()
        toast.error("Warning limit reached. Your exam was submitted automatically.")
      }
    } catch {
      console.error("Failed to report violation")
    }
  }, [assessmentId, result, releaseProctoring])

  useEffect(() => { reportRef.current = reportViolation }, [reportViolation])

  const raiseWarning = useCallback((key: string, type: string, details: string, message: string) => {
    const now = performance.now()
    const cooldown = key === "noise" ? PROCTOR.TALKING_COOLDOWN
      : key === "movement" ? PROCTOR.MOVEMENT_COOLDOWN
      : key === "face" ? PROCTOR.FACE_COOLDOWN
      : PROCTOR.EXTRA_FACE_COOLDOWN
    if (now - (warnTimesRef.current[key] ?? -Infinity) < cooldown) return
    warnTimesRef.current[key] = now
    reportRef.current(type, details)
    toast.warning(message)
  }, [])

  /* ── Submit ─────────────────────────────────────────────────────────── */

  const handleSubmit = useCallback(async (isAuto = false, reason?: string) => {
    if (submitting || result) return
    setSubmitting(true)
    autoSubmitRef.current = true

    try {
      const res = await fetch(`/api/assessments/${assessmentId}/submit`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          answers: Object.entries(answersRef.current).map(([qId, ans]) => ({ questionId: qId, answer: ans })),
          isAutoSubmit: isAuto,
          reason: reason || (isAuto ? "Time limit exceeded" : "User manual submission"),
        }),
      })
      const data = await res.json()

      if (res.ok) {
        setResult({
          score: data.submission.score,
          passed: data.submission.passed,
          percentageScore: data.submission.percentageScore,
        })
        setCurrentStep(steps.length)
        if (data.submission.passed) toast.success("Assessment submitted successfully!")
        else toast.error("Assessment submitted. You did not pass.")
      } else {
        toast.error(data.error || "Submission failed")
        autoSubmitRef.current = false
      }
    } catch {
      toast.error("Network error during submission")
      autoSubmitRef.current = false
    } finally {
      setSubmitting(false)
      releaseProctoring()
    }
  }, [assessmentId, submitting, result, steps.length, releaseProctoring])

  useEffect(() => { submitRef.current = handleSubmit }, [handleSubmit])

  /* ── Media (camera + microphone) ────────────────────────────────────── */

  const bindStream = useCallback((stream: MediaStream) => {
    if (videoRef.current) videoRef.current.srcObject = stream
    if (previewRef.current) previewRef.current.srcObject = stream
  }, [])

  const startMedia = useCallback(async () => {
    if (micStreamRef.current) return true
    setMediaRequesting(true)
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true, video: true })
      micStreamRef.current = stream
      bindStream(stream)
      setMediaVersion((v) => v + 1)
      setProctoringState((prev) => ({ ...prev, micActive: true, camActive: true }))
      setPermissionDenied(false)
      return true
    } catch {
      setPermissionDenied(true)
      setProctoringState((prev) => ({ ...prev, micActive: false, camActive: false }))
      toast.error("Camera and microphone access are required for this exam.")
      return false
    } finally {
      setMediaRequesting(false)
    }
  }, [bindStream])

  // Both <video> elements mount conditionally (pre-exam preview / in-exam
  // thumbnail), so re-attach the stream whenever either may have appeared.
  useEffect(() => {
    if (micStreamRef.current) bindStream(micStreamRef.current)
  }, [hasStarted, preExamInfo, bindStream, mediaVersion, proctoringState.camActive])

  // Release devices on unmount.
  useEffect(() => () => {
    monitorRef.current?.stop()
    micStreamRef.current?.getTracks().forEach((t) => t.stop())
  }, [])

  /* ── Microphone: room check before the exam, talking detection during ─ */

  useEffect(() => {
    const stream = micStreamRef.current
    if (!stream || mediaVersion === 0) return

    const AudioContextClass = window.AudioContext ||
      (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext
    const audioContext = new AudioContextClass()
    audioContextRef.current = audioContext
    const analyser = audioContext.createAnalyser()
    analyser.fftSize = 1024
    analyser.smoothingTimeConstant = 0.85
    const source = audioContext.createMediaStreamSource(stream)
    source.connect(analyser)

    const buffer = new Uint8Array(new ArrayBuffer(analyser.fftSize))
    let rafId = 0
    let smoothed = 0

    const loop = () => {
      rafId = requestAnimationFrame(loop)
      const level = rmsLevel(analyser, buffer)
      smoothed = smoothed * 0.6 + level * 0.4
      const now = performance.now()

      if (!startedRef.current) {
        // Rolling ~2.5 s window decides whether the room is quiet enough to start.
        const samples = calibrationRef.current
        samples.push(smoothed)
        if (samples.length > 25) samples.shift()
        if (samples.length >= 18) {
          const avg = samples.reduce((a, b) => a + b, 0) / samples.length
          setRoomQuiet(avg < PROCTOR.QUIET_MAX)
        }
      }

      // Repaint the meter more often before the exam (students are calibrating)
      // and once a second during it, so the header icon stays truthful.
      if (now - lastMeterPaintRef.current > (startedRef.current ? 1000 : 250)) {
        lastMeterPaintRef.current = now
        setNoiseLevel(Math.round(smoothed))
      }

      if (!startedRef.current || !exam?.proctoringEnabled) return

      accumulate(noiseAccumRef, now, smoothed >= PROCTOR.TALKING_LEVEL)
      if (noiseAccumRef.current.ms >= PROCTOR.TALKING_MS) {
        resetAccumulator(noiseAccumRef)
        raiseWarning(
          "noise",
          "noise_detected",
          `Sustained speech/noise detected (level ${Math.round(smoothed)})`,
          "Talking or loud noise detected. Please stay quiet."
        )
      }
    }
    loop()

    return () => {
      if (rafId) cancelAnimationFrame(rafId)
      try { audioContext.close() } catch { /* already closed */ }
      if (audioContextRef.current === audioContext) audioContextRef.current = null
    }
  }, [mediaVersion, exam?.proctoringEnabled, raiseWarning])

  const recheckRoom = () => {
    calibrationRef.current = []
    setRoomQuiet(null)
  }

  /* ── Face / movement monitoring ────────────────────────────────────── */

  useEffect(() => {
    if (mediaVersion === 0) return

    const monitor = createFaceMonitor(
      () => (startedRef.current ? videoRef.current : previewRef.current),
      (sample) => {
        if (!startedRef.current) {
          setFaceVisible(sample.faceCount === 1)
          setFaceCount(sample.faceCount)
          return
        }
        if (!exam?.proctoringEnabled) return

        const now = performance.now()

        accumulate(faceGoneAccumRef, now, sample.faceCount === 0)
        if (faceGoneAccumRef.current.ms >= PROCTOR.FACE_GONE_MS) {
          resetAccumulator(faceGoneAccumRef)
          raiseWarning("face", "face_not_visible", "Face not visible in camera", "Your face is not visible. Please stay on camera.")
        }

        accumulate(extraFaceAccumRef, now, sample.faceCount >= 2)
        if (extraFaceAccumRef.current.ms >= PROCTOR.EXTRA_FACE_MS) {
          resetAccumulator(extraFaceAccumRef)
          raiseWarning("extraFace", "multiple_faces", "More than one face detected", "Another person was detected on camera. Please sit alone.")
        }

        const moving = sample.speed > PROCTOR.MOVE_SPEED || Math.abs(sample.yaw) > PROCTOR.YAW_LIMIT
        accumulate(moveAccumRef, now, moving)
        if (moveAccumRef.current.ms >= PROCTOR.MOVEMENT_MS) {
          resetAccumulator(moveAccumRef)
          raiseWarning("movement", "movement_detected", "Sustained movement or looking away detected", "Excessive movement detected. Please remain still and face the screen.")
        }
      }
    )

    monitorRef.current = monitor
    monitor.start().then((ok) => {
      setVisionStatus(ok ? "running" : "unavailable")
      if (!ok) setFaceVisible(true) // do not block the student on optional vision
    })

    return () => {
      monitor.stop()
      if (monitorRef.current === monitor) monitorRef.current = null
    }
  }, [mediaVersion, exam?.proctoringEnabled, raiseWarning])

  // Detect the camera or microphone being revoked mid-exam.
  useEffect(() => {
    if (!hasStarted || !exam?.proctoringEnabled) return
    const stream = micStreamRef.current
    if (!stream) return

    const onEnded = () => {
      setProctoringState((prev) => ({ ...prev, camActive: false, micActive: false }))
      reportRef.current("media_lost", "Camera or microphone was disconnected")
      toast.error("Camera or microphone was disconnected. Reconnect to continue.")
    }
    stream.getTracks().forEach((t) => t.addEventListener("ended", onEnded))
    return () => stream.getTracks().forEach((t) => t.removeEventListener("ended", onEnded))
  }, [hasStarted, exam?.proctoringEnabled])

  /* ── Fullscreen ────────────────────────────────────────────────────── */

  const enterFullscreen = useCallback(async () => {
    try {
      await document.documentElement.requestFullscreen()
      return true
    } catch {
      toast.error("Could not enter fullscreen. Please allow it in browser settings.")
      return false
    }
  }, [])

  useEffect(() => {
    const handleFullscreen = () => {
      const isFull = !!document.fullscreenElement
      setProctoringState((prev) => ({ ...prev, fullscreen: isFull }))

      if (isFull) {
        hadFullscreenRef.current = true
        return
      }

      // Leaving fullscreen during a live exam ends the attempt immediately.
      if (hadFullscreenRef.current && hasStarted && !autoSubmitRef.current && !result) {
        reportRef.current("fullscreen_exit", "User exited fullscreen mode")
        toast.error("You left fullscreen. Your exam is being submitted.")
        submitRef.current()
      }
    }

    document.addEventListener("fullscreenchange", handleFullscreen)
    return () => document.removeEventListener("fullscreenchange", handleFullscreen)
  }, [hasStarted, result])

  /* ── Tab visibility ────────────────────────────────────────────────── */

  useEffect(() => {
    if (!hasStarted || !exam?.proctoringEnabled) return
    const handleVisibility = () => {
      const isHidden = document.hidden
      setProctoringState((prev) => ({ ...prev, tabActive: !isHidden }))
      if (isHidden) reportRef.current("tab_switch", "User switched away from the exam tab")
    }
    document.addEventListener("visibilitychange", handleVisibility)
    return () => document.removeEventListener("visibilitychange", handleVisibility)
  }, [hasStarted, exam?.proctoringEnabled])

  /* ── Multiple displays ─────────────────────────────────────────────── */

  useEffect(() => {
    const check = () => setMultiScreen(hasExtendedDisplay())
    check()
    const id = setInterval(check, 3000)
    return () => clearInterval(id)
  }, [])

  useEffect(() => {
    if (!hasStarted || !exam?.proctoringEnabled || !multiScreen) return
    reportRef.current("multi_screen", "An additional display was connected")
  }, [hasStarted, exam?.proctoringEnabled, multiScreen])

  /* ── Heartbeat ─────────────────────────────────────────────────────── */

  useEffect(() => {
    if (!hasStarted || !session || result) return

    const interval = setInterval(async () => {
      try {
        const res = await fetch(`/api/assessments/${assessmentId}/session/heartbeat`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            microphoneActive: stateRef.current.micActive,
            fullscreenActive: stateRef.current.fullscreen,
            tabHidden: !stateRef.current.tabActive,
            answersSnapshot: answersRef.current,
          }),
        })

        if (!res.ok) {
          if (res.status === 404 && !autoSubmitRef.current) {
            clearInterval(interval)
            toast.error("Session is no longer active.")
            router.push(`/student/courses/${courseId}`)
          }
          return
        }

        const data = await res.json()
        if (data.status === "terminated" && data.result) {
          autoSubmitRef.current = true
          setResult({
            score: data.result.score,
            passed: data.result.passed,
            percentageScore: data.result.percentageScore,
          })
          releaseProctoring()
        } else if (typeof data.warnings === "number" && data.warnings > usedWarnings) {
          setSession((prev) => (prev ? { ...prev, warnings: data.warnings } : prev))
          toast.warning(`Warning ${data.warnings}/${data.maxWarnings}. ${data.maxWarnings - data.warnings} remaining.`)
        }
      } catch {
        console.error("Heartbeat failed")
      }
    }, 5000)

    return () => clearInterval(interval)
  }, [hasStarted, session, assessmentId, result, courseId, router, usedWarnings, releaseProctoring])

  /* ── Timer ─────────────────────────────────────────────────────────── */

  useEffect(() => {
    if (!hasStarted || secondsLeft === null || secondsLeft <= 0 || result) return
    const timer = setInterval(() => {
      setSecondsLeft((prev) => {
        if (prev === 1) {
          submitRef.current()
          return 0
        }
        return prev ? prev - 1 : 0
      })
    }, 1000)
    return () => clearInterval(timer)
  }, [hasStarted, secondsLeft, result])

  function formatTime(secs: number) {
    const m = Math.floor(secs / 60)
    const s = secs % 60
    return `${m}:${s.toString().padStart(2, "0")}`
  }

  /* ── Start gate ────────────────────────────────────────────────────── */

  const needsGate = isFinalExam || !!preExamInfo?.proctoringEnabled
  const mediaReady = proctoringState.camActive && proctoringState.micActive
  // Missing vision support is not fatal: audio proctoring still runs.
  const faceCheckOk = visionStatus === "unavailable" || (visionStatus === "running" && faceVisible && faceCount === 1)
  const quietCheckOk = roomQuiet === true
  const gatePassed = !needsGate || (
    proctoringState.fullscreen && !multiScreen && mediaReady && faceCheckOk && quietCheckOk
  )

  const handleStartClick = async () => {
    if (needsGate) {
      if (multiScreen) {
        toast.error("Disconnect additional displays before starting.")
        return
      }
      if (!document.fullscreenElement) {
        const ok = await enterFullscreen()
        if (!ok) return
      }
      if (!mediaReady) {
        const ok = await startMedia()
        if (!ok) return
      }
      if (!gatePassed) return
    }
    calibrationRef.current = []
    startedRef.current = true
    setHasStarted(true)
    initSession()
  }

  /* ── Loading ───────────────────────────────────────────────────────── */

  if (loading) {
    return (
      <div className="h-[60vh] flex flex-col items-center justify-center gap-4">
        <Loader2 className="h-10 w-10 animate-spin text-primary" />
        <p className="text-muted-foreground animate-pulse">Initializing Secure Session...</p>
      </div>
    )
  }

  /* ── Pre-exam instructions + system check ──────────────────────────── */

  if (!hasStarted && preExamInfo) {
    return (
      <div className="max-w-3xl mx-auto space-y-8 py-10">
        <Card className="border-2 shadow-lg">
          <CardHeader className="bg-primary/5 border-b pb-8">
            <div className="flex items-center gap-3 mb-2">
              <Info className="h-6 w-6 text-primary" />
              <CardTitle className="text-2xl font-black">
                {isFinalExam ? "Pre-Exam Instructions" : "Module Test Instructions"}
              </CardTitle>
            </div>
            <p className="text-muted-foreground">Please read the following instructions carefully before starting.</p>
          </CardHeader>
          <CardContent className="py-8 space-y-8">
            <div className="grid sm:grid-cols-3 gap-6">
              <div className="bg-background p-4 rounded-xl border-2 space-y-1">
                <p className="text-xs font-bold text-muted-foreground uppercase">Assessment</p>
                <p className="font-black text-lg">{preExamInfo.title}</p>
              </div>
              <div className="bg-background p-4 rounded-xl border-2 space-y-1">
                <p className="text-xs font-bold text-muted-foreground uppercase">Duration</p>
                <p className="font-black text-lg">{preExamInfo.durationMinutes} Minutes</p>
              </div>
              <div className="bg-background p-4 rounded-xl border-2 space-y-1">
                <p className="text-xs font-bold text-muted-foreground uppercase">Attempts</p>
                <p className="font-black text-lg">{preExamInfo.attemptsLeft} Remaining</p>
              </div>
            </div>

            {needsGate && (
              <>
                <div className="bg-destructive/10 border-destructive/20 border-2 rounded-xl p-6 space-y-4">
                  <div className="flex items-center gap-2 text-destructive">
                    <AlertTriangle className="h-6 w-6" />
                    <h3 className="font-black text-lg">Strict Proctoring Enabled</h3>
                  </div>
                  <ul className="space-y-3 text-sm font-medium">
                    <li className="flex items-start gap-2">
                      <span className="text-destructive font-bold">•</span>
                      <span><strong>Camera &amp; Microphone Required:</strong> Both must stay connected for the whole exam.</span>
                    </li>
                    <li className="flex items-start gap-2">
                      <span className="text-destructive font-bold">•</span>
                      <span><strong>Fullscreen Only:</strong> The exam runs in fullscreen. <strong>Leaving fullscreen submits your exam immediately.</strong></span>
                    </li>
                    <li className="flex items-start gap-2">
                      <span className="text-destructive font-bold">•</span>
                      <span><strong>One Screen Only:</strong> Disconnect any extra monitors before you start.</span>
                    </li>
                    <li className="flex items-start gap-2">
                      <span className="text-destructive font-bold">•</span>
                      <span><strong>Quiet Room:</strong> Move somewhere quiet. Talking or sustained background noise is detected and warned.</span>
                    </li>
                    <li className="flex items-start gap-2">
                      <span className="text-destructive font-bold">•</span>
                      <span><strong>Stay Visible &amp; Still:</strong> Your face, movement and head position are monitored on-device.</span>
                    </li>
                    <li className="flex items-start gap-2">
                      <span className="text-destructive font-bold">•</span>
                      <span><strong>Warning Limit:</strong> You may receive <strong>{maxWarnings} warning{maxWarnings === 1 ? "" : "s"}</strong>. Reaching the limit automatically submits your exam.</span>
                    </li>
                  </ul>
                </div>

                {/* System check */}
                <div className="space-y-3">
                  <h3 className="font-black text-sm uppercase tracking-wider text-muted-foreground">System check</h3>

                  <CheckRow
                    ok={proctoringState.fullscreen}
                    label="Fullscreen"
                    detail={proctoringState.fullscreen ? "Active" : "Required before starting"}
                    action={!proctoringState.fullscreen ? (
                      <Button size="sm" variant="outline" onClick={() => enterFullscreen()}>
                        <Maximize className="mr-2 h-4 w-4" /> Enter fullscreen
                      </Button>
                    ) : null}
                  />

                  <CheckRow
                    ok={!multiScreen}
                    label="Single display"
                    detail={multiScreen
                      ? "An additional display was detected. Detach it to continue."
                      : "Only one display detected"}
                    tone={multiScreen ? "bad" : "good"}
                    action={multiScreen ? (
                      <Button size="sm" variant="outline" onClick={() => setMultiScreen(hasExtendedDisplay())}>
                        <RefreshCw className="mr-2 h-4 w-4" /> Re-check
                      </Button>
                    ) : null}
                  />

                  <CheckRow
                    ok={mediaReady}
                    label="Camera & microphone"
                    detail={mediaReady ? "Both connected" : "Permission required before starting"}
                    action={!mediaReady ? (
                      <Button size="sm" variant="outline" onClick={() => startMedia()} disabled={mediaRequesting}>
                        {mediaRequesting ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Camera className="mr-2 h-4 w-4" />}
                        Allow access
                      </Button>
                    ) : null}
                  />

                  {mediaReady && (
                    <>
                      <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-3 rounded-xl border-2 p-3">
                        <div className="h-24 w-40 shrink-0 overflow-hidden rounded-lg bg-black">
                          <video ref={previewRef} autoPlay muted playsInline className="h-full w-full object-cover" />
                        </div>
                        <div className="min-w-0 flex-1 space-y-2">
                          <p className="text-xs text-muted-foreground">
                            Make sure your full face is visible, well lit, and that you are alone in the room.
                          </p>
                          <div className="flex items-center gap-2">
                            <div className="h-2 flex-1 rounded-full bg-muted overflow-hidden">
                              <div
                                className={`h-full rounded-full transition-all ${noiseLevel >= PROCTOR.QUIET_MAX ? "bg-destructive" : "bg-green-500"}`}
                                style={{ width: `${Math.min(100, noiseLevel * 3)}%` }}
                              />
                            </div>
                            <span className="text-[11px] font-bold tabular-nums w-8 text-right">{Math.round(noiseLevel)}</span>
                          </div>
                        </div>
                      </div>

                      <CheckRow
                        ok={quietCheckOk}
                        label={roomQuiet === null ? "Room noise — measuring…" : roomQuiet ? "Quiet room" : "Room too noisy"}
                        detail={roomQuiet === null
                          ? "Listening for a few seconds. Keep quiet."
                          : roomQuiet
                            ? "Ambient noise is low enough to begin"
                            : "Move to a very quiet place away from other people and noise."}
                        tone={roomQuiet === null ? undefined : roomQuiet ? "good" : "bad"}
                        action={
                          <Button size="sm" variant="outline" onClick={recheckRoom}>
                            <RefreshCw className="mr-2 h-4 w-4" /> {roomQuiet === null ? "Restart" : "Re-check"}
                          </Button>
                        }
                      />

                      <CheckRow
                        ok={faceCheckOk}
                        label={visionStatus === "loading" ? "Face detection — loading…" : visionStatus === "unavailable" ? "Face detection unavailable" : "Face visible"}
                        detail={visionStatus === "unavailable"
                          ? "Your browser could not start face tracking. Audio proctoring remains active."
                          : visionStatus === "loading"
                            ? "Loading on-device face tracking…"
                            : faceCount === 0
                              ? "No face detected. Centre yourself in the frame."
                              : faceCount > 1
                                ? "More than one person detected. Please sit alone."
                                : "One face detected and centred"}
                        tone={visionStatus === "unavailable" ? undefined : faceCheckOk ? "good" : "bad"}
                      />
                    </>
                  )}
                </div>
              </>
            )}

            <Button
              size="lg"
              className="w-full h-14 text-lg font-black"
              onClick={handleStartClick}
              disabled={!gatePassed || submitting}
            >
              <PlayCircle className="mr-2 h-6 w-6" />
              {gatePassed
                ? isFinalExam ? "I Understand, Start Exam" : "I Understand, Start Module Test"
                : "Complete the system check to start"}
            </Button>
          </CardContent>
        </Card>
      </div>
    )
  }

  /* ── Permissions denied ────────────────────────────────────────────── */

  if (permissionDenied && !mediaReady) {
    return (
      <div className="h-[60vh] flex flex-col items-center justify-center max-w-md mx-auto text-center gap-6">
        <div className="h-20 w-20 rounded-full bg-destructive/10 flex items-center justify-center">
          <Camera className="h-10 w-10 text-destructive" />
        </div>
        <div className="space-y-2">
          <h2 className="text-2xl font-bold">Permissions Required</h2>
          <p className="text-muted-foreground">
            You declined camera or microphone access. These are required for this proctored exam.
          </p>
        </div>
        <Button onClick={() => startMedia()} className="w-full font-bold h-12" disabled={mediaRequesting}>
          {mediaRequesting ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
          Try again
        </Button>
      </div>
    )
  }

  /* ── Results ───────────────────────────────────────────────────────── */

  if (result) {
    return (
      <div className="max-w-2xl mx-auto space-y-8 py-10">
        <Card className="text-center overflow-hidden border-2">
          <CardHeader className={`${result.passed ? "bg-primary/10" : "bg-destructive/10"} py-8`}>
            <div className="mx-auto h-16 w-16 rounded-full bg-background flex items-center justify-center mb-4">
              {result.passed ? <ShieldCheck className="h-10 w-10 text-primary" /> : <ShieldAlert className="h-10 w-10 text-destructive" />}
            </div>
            <CardTitle className="text-2xl font-black">
              {result.passed
                ? isFinalExam ? "CONGRATULATIONS!" : "MODULE TEST PASSED!"
                : "ASSESSMENT COMPLETED"}
            </CardTitle>
          </CardHeader>
          <CardContent className="py-10 space-y-6">
            <div className="space-y-1">
              <p className="text-5xl font-black">{result.percentageScore}%</p>
              <p className="text-muted-foreground font-medium">
                {result.passed
                  ? isFinalExam ? "You passed the assessment" : "You passed this module test"
                  : "You did not reach the passing score"}
              </p>
            </div>

            <div className="max-w-xs mx-auto">
              <Progress value={result.percentageScore} className="h-3" />
            </div>

            <div className="flex gap-4 pt-6">
              <Button asChild variant="outline" className="flex-1 font-bold">
                <Link href={`/student/courses/${courseId}`}>Return to Course</Link>
              </Button>
              {result.passed && isFinalExam && (
                <Button asChild className="flex-1 font-bold">
                  <Link href="/student/certificates">Get Certificate</Link>
                </Button>
              )}
            </div>
          </CardContent>
        </Card>
      </div>
    )
  }

  /* ── Resumed session that lost fullscreen ──────────────────────────── */

  if (needsGate && !proctoringState.fullscreen) {
    return (
      <div className="h-[60vh] flex flex-col items-center justify-center max-w-md mx-auto text-center gap-6">
        <div className="h-20 w-20 rounded-full bg-primary/10 flex items-center justify-center">
          <Maximize className="h-10 w-10 text-primary" />
        </div>
        <div className="space-y-2">
          <h2 className="text-2xl font-bold">Fullscreen Required</h2>
          <p className="text-muted-foreground">
            Return to fullscreen to continue. Leaving fullscreen during the exam submits it.
          </p>
        </div>
        <Button onClick={() => enterFullscreen()} className="w-full font-bold h-12">
          Enter Fullscreen &amp; Continue
        </Button>
      </div>
    )
  }

  /* ── Exam wizard ───────────────────────────────────────────────────── */

  const answeredInStep = activeStep
    ? activeStep.questions.filter((q) => (answers[q._id] ?? "").trim().length > 0).length
    : 0

  return (
    <div className="max-w-4xl mx-auto space-y-6 pb-20">
      {/* Sticky header */}
      <div className="sticky top-0 z-50 bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60 border-b pb-4 pt-2">
        <div className="flex items-center justify-between gap-4">
          <div className="flex items-center gap-2 text-xs text-muted-foreground">
            <Link href={`/student/courses/${courseId}`} className="hover:underline">Course</Link>
            <ChevronRight className="h-3 w-3" />
            <span className="font-bold text-foreground">{exam?.title}</span>
          </div>

          <div className="flex items-center gap-4">
            {exam?.proctoringEnabled && (
              <div className="hidden sm:flex items-center gap-3">
                <div className="relative h-10 w-14 bg-black rounded overflow-hidden border-2 border-primary/20">
                  <video ref={videoRef} autoPlay muted playsInline className="w-full h-full object-cover" />
                </div>
                <div className="flex items-center gap-1.5" title="Microphone">
                  {proctoringState.micActive ? <Mic className="h-4 w-4 text-green-500" /> : <MicOff className="h-4 w-4 text-destructive" />}
                </div>
                <div className="flex items-center gap-1.5" title="Camera">
                  {proctoringState.camActive ? <Video className="h-4 w-4 text-green-500" /> : <VideoOff className="h-4 w-4 text-destructive" />}
                </div>
                <div className="flex items-center gap-1.5" title={visionStatus === "running" ? "Movement tracking active" : "Movement tracking unavailable"}>
                  <ScanFace className={`h-4 w-4 ${visionStatus === "running" ? "text-green-500" : "text-muted-foreground"}`} />
                </div>
                <div className="flex items-center gap-1.5" title={noiseLevel >= PROCTOR.TALKING_LEVEL ? "Noise detected" : "Room quiet"}>
                  {noiseLevel >= PROCTOR.TALKING_LEVEL ? <Volume2 className="h-4 w-4 text-destructive" /> : <VolumeX className="h-4 w-4 text-green-500" />}
                </div>
                <div className={`flex items-center gap-1.5 rounded-full border px-2 py-1 ${usedWarnings > 0 ? "border-destructive/40 bg-destructive/10 text-destructive" : "text-muted-foreground"}`} title="Warnings">
                  <AlertTriangle className="h-4 w-4" />
                  <span className="text-[10px] font-black uppercase tracking-wider">{usedWarnings}/{maxWarnings}</span>
                </div>
              </div>
            )}

            {secondsLeft !== null && (
              <div className={`flex items-center gap-2 px-3 py-1.5 rounded-full border-2 font-black ${secondsLeft < 120 ? "bg-destructive/10 border-destructive text-destructive animate-pulse" : "bg-muted border-muted"}`}>
                <Clock className="h-4 w-4" />
                {formatTime(secondsLeft)}
              </div>
            )}
          </div>
        </div>

        {usedWarnings > 0 && (
          <div className="mt-3 flex items-center gap-2 rounded-lg border-2 border-destructive/30 bg-destructive/10 px-3 py-2 text-xs font-bold text-destructive">
            <AlertTriangle className="h-4 w-4 shrink-0" />
            {usedWarnings} of {maxWarnings} warnings used. {maxWarnings - usedWarnings} remaining before automatic submission.
          </div>
        )}

        {/* Step rail */}
        {steps.length > 1 && (
          <div className="mt-4 space-y-2">
            <div className="flex items-center justify-between text-xs">
              <span className="font-black uppercase tracking-wider text-muted-foreground">
                Step {currentStep + 1} of {steps.length}
              </span>
              <span className="font-bold">{activeStep?.label}</span>
            </div>
            <div className="flex gap-1.5">
              {steps.map((s, i) => (
                <div
                  key={s.key}
                  className={`h-1.5 flex-1 rounded-full transition-colors ${
                    i < currentStep ? "bg-primary" : i === currentStep ? "bg-primary/60" : "bg-muted"
                  }`}
                  title={s.label}
                />
              ))}
            </div>
            <p className="text-[11px] text-muted-foreground">
              {answeredInStep} of {activeStep?.questions.length} answered in this part
            </p>
          </div>
        )}
      </div>

      {/* Step questions */}
      <div className="space-y-6">
        {activeStep?.questions.map((q, idx) => (
          <Card key={q._id} className="border-2 shadow-none hover:border-primary/20 transition-colors">
            <CardHeader className="pb-3">
              <div className="flex justify-between items-start gap-4">
                <CardTitle className="text-base font-bold leading-tight">
                  <span className="text-primary mr-2">Q{idx + 1}.</span> {q.type === "fill_blank" ? "Fill in the gap" : q.text}
                </CardTitle>
                <Badge variant="outline" className="shrink-0">{q.points} Points</Badge>
              </div>
            </CardHeader>
            <CardContent className="space-y-3">
              {(q.type === "mcq" || q.type === "true_false") && (q.options || (q.type === "true_false" ? ["True", "False"] : [])).map((opt) => (
                <label
                  key={opt}
                  className={`flex items-center gap-3 p-3 rounded-lg border-2 cursor-pointer transition-all ${answers[q._id] === opt ? "border-primary bg-primary/5" : "hover:bg-muted"}`}
                >
                  <input
                    type="radio"
                    name={`q-${q._id}`}
                    className="h-4 w-4 text-primary accent-primary"
                    value={opt}
                    checked={answers[q._id] === opt}
                    onChange={() => setAnswers((prev) => ({ ...prev, [q._id]: opt }))}
                  />
                  <span className="text-sm font-medium">{opt}</span>
                </label>
              ))}
              {q.type === "short_answer" && (
                <textarea
                  className="w-full border-2 rounded-lg p-3 text-sm bg-background focus:border-primary focus:ring-0 outline-none transition-all min-h-[120px]"
                  placeholder="Type your answer here..."
                  value={answers[q._id] ?? ""}
                  onChange={(e) => setAnswers((prev) => ({ ...prev, [q._id]: e.target.value }))}
                />
              )}
              {q.type === "fill_blank" && (
                <FillInBlank
                  text={q.text}
                  value={answers[q._id] ?? ""}
                  onChange={(v) => setAnswers((prev) => ({ ...prev, [q._id]: v }))}
                />
              )}
            </CardContent>
          </Card>
        ))}
      </div>

      {/* Step navigation */}
      <div className="flex items-center justify-between gap-3 pt-2">
        <Button
          variant="outline"
          size="lg"
          className="h-12 font-bold"
          onClick={() => setCurrentStep((s) => Math.max(0, s - 1))}
          disabled={currentStep === 0 || submitting}
        >
          <ChevronLeft className="mr-1 h-4 w-4" /> Back
        </Button>

        {isLastStep ? (
          <Button
            size="lg"
            className="h-12 px-8 font-black"
            onClick={() => handleSubmit(false)}
            disabled={submitting}
          >
            {submitting ? <Loader2 className="mr-2 h-5 w-5 animate-spin" /> : null}
            SUBMIT EXAM
          </Button>
        ) : (
          <Button
            size="lg"
            className="h-12 px-8 font-black"
            onClick={() => setCurrentStep((s) => Math.min(steps.length - 1, s + 1))}
            disabled={submitting}
          >
            Next: {steps[currentStep + 1]?.label ?? "Results"}
            <ChevronRight className="ml-1 h-4 w-4" />
          </Button>
        )}
      </div>

      <p className="text-center text-xs text-muted-foreground">
        Progress saves automatically every 5 seconds. Leaving fullscreen submits the exam.
      </p>
    </div>
  )
}

/** A single row of the pre-flight system check. */
function CheckRow({
  ok,
  label,
  detail,
  tone,
  action,
}: {
  ok: boolean
  label: string
  detail: string
  tone?: "good" | "bad"
  action?: ReactNode
}) {
  const good = tone ? tone === "good" : ok
  return (
    <div className={`flex items-center gap-3 rounded-xl border-2 p-3 ${good ? "border-primary/20 bg-primary/5" : "border-destructive/30 bg-destructive/5"}`}>
      {good ? <CheckCircle2 className="h-5 w-5 shrink-0 text-primary" /> : <Circle className="h-5 w-5 shrink-0 text-destructive" />}
      <div className="min-w-0 flex-1">
        <p className="text-sm font-bold">{label}</p>
        <p className="text-xs text-muted-foreground">{detail}</p>
      </div>
      {action}
    </div>
  )
}
