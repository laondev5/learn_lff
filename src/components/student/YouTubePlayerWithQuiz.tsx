"use client"

import { useEffect, useRef, useState, useCallback } from "react"
import { CheckCircle2, XCircle } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"

interface CueQuestion {
  text: string
  type: "mcq" | "true_false" | "short_answer"
  options: string[]
  correctAnswer: string
  points: number
}

interface VideoCue {
  id?: string
  timestamp: number
  title: string
  questions: CueQuestion[]
}

interface Props {
  videoId: string
  cues: VideoCue[]
  onAllCuesComplete?: () => void
}

type CueResult = "pending" | "correct" | "incorrect"

declare global {
  interface Window {
    YT: {
      Player: new (
        el: HTMLElement,
        opts: {
          videoId: string
          playerVars?: Record<string, number | string>
          events?: {
            onReady?: (e: { target: YTPlayer }) => void
            onStateChange?: (e: { data: number }) => void
          }
        }
      ) => YTPlayer
      PlayerState: { PLAYING: number; PAUSED: number; ENDED: number }
    }
    onYouTubeIframeAPIReady: () => void
  }
  interface YTPlayer {
    playVideo(): void
    pauseVideo(): void
    getCurrentTime(): number
    destroy(): void
  }
}

export function YouTubePlayerWithQuiz({ videoId, cues, onAllCuesComplete }: Props) {
  const containerRef = useRef<HTMLDivElement>(null)
  const playerRef = useRef<YTPlayer | null>(null)
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null)

  const [activeCueIdx, setActiveCueIdx] = useState<number | null>(null)
  const [answers, setAnswers] = useState<Record<number, string>>({})
  const [submitted, setSubmitted] = useState(false)
  const [cueResults, setCueResults] = useState<Record<number, CueResult>>({})
  const [shownCues, setShownCues] = useState<Set<number>>(new Set())
  const [playerReady, setPlayerReady] = useState(false)

  const sortedCues = [...cues].sort((a, b) => a.timestamp - b.timestamp)

  const showCue = useCallback((idx: number) => {
    if (playerRef.current) playerRef.current.pauseVideo()
    setActiveCueIdx(idx)
    setAnswers({})
    setSubmitted(false)
  }, [])

  const startPolling = useCallback(() => {
    if (intervalRef.current) clearInterval(intervalRef.current)
    intervalRef.current = setInterval(() => {
      if (!playerRef.current) return
      const currentTime = playerRef.current.getCurrentTime()
      sortedCues.forEach((cue, idx) => {
        if (!shownCues.has(idx) && currentTime >= cue.timestamp && currentTime <= cue.timestamp + 2) {
          setShownCues((prev) => {
            const next = new Set(prev)
            next.add(idx)
            return next
          })
          showCue(idx)
        }
      })
    }, 500)
  }, [sortedCues, shownCues, showCue])

  useEffect(() => {
    if (!videoId) return

    const initPlayer = () => {
      if (!containerRef.current) return
      playerRef.current = new window.YT.Player(containerRef.current, {
        videoId,
        playerVars: { rel: 0, modestbranding: 1 },
        events: {
          onReady: () => setPlayerReady(true),
          onStateChange: (e) => {
            if (e.data === window.YT.PlayerState.PLAYING) startPolling()
            else if (intervalRef.current) clearInterval(intervalRef.current)
          },
        },
      })
    }

    if (window.YT?.Player) {
      initPlayer()
    } else {
      window.onYouTubeIframeAPIReady = initPlayer
      if (!document.querySelector('script[src*="youtube.com/iframe_api"]')) {
        const script = document.createElement("script")
        script.src = "https://www.youtube.com/iframe_api"
        document.head.appendChild(script)
      }
    }

    return () => {
      if (intervalRef.current) clearInterval(intervalRef.current)
      playerRef.current?.destroy()
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [videoId])

  useEffect(() => {
    if (playerReady && intervalRef.current === null) startPolling()
  }, [playerReady, startPolling])

  function handleSubmitCue() {
    if (activeCueIdx === null) return
    const cue = sortedCues[activeCueIdx]
    let allCorrect = true
    const results: Record<number, CueResult> = {}
    cue.questions.forEach((q, qi) => {
      const studentAnswer = (answers[qi] ?? "").trim().toLowerCase()
      const correct = q.correctAnswer.trim().toLowerCase()
      const isCorrect = studentAnswer === correct
      results[qi] = isCorrect ? "correct" : "incorrect"
      if (!isCorrect) allCorrect = false
    })
    setCueResults(results)
    setSubmitted(true)
    if (allCorrect) {
      setTimeout(() => dismissCue(), 1500)
    }
  }

  function dismissCue() {
    setActiveCueIdx(null)
    setAnswers({})
    setSubmitted(false)
    setCueResults({})
    playerRef.current?.playVideo()
    const allShown = shownCues.size >= sortedCues.length
    if (allShown && onAllCuesComplete) onAllCuesComplete()
  }

  const activeCue = activeCueIdx !== null ? sortedCues[activeCueIdx] : null

  return (
    <div className="relative">
      {/* YouTube Player */}
      <div className="aspect-video rounded-md overflow-hidden border bg-black">
        <div ref={containerRef} className="w-full h-full" />
      </div>

      {/* Cue progress indicators */}
      {sortedCues.length > 0 && (
        <div className="flex items-center gap-2 mt-2 flex-wrap">
          <span className="text-xs text-muted-foreground">Quiz checkpoints:</span>
          {sortedCues.map((cue, idx) => (
            <span
              key={idx}
              className={`inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-xs border ${
                shownCues.has(idx)
                  ? "border-primary/40 bg-primary/10 text-primary"
                  : "border-border bg-muted text-muted-foreground"
              }`}
            >
              {shownCues.has(idx) ? <CheckCircle2 className="h-3 w-3" /> : null}
              {formatTime(cue.timestamp)}
            </span>
          ))}
        </div>
      )}

      {/* Quiz Overlay */}
      {activeCue && (
        <div className="absolute inset-0 bg-background/95 backdrop-blur-sm rounded-md flex items-center justify-center p-4 z-10">
          <Card className="w-full max-w-lg max-h-full overflow-y-auto">
            <CardHeader className="pb-3">
              <div className="flex items-center gap-2">
                <div className="h-8 w-8 rounded-full bg-primary/10 flex items-center justify-center">
                  <span className="text-primary text-sm font-bold">?</span>
                </div>
                <div>
                  <CardTitle className="text-base">{activeCue.title}</CardTitle>
                  <p className="text-xs text-muted-foreground">Answer to continue watching</p>
                </div>
              </div>
            </CardHeader>
            <CardContent className="space-y-4">
              {activeCue.questions.map((q, qi) => (
                <div key={qi} className="space-y-2">
                  <p className="text-sm font-medium">
                    {qi + 1}. {q.text}
                  </p>
                  {q.type === "mcq" && (
                    <div className="space-y-1.5">
                      {q.options.map((opt) => {
                        const isSelected = answers[qi] === opt
                        const result = cueResults[qi]
                        const isCorrectOpt = opt.trim().toLowerCase() === q.correctAnswer.trim().toLowerCase()
                        let optClass = "border-border"
                        if (submitted && result) {
                          if (isSelected && result === "correct") optClass = "border-green-500 bg-green-500/10"
                          else if (isSelected && result === "incorrect") optClass = "border-destructive bg-destructive/10"
                          else if (!isSelected && isCorrectOpt && result === "incorrect") optClass = "border-green-500/50 bg-green-500/5"
                        } else if (isSelected) {
                          optClass = "border-primary bg-primary/10"
                        }
                        return (
                          <label
                            key={opt}
                            className={`flex items-center gap-3 rounded-md border px-3 py-2 cursor-pointer transition-colors ${optClass} ${submitted ? "cursor-default" : "hover:border-primary/50"}`}
                          >
                            <input
                              type="radio"
                              name={`cue-q-${qi}`}
                              value={opt}
                              checked={isSelected}
                              disabled={submitted}
                              onChange={() => setAnswers((prev) => ({ ...prev, [qi]: opt }))}
                              className="sr-only"
                            />
                            <div className={`h-4 w-4 rounded-full border-2 flex items-center justify-center shrink-0 ${isSelected ? "border-primary" : "border-muted-foreground"}`}>
                              {isSelected && <div className="h-2 w-2 rounded-full bg-primary" />}
                            </div>
                            <span className="text-sm">{opt}</span>
                            {submitted && isSelected && result === "correct" && <CheckCircle2 className="ml-auto h-4 w-4 text-green-500" />}
                            {submitted && isSelected && result === "incorrect" && <XCircle className="ml-auto h-4 w-4 text-destructive" />}
                          </label>
                        )
                      })}
                    </div>
                  )}
                  {q.type === "true_false" && (
                    <div className="flex gap-3">
                      {["True", "False"].map((opt) => {
                        const isSelected = answers[qi] === opt
                        const result = cueResults[qi]
                        const isCorrectOpt = opt.toLowerCase() === q.correctAnswer.toLowerCase()
                        let optClass = "border-border"
                        if (submitted && result) {
                          if (isSelected && result === "correct") optClass = "border-green-500 bg-green-500/10"
                          else if (isSelected && result === "incorrect") optClass = "border-destructive bg-destructive/10"
                          else if (!isSelected && isCorrectOpt && result === "incorrect") optClass = "border-green-500/50"
                        } else if (isSelected) {
                          optClass = "border-primary bg-primary/10"
                        }
                        return (
                          <button
                            key={opt}
                            type="button"
                            disabled={submitted}
                            onClick={() => setAnswers((prev) => ({ ...prev, [qi]: opt }))}
                            className={`flex-1 rounded-md border px-4 py-2 text-sm font-medium transition-colors ${optClass} ${submitted ? "cursor-default" : "hover:border-primary/50"}`}
                          >
                            {opt}
                          </button>
                        )
                      })}
                    </div>
                  )}
                  {q.type === "short_answer" && (
                    <div className="space-y-1">
                      <input
                        type="text"
                        disabled={submitted}
                        className="w-full border rounded-md px-3 py-2 text-sm bg-background"
                        placeholder="Your answer..."
                        value={answers[qi] ?? ""}
                        onChange={(e) => setAnswers((prev) => ({ ...prev, [qi]: e.target.value }))}
                      />
                      {submitted && cueResults[qi] === "incorrect" && (
                        <p className="text-xs text-muted-foreground">
                          Correct answer: <span className="font-medium text-foreground">{q.correctAnswer}</span>
                        </p>
                      )}
                    </div>
                  )}
                  {submitted && cueResults[qi] && (
                    <p className={`text-xs font-medium ${cueResults[qi] === "correct" ? "text-green-600" : "text-destructive"}`}>
                      {cueResults[qi] === "correct" ? "Correct!" : "Incorrect"}
                    </p>
                  )}
                </div>
              ))}

              <div className="flex gap-3 pt-2">
                {!submitted ? (
                  <Button
                    onClick={handleSubmitCue}
                    disabled={Object.keys(answers).length < activeCue.questions.length}
                    className="flex-1"
                  >
                    Submit Answer{activeCue.questions.length > 1 ? "s" : ""}
                  </Button>
                ) : (
                  <Button onClick={dismissCue} className="flex-1">
                    Continue Watching
                  </Button>
                )}
              </div>
            </CardContent>
          </Card>
        </div>
      )}
    </div>
  )
}

function formatTime(seconds: number) {
  const m = Math.floor(seconds / 60)
  const s = Math.floor(seconds % 60)
  return `${m}:${s.toString().padStart(2, "0")}`
}
