"use client"

import { useState, useEffect, useRef, useCallback } from "react"
import Link from "next/link"
import { useRouter } from "next/navigation"
import { toast } from "sonner"
import { 
  ChevronRight, Loader2, Clock, 
  AlertTriangle, Mic, MicOff, Maximize, 
  ShieldCheck, ShieldAlert, Layout,
  Info, Camera, PlayCircle
} from "lucide-react"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Progress } from "@/components/ui/progress"
import { Badge } from "@/components/ui/badge"

interface Question {
  _id: string
  text: string
  type: "mcq" | "true_false" | "short_answer"
  options?: string[]
  points: number
}

interface ExamData {
  title: string
  type: string
  durationMinutes: number
  totalMarks: number
  proctoringEnabled: boolean
  questions: Question[]
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
  maxAttempts: number
  attemptsLeft: number
}

export function ExamTakerClient({
  assessmentId,
  courseId,
}: {
  assessmentId: string
  courseId: string
}) {
  const router = useRouter()
  
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
  const [proctoringState, setProctoringState] = useState({
    micActive: false,
    fullscreen: false,
    tabActive: true
  })

  // Refs
  const micStreamRef = useRef<MediaStream | null>(null)
  const videoRef = useRef<HTMLVideoElement>(null)
  const audioContextRef = useRef<AudioContext | null>(null)
  const lastNoiseWarningRef = useRef<number>(0)
  const autoSubmitRef = useRef(false)
  const answersRef = useRef(answers)
  
  // Sync answers ref
  useEffect(() => {
    answersRef.current = answers
  }, [answers])

  // 1. Check Session and pre-fetch Info
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
    } catch (error) {
      toast.error("Network error. Please try again.")
      router.push(`/student/courses/${courseId}`)
    }
  }, [assessmentId, courseId, router])

  useEffect(() => {
    checkSession()
  }, [checkSession])

  // 2. Initialize / Start Session
  const initSession = useCallback(async () => {
    setLoading(true)
    try {
      const res = await fetch(`/api/assessments/${assessmentId}/session`, { method: "POST" })
      const data = await res.json()

      if (res.ok) {
        setSession(data.session)
        setExam(data.assessment)
        setAnswers(data.session.answersSnapshot || {})
        
        // Calculate remaining time based on actual session start
        const start = new Date(data.session.startTime).getTime()
        const duration = data.assessment.durationMinutes * 60 * 1000
        const now = Date.now()
        const remaining = Math.max(0, Math.floor((start + duration - now) / 1000))
        setSecondsLeft(remaining)
        
        if (data.session.status === "terminated") {
          toast.error("This session was terminated due to violations.")
          router.push(`/student/courses/${courseId}`)
        }
      } else {
        toast.error(data.error || "Failed to start session")
        router.push(`/student/courses/${courseId}`)
      }
    } catch (error) {
      toast.error("Network error. Please try again.")
    } finally {
      setLoading(false)
    }
  }, [assessmentId, courseId, router])

  // Helper: Report Violation
  const reportViolation = useCallback(async (type: string, details: string) => {
    if (result || autoSubmitRef.current) return
    
    try {
      await fetch(`/api/assessments/${assessmentId}/session/heartbeat`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          microphoneActive: proctoringState.micActive,
          fullscreenActive: proctoringState.fullscreen,
          tabHidden: !proctoringState.tabActive,
          violation: type,
          details
        })
      })
    } catch (error) {
      console.error("Failed to report violation")
    }
  }, [assessmentId, proctoringState, result])

  // 3. Proctoring: Camera & Microphone + Noise Detection
  useEffect(() => {
    if (!hasStarted || !exam?.proctoringEnabled) return

    let animationFrameId: number;

    async function setupMedia() {
      try {
        const stream = await navigator.mediaDevices.getUserMedia({ audio: true, video: true })
        micStreamRef.current = stream
        setProctoringState(prev => ({ ...prev, micActive: true }))

        if (videoRef.current) {
          videoRef.current.srcObject = stream
        }

        // Noise detection logic
        const AudioContextClass = window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
        const audioContext = new AudioContextClass();
        audioContextRef.current = audioContext;
        const analyser = audioContext.createAnalyser();
        const microphone = audioContext.createMediaStreamSource(stream);
        
        analyser.smoothingTimeConstant = 0.8;
        analyser.fftSize = 1024;
        microphone.connect(analyser);

        const detectNoise = () => {
          const array = new Uint8Array(analyser.frequencyBinCount);
          analyser.getByteFrequencyData(array);
          let values = 0;
          for (let i = 0; i < array.length; i++) {
            values += array[i];
          }
          const average = values / array.length;
          
          if (average > 40) { // Threshold for loud noise/speaking
            const now = Date.now();
            if (now - lastNoiseWarningRef.current > 10000) { // 10s cooldown
              lastNoiseWarningRef.current = now;
              reportViolation("noise_detected", "Loud noise or speaking detected");
              toast.warning("Noise detected! Please remain quiet.");
            }
          }
          animationFrameId = requestAnimationFrame(detectNoise);
        }
        
        detectNoise();

      } catch (err) {
        setPermissionDenied(true)
        toast.error("Camera and Microphone access are required to start this proctored exam.")
        setProctoringState(prev => ({ ...prev, micActive: false }))
      }
    }
    setupMedia()

    return () => {
      if (animationFrameId) cancelAnimationFrame(animationFrameId);
      if (audioContextRef.current) audioContextRef.current.close();
      micStreamRef.current?.getTracks().forEach(track => track.stop())
    }
  }, [hasStarted, exam?.proctoringEnabled, reportViolation])

  // 4. Proctoring: Tab/Visibility Detection
  useEffect(() => {
    if (!hasStarted || !exam?.proctoringEnabled) return

    const handleVisibility = () => {
      const isHidden = document.hidden
      setProctoringState(prev => ({ ...prev, tabActive: !isHidden }))
      
      if (isHidden) {
        reportViolation("tab_switch", "User switched away from the exam tab")
      }
    }

    document.addEventListener("visibilitychange", handleVisibility)
    return () => document.removeEventListener("visibilitychange", handleVisibility)
  }, [hasStarted, exam?.proctoringEnabled, reportViolation])

  // 5. Proctoring: Fullscreen Detection
  useEffect(() => {
    if (!hasStarted || !exam?.proctoringEnabled) return

    const handleFullscreen = () => {
      const isFull = !!document.fullscreenElement
      setProctoringState(prev => ({ ...prev, fullscreen: isFull }))
      
      if (!isFull && !autoSubmitRef.current) {
        reportViolation("fullscreen_exit", "User exited fullscreen mode")
      }
    }

    document.addEventListener("fullscreenchange", handleFullscreen)
    return () => document.removeEventListener("fullscreenchange", handleFullscreen)
  }, [hasStarted, exam?.proctoringEnabled, reportViolation])

  // 6. Heartbeat & Auto-Sync
  useEffect(() => {
    if (!hasStarted || !session || result) return

    const interval = setInterval(async () => {
      try {
        const res = await fetch(`/api/assessments/${assessmentId}/session/heartbeat`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            microphoneActive: proctoringState.micActive,
            fullscreenActive: proctoringState.fullscreen,
            tabHidden: !proctoringState.tabActive,
            answersSnapshot: answersRef.current
          })
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

        if (data.status === "terminated") {
          toast.error("Session terminated. Auto-submitting...")
          setResult({
            score: data.result.score,
            passed: data.result.passed,
            percentageScore: data.result.percentageScore
          })
        } else if (data.warnings > (session.warnings || 0)) {
          setSession(prev => prev ? { ...prev, warnings: data.warnings } : null)
          toast.warning(`Warning! You have ${data.warnings}/${data.maxWarnings} violations.`)
        }
      } catch (error) {
        console.error("Heartbeat failed", error)
      }
    }, 5000)

    return () => clearInterval(interval)
  }, [hasStarted, session, assessmentId, proctoringState, result, courseId, router])

  // Helper: Submit Exam
  const handleSubmit = useCallback(async (isAuto = false) => {
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
          reason: isAuto ? "Time limit exceeded" : "User manual submission"
        })
      })
      const data = await res.json()

      if (res.ok) {
        setResult({
          score: data.submission.score,
          passed: data.submission.passed,
          percentageScore: data.submission.percentageScore
        })
        if (data.submission.passed) toast.success("Assessment submitted successfully!")
        else toast.error("Assessment submitted. You did not pass.")
      } else {
        toast.error(data.error || "Submission failed")
      }
    } catch (error) {
      toast.error("Network error during submission")
    } finally {
      setSubmitting(false)
    }
  }, [assessmentId, submitting, result])

  // 7. Timer Logic
  useEffect(() => {
    if (!hasStarted || secondsLeft === null || secondsLeft <= 0 || result) return
    
    const timer = setInterval(() => {
      setSecondsLeft(prev => {
        if (prev === 1) {
          handleSubmit(true)
          return 0
        }
        return prev ? prev - 1 : 0
      })
    }, 1000)

    return () => clearInterval(timer)
  }, [hasStarted, secondsLeft, result, handleSubmit])

  function formatTime(secs: number) {
    const m = Math.floor(secs / 60)
    const s = secs % 60
    return `${m}:${s.toString().padStart(2, "0")}`
  }

  const enterFullscreen = () => {
    document.documentElement.requestFullscreen().catch(() => {
      toast.error("Could not enter fullscreen. Please enable it in browser settings.")
    })
  }

  const handleStartClick = () => {
    setHasStarted(true)
    initSession()
  }

  if (loading) {
    return (
      <div className="h-[60vh] flex flex-col items-center justify-center gap-4">
        <Loader2 className="h-10 w-10 animate-spin text-primary" />
        <p className="text-muted-foreground animate-pulse">Initializing Secure Session...</p>
      </div>
    )
  }

  if (!hasStarted && preExamInfo) {
    return (
      <div className="max-w-3xl mx-auto space-y-8 py-10">
        <Card className="border-2 shadow-lg">
          <CardHeader className="bg-primary/5 border-b pb-8">
            <div className="flex items-center gap-3 mb-2">
              <Info className="h-6 w-6 text-primary" />
              <CardTitle className="text-2xl font-black">Pre-Exam Instructions</CardTitle>
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

            {preExamInfo.proctoringEnabled && (
              <div className="bg-destructive/10 border-destructive/20 border-2 rounded-xl p-6 space-y-4">
                <div className="flex items-center gap-2 text-destructive">
                  <AlertTriangle className="h-6 w-6" />
                  <h3 className="font-black text-lg">Strict Proctoring Enabled</h3>
                </div>
                <ul className="space-y-3 text-sm font-medium">
                  <li className="flex items-start gap-2">
                    <span className="text-destructive font-bold">•</span>
                    <span><strong>Camera & Microphone Required:</strong> You will be prompted to allow access. If you refuse, you will not be allowed to write the exam.</span>
                  </li>
                  <li className="flex items-start gap-2">
                    <span className="text-destructive font-bold">•</span>
                    <span><strong>No Background Noise:</strong> Audio is actively monitored. Excessive noise or speaking will trigger a violation.</span>
                  </li>
                  <li className="flex items-start gap-2">
                    <span className="text-destructive font-bold">•</span>
                    <span><strong>Stay in Fullscreen:</strong> Exiting fullscreen or switching tabs will trigger a violation.</span>
                  </li>
                  <li className="flex items-start gap-2">
                    <span className="text-destructive font-bold">•</span>
                    <span><strong>Auto-Submit:</strong> Accumulating 3 violations will automatically terminate and submit your exam.</span>
                  </li>
                </ul>
              </div>
            )}

            <Button 
              size="lg" 
              className="w-full h-14 text-lg font-black"
              onClick={handleStartClick}
            >
              <PlayCircle className="mr-2 h-6 w-6" />
              I Understand, Start Exam
            </Button>
          </CardContent>
        </Card>
      </div>
    )
  }

  if (permissionDenied) {
    return (
      <div className="h-[60vh] flex flex-col items-center justify-center max-w-md mx-auto text-center gap-6">
        <div className="h-20 w-20 rounded-full bg-destructive/10 flex items-center justify-center">
          <Camera className="h-10 w-10 text-destructive" />
        </div>
        <div className="space-y-2">
          <h2 className="text-2xl font-bold">Permissions Required</h2>
          <p className="text-muted-foreground">
            You declined camera or microphone access. These are required for this proctored exam. You cannot proceed without them.
          </p>
        </div>
        <Button onClick={() => window.location.reload()} className="w-full font-bold h-12">
          Reload & Allow Access
        </Button>
      </div>
    )
  }

  if (result) {
    return (
      <div className="max-w-2xl mx-auto space-y-8 py-10">
        <Card className="text-center overflow-hidden border-2">
          <CardHeader className={`${result.passed ? "bg-primary/10" : "bg-destructive/10"} py-8`}>
            <div className="mx-auto h-16 w-16 rounded-full bg-background flex items-center justify-center mb-4">
              {result.passed ? <ShieldCheck className="h-10 w-10 text-primary" /> : <ShieldAlert className="h-10 w-10 text-destructive" />}
            </div>
            <CardTitle className="text-2xl font-black">{result.passed ? "CONGRATULATIONS!" : "ASSESSMENT COMPLETED"}</CardTitle>
          </CardHeader>
          <CardContent className="py-10 space-y-6">
            <div className="space-y-1">
              <p className="text-5xl font-black">{result.percentageScore}%</p>
              <p className="text-muted-foreground font-medium">{result.passed ? "You passed the assessment" : "You did not reach the passing score"}</p>
            </div>
            
            <div className="max-w-xs mx-auto">
              <Progress value={result.percentageScore} className="h-3" />
            </div>

            <div className="flex gap-4 pt-6">
              <Button asChild variant="outline" className="flex-1 font-bold">
                <Link href={`/student/courses/${courseId}`}>Return to Course</Link>
              </Button>
              {result.passed && (
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

  if (exam?.proctoringEnabled && !proctoringState.fullscreen) {
    return (
      <div className="h-[60vh] flex flex-col items-center justify-center max-w-md mx-auto text-center gap-6">
        <div className="h-20 w-20 rounded-full bg-primary/10 flex items-center justify-center">
          <Maximize className="h-10 w-10 text-primary" />
        </div>
        <div className="space-y-2">
          <h2 className="text-2xl font-bold">Fullscreen Required</h2>
          <p className="text-muted-foreground">
            This assessment is proctored. You must be in fullscreen mode to start or continue.
          </p>
        </div>
        <Button onClick={enterFullscreen} className="w-full font-bold h-12">
          Enter Fullscreen & Continue
        </Button>
      </div>
    )
  }

  return (
    <div className="max-w-4xl mx-auto space-y-6 pb-20">
      {/* Sticky Header */}
      <div className="sticky top-0 z-50 bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60 border-b pb-4 pt-2">
        <div className="flex items-center justify-between gap-4">
          <div className="flex items-center gap-2 text-xs text-muted-foreground">
            <Link href={`/student/courses/${courseId}`} className="hover:underline">Course</Link>
            <ChevronRight className="h-3 w-3" />
            <span className="font-bold text-foreground">{exam?.title}</span>
          </div>
          
          <div className="flex items-center gap-6">
            {/* Proctoring Indicators */}
            {exam?.proctoringEnabled && (
              <div className="hidden sm:flex items-center gap-3">
                <div className="relative h-10 w-14 bg-black rounded overflow-hidden border-2 border-primary/20">
                  <video ref={videoRef} autoPlay muted playsInline className="w-full h-full object-cover" />
                </div>
                <div className="flex items-center gap-1.5" title="Microphone Status">
                  {proctoringState.micActive ? <Mic className="h-4 w-4 text-green-500" /> : <MicOff className="h-4 w-4 text-destructive" />}
                  <span className="text-[10px] font-bold uppercase tracking-wider">Audio</span>
                </div>
                <div className="flex items-center gap-1.5" title="Violation Status">
                  <AlertTriangle className={`h-4 w-4 ${session?.warnings ? "text-destructive" : "text-muted-foreground"}`} />
                  <span className="text-[10px] font-bold uppercase tracking-wider">Warnings: {session?.warnings}/{session?.maxWarnings}</span>
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
      </div>

      <div className="space-y-6">
        {exam?.questions.map((q, idx) => (
          <Card key={q._id} className="border-2 shadow-none hover:border-primary/20 transition-colors">
            <CardHeader className="pb-3">
              <div className="flex justify-between items-start gap-4">
                <CardTitle className="text-base font-bold leading-tight">
                  <span className="text-primary mr-2">Q{idx + 1}.</span> {q.text}
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
                <div className="space-y-2">
                  <textarea
                    className="w-full border-2 rounded-lg p-3 text-sm bg-background focus:border-primary focus:ring-0 outline-none transition-all min-h-[100px]"
                    placeholder="Type your answer here..."
                    value={answers[q._id] ?? ""}
                    onChange={(e) => setAnswers((prev) => ({ ...prev, [q._id]: e.target.value }))}
                  />
                </div>
              )}
            </CardContent>
          </Card>
        ))}
      </div>

      <div className="pt-4">
        <Button 
          size="lg"
          onClick={() => handleSubmit()} 
          disabled={submitting} 
          className="w-full h-14 text-lg font-black shadow-lg"
        >
          {submitting ? <Loader2 className="mr-2 h-6 w-6 animate-spin" /> : null}
          SUBMIT ASSESSMENT
        </Button>
        <p className="text-center text-xs text-muted-foreground mt-4">
          All progress is automatically saved every 5 seconds.
        </p>
      </div>
    </div>
  )
}
