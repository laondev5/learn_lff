"use client"

import { useState, useEffect } from "react"
import { useRouter } from "next/navigation"
import Link from "next/link"
import { toast } from "sonner"
import { ChevronRight, Loader2, Save, Settings } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"


interface CourseSettings {
  caWeight: number
  examWeight: number
  proctoringEnabled: boolean
  maxWarnings: number
}

export function CourseSettingsClient({ courseId, courseTitle }: { courseId: string, courseTitle: string }) {
  const router = useRouter()
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  
  const [caWeight, setCaWeight] = useState(40)
  const [examWeight, setExamWeight] = useState(60)
  const [proctoringEnabled, setProctoringEnabled] = useState(false)
  const [maxWarnings, setMaxWarnings] = useState(3)

  useEffect(() => {
    async function fetchSettings() {
      try {
        const res = await fetch(`/api/courses/${courseId}/settings`)
        const data = await res.json()
        if (res.ok && data.settings) {
          setCaWeight(data.settings.caWeight ?? 40)
          setExamWeight(data.settings.examWeight ?? 60)
          setProctoringEnabled(data.settings.proctoringEnabled ?? false)
          setMaxWarnings(data.settings.maxWarnings ?? 3)
        }
      } catch (err) {
        toast.error("Failed to load course settings")
      } finally {
        setLoading(false)
      }
    }
    fetchSettings()
  }, [courseId])

  // Enforce CA + Exam = 100
  function handleCaWeightChange(val: number) {
    const safeVal = Math.max(0, Math.min(100, val))
    setCaWeight(safeVal)
    setExamWeight(100 - safeVal)
  }

  function handleExamWeightChange(val: number) {
    const safeVal = Math.max(0, Math.min(100, val))
    setExamWeight(safeVal)
    setCaWeight(100 - safeVal)
  }

  async function handleSave(e: React.FormEvent) {
    e.preventDefault()
    
    if (caWeight + examWeight !== 100) {
      toast.error("CA Weight and Exam Weight must total exactly 100%")
      return
    }

    setSaving(true)
    try {
      const res = await fetch(`/api/courses/${courseId}/settings`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          caWeight,
          examWeight,
          proctoringEnabled,
          maxWarnings
        })
      })
      const data = await res.json()
      if (res.ok) {
        toast.success("Course settings saved successfully")
        router.refresh()
      } else {
        toast.error(data.error || "Failed to save settings")
      }
    } catch (err) {
      toast.error("Network error. Could not save settings.")
    } finally {
      setSaving(false)
    }
  }

  if (loading) {
    return (
      <div className="flex h-40 items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    )
  }

  return (
    <div className="max-w-4xl space-y-6">
      {/* Breadcrumb */}
      <div className="space-y-1">
        <div className="flex items-center gap-2 text-sm text-muted-foreground flex-wrap">
          <Link href="/teacher/courses" className="hover:underline">Courses</Link>
          <ChevronRight className="h-3 w-3" />
          <Link href={`/teacher/courses/${courseId}`} className="hover:underline">{courseTitle}</Link>
          <ChevronRight className="h-3 w-3" />
          <span className="font-medium text-foreground">Settings</span>
        </div>
        <div className="flex items-center gap-3">
          <Settings className="h-6 w-6 text-primary" />
          <h1 className="text-2xl font-bold">Course Settings</h1>
        </div>
      </div>

      <form onSubmit={handleSave} className="space-y-6">
        <Card>
          <CardHeader>
            <CardTitle>Grading System</CardTitle>
            <CardDescription>
              Configure how the final grade is calculated. The total weight must exactly equal 100%. 
              Module tests and quizzes automatically contribute to the Continuous Assessment (CA) weight.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-6">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
              <div className="space-y-2">
                <Label>Continuous Assessment (CA) Weight (%)</Label>
                <Input 
                  type="number" 
                  min={0} max={100} 
                  value={caWeight} 
                  onChange={(e) => handleCaWeightChange(Number(e.target.value))}
                  disabled={saving}
                />
              </div>
              <div className="space-y-2">
                <Label>Final Exam Weight (%)</Label>
                <Input 
                  type="number" 
                  min={0} max={100} 
                  value={examWeight} 
                  onChange={(e) => handleExamWeightChange(Number(e.target.value))}
                  disabled={saving}
                />
              </div>
            </div>
            
            <div className="bg-muted/50 rounded-lg p-4 flex items-center justify-between">
              <span className="font-medium">Total Grade Weight:</span>
              <span className={`font-bold text-lg ${caWeight + examWeight === 100 ? "text-green-600 dark:text-green-400" : "text-destructive"}`}>
                {caWeight + examWeight}%
              </span>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Exam Security & Proctoring</CardTitle>
            <CardDescription>
              Settings applied by default to tests and exams in this course.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-6">
            <div className="flex items-center justify-between gap-4">
              <div className="space-y-0.5">
                <Label>Enable Automated Proctoring</Label>
                <p className="text-sm text-muted-foreground">
                  Monitors tab switching, microphone, and fullscreen status.
                </p>
              </div>
              <button
                type="button"
                role="switch"
                aria-checked={proctoringEnabled}
                disabled={saving}
                onClick={() => setProctoringEnabled(!proctoringEnabled)}
                className={`relative inline-flex h-6 w-11 shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors disabled:opacity-50 disabled:cursor-not-allowed ${
                  proctoringEnabled ? "bg-primary" : "bg-muted-foreground/30"
                }`}
              >
                <span
                  className={`pointer-events-none inline-block h-5 w-5 rounded-full bg-white shadow-lg transition-transform ${
                    proctoringEnabled ? "translate-x-5" : "translate-x-0"
                  }`}
                />
              </button>
            </div>
            
            {proctoringEnabled && (
              <div className="space-y-2 pt-4 border-t">
                <Label>Max Allowed Violations</Label>
                <p className="text-xs text-muted-foreground mb-2">
                  The test will automatically terminate if a student exceeds this number of warnings.
                </p>
                <Input 
                  type="number" 
                  min={1} max={10} 
                  className="max-w-[150px]"
                  value={maxWarnings} 
                  onChange={(e) => setMaxWarnings(Number(e.target.value))}
                  disabled={saving}
                />
              </div>
            )}
          </CardContent>
        </Card>

        <div className="flex justify-end gap-4 pt-4">
          <Button asChild variant="outline" disabled={saving}>
            <Link href={`/teacher/courses/${courseId}`}>Cancel</Link>
          </Button>
          <Button type="submit" disabled={saving || caWeight + examWeight !== 100}>
            {saving ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Save className="mr-2 h-4 w-4" />}
            Save Settings
          </Button>
        </div>
      </form>
    </div>
  )
}
