"use client"

import { useState, useEffect, useCallback } from "react"
import Link from "next/link"
import {
  Search, Users, AlertTriangle,
  Mic, MicOff, Monitor, MonitorOff, Layout,
  Filter, RefreshCw, Loader2, ArrowLeft,
  LayoutGrid, List, ChevronLeft, ChevronRight,
} from "lucide-react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select"
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from "@/components/ui/table"
import { toast } from "sonner"
import { Separator } from "@/components/ui/separator"

interface StudentGrade {
  caContribution: number
  examContribution: number
  finalGrade: number
}

interface Student {
  _id: string
  name: string
  email: string
  cohort?: string
  avatarUrl?: string
  enrolledAt?: string
  grades?: StudentGrade
  proctoringStatus?: {
    status: string
    warnings: number
    maxWarnings: number
    microphoneActive: boolean
    fullscreenActive: boolean
    tabHidden: boolean
    lastPolledAt?: string
  }
}

const PAGE_SIZE = 10

export function CourseMonitoringClient({ courseId }: { courseId: string }) {
  const [students, setStudents] = useState<Student[]>([])
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState("")
  const [cohort, setCohort] = useState("all")
  const [refreshing, setRefreshing] = useState(false)
  const [viewMode, setViewMode] = useState<"table" | "grid">("table")
  const [page, setPage] = useState(1)

  const fetchStudents = useCallback(async (isRefresh = false) => {
    if (isRefresh) setRefreshing(true)
    else setLoading(true)

    try {
      const url = new URL(`/api/courses/${courseId}/students`, window.location.origin)
      url.searchParams.set("includeGrades", "true")
      if (search) url.searchParams.set("search", search)
      if (cohort !== "all") url.searchParams.set("cohort", cohort)

      const res = await fetch(url)
      const data = await res.json()

      if (res.ok) {
        setStudents(data.students)
        setPage(1)
      } else {
        toast.error(data.error || "Failed to fetch students")
      }
    } catch {
      toast.error("Internal Server Error")
    } finally {
      setLoading(false)
      setRefreshing(false)
    }
  }, [courseId, search, cohort])

  useEffect(() => {
    const delayDebounceFn = setTimeout(() => { fetchStudents() }, 500)
    return () => clearTimeout(delayDebounceFn)
  }, [fetchStudents])

  // Polling for live proctoring updates
  useEffect(() => {
    const interval = setInterval(() => { fetchStudents(true) }, 10000)
    return () => clearInterval(interval)
  }, [fetchStudents])

  const cohorts = Array.from(new Set(students.map(s => s.cohort).filter(Boolean)))
  const totalPages = Math.max(1, Math.ceil(students.length / PAGE_SIZE))
  const paginated = students.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE)

  const ProctoringIcons = ({ student }: { student: Student }) => (
    <div className="flex items-center gap-1.5">
      <span title={student.proctoringStatus?.microphoneActive ? "Mic Active" : "Mic Inactive"}>
        {student.proctoringStatus?.microphoneActive
          ? <Mic className="h-3.5 w-3.5 text-green-500" />
          : <MicOff className="h-3.5 w-3.5 text-muted-foreground" />}
      </span>
      <span title={student.proctoringStatus?.fullscreenActive ? "Fullscreen" : "Windowed"}>
        {student.proctoringStatus?.fullscreenActive
          ? <Monitor className="h-3.5 w-3.5 text-green-500" />
          : <MonitorOff className="h-3.5 w-3.5 text-muted-foreground" />}
      </span>
      <span title={student.proctoringStatus?.tabHidden ? "Tab Hidden" : "Active Tab"}>
        {student.proctoringStatus?.tabHidden
          ? <Layout className="h-3.5 w-3.5 text-destructive" />
          : <Layout className="h-3.5 w-3.5 text-green-500" />}
      </span>
      <span className="flex items-center gap-0.5 ml-1">
        <AlertTriangle className={`h-3 w-3 ${(student.proctoringStatus?.warnings ?? 0) > 0 ? "text-destructive" : "text-muted-foreground"}`} />
        <span className="text-xs font-bold">
          {student.proctoringStatus?.warnings ?? 0}/{student.proctoringStatus?.maxWarnings ?? 3}
        </span>
      </span>
    </div>
  )

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div className="space-y-1">
          <div className="flex items-center gap-2 text-sm text-muted-foreground">
            <Link href={`/teacher/courses/${courseId}`} className="hover:underline flex items-center gap-1">
              <ArrowLeft className="h-3 w-3" /> Back to Course
            </Link>
          </div>
          <h1 className="text-2xl font-bold flex items-center gap-2">
            <Users className="h-6 w-6 text-primary" />
            Student Monitoring &amp; Grades
          </h1>
          <p className="text-sm text-muted-foreground">
            Monitor live proctoring status and view dynamic grading breakdowns.
          </p>
        </div>
        <Button variant="outline" size="sm" onClick={() => fetchStudents(true)} disabled={refreshing}>
          {refreshing ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : <RefreshCw className="h-4 w-4 mr-2" />}
          Refresh
        </Button>
      </div>

      {/* Controls */}
      <div className="flex flex-col md:flex-row gap-3">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="Search by name or email..."
            className="pl-9"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
        </div>
        <div className="flex items-center gap-2">
          <Filter className="h-4 w-4 text-muted-foreground shrink-0" />
          <Select value={cohort} onValueChange={(val) => setCohort(val || "all")}>
            <SelectTrigger className="w-[160px]">
              <SelectValue placeholder="All Cohorts" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Cohorts</SelectItem>
              {cohorts.map(c => <SelectItem key={c} value={c!}>{c}</SelectItem>)}
            </SelectContent>
          </Select>
          {/* View toggle */}
          <div className="flex items-center border rounded-md overflow-hidden">
            <button
              onClick={() => setViewMode("table")}
              className={`px-2.5 py-1.5 transition-colors ${viewMode === "table" ? "bg-primary text-primary-foreground" : "hover:bg-accent text-muted-foreground"}`}
              title="Table view"
            >
              <List className="h-4 w-4" />
            </button>
            <button
              onClick={() => setViewMode("grid")}
              className={`px-2.5 py-1.5 transition-colors ${viewMode === "grid" ? "bg-primary text-primary-foreground" : "hover:bg-accent text-muted-foreground"}`}
              title="Grid view"
            >
              <LayoutGrid className="h-4 w-4" />
            </button>
          </div>
        </div>
      </div>

      <Separator />

      {/* Content */}
      {loading ? (
        <div className="py-20 flex justify-center">
          <Loader2 className="h-8 w-8 animate-spin text-primary" />
        </div>
      ) : students.length === 0 ? (
        <Card>
          <CardContent className="py-12 text-center text-muted-foreground">
            No students found matching your filters.
          </CardContent>
        </Card>
      ) : viewMode === "table" ? (
        /* ── TABLE VIEW ── */
        <Card>
          <CardContent className="p-0">
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Student</TableHead>
                    <TableHead>Cohort</TableHead>
                    <TableHead>Proctoring</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead className="text-center">CA %</TableHead>
                    <TableHead className="text-center">Exam %</TableHead>
                    <TableHead className="text-center">Final %</TableHead>
                    <TableHead className="text-right">Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {paginated.map((student) => (
                    <TableRow key={student._id}>
                      <TableCell>
                        <div className="flex items-center gap-2.5">
                          <div className="h-8 w-8 rounded-full bg-primary/10 flex items-center justify-center text-primary font-bold text-sm shrink-0">
                            {student.name.charAt(0)}
                          </div>
                          <div className="min-w-0">
                            <p className="font-medium text-sm truncate max-w-[140px]">{student.name}</p>
                            <p className="text-xs text-muted-foreground truncate max-w-[140px]">{student.email}</p>
                          </div>
                        </div>
                      </TableCell>
                      <TableCell>
                        <Badge variant="outline" className="text-[10px] uppercase">
                          {student.cohort || "—"}
                        </Badge>
                      </TableCell>
                      <TableCell>
                        <ProctoringIcons student={student} />
                      </TableCell>
                      <TableCell>
                        <Badge
                          variant={student.proctoringStatus?.status === "active" ? "default" : "secondary"}
                          className="text-[10px]"
                        >
                          {student.proctoringStatus?.status || "Idle"}
                        </Badge>
                      </TableCell>
                      <TableCell className="text-center font-medium text-sm">
                        {student.grades?.caContribution ?? 0}%
                      </TableCell>
                      <TableCell className="text-center font-medium text-sm">
                        {student.grades?.examContribution ?? 0}%
                      </TableCell>
                      <TableCell className="text-center">
                        <span className="font-black text-primary">
                          {student.grades?.finalGrade ?? 0}%
                        </span>
                      </TableCell>
                      <TableCell className="text-right">
                        <Button asChild variant="outline" size="sm" className="text-xs h-7">
                          <Link href={`/teacher/courses/${courseId}/grades?studentId=${student._id}`}>
                            Details
                          </Link>
                        </Button>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          </CardContent>
        </Card>
      ) : (
        /* ── GRID VIEW ── */
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {paginated.map((student) => (
            <Card key={student._id} className="overflow-hidden border-2 hover:border-primary/20 transition-colors">
              <CardHeader className="pb-3 bg-muted/30">
                <div className="flex items-center justify-between gap-2">
                  <div className="flex items-center gap-3 min-w-0">
                    <div className="h-10 w-10 rounded-full bg-primary/10 flex items-center justify-center text-primary font-bold">
                      {student.name.charAt(0)}
                    </div>
                    <div className="min-w-0">
                      <CardTitle className="text-sm font-bold truncate">{student.name}</CardTitle>
                      <p className="text-xs text-muted-foreground truncate">{student.email}</p>
                    </div>
                  </div>
                  <Badge variant="outline" className="text-[10px] uppercase">{student.cohort || "No Cohort"}</Badge>
                </div>
              </CardHeader>
              <CardContent className="pt-4 space-y-4">
                <div className="space-y-2">
                  <p className="text-[10px] font-bold text-muted-foreground uppercase tracking-wider">Live Proctoring</p>
                  <div className="flex items-center justify-between gap-2">
                    <ProctoringIcons student={student} />
                    <Badge
                      variant={student.proctoringStatus?.status === "active" ? "default" : "secondary"}
                      className="text-[9px] px-1 h-4"
                    >
                      {student.proctoringStatus?.status || "Idle"}
                    </Badge>
                  </div>
                </div>
                <Separator />
                <div className="space-y-2">
                  <p className="text-[10px] font-bold text-muted-foreground uppercase tracking-wider">Dynamic Grading</p>
                  <div className="grid grid-cols-2 gap-2 text-xs">
                    <div className="p-2 rounded bg-muted/50 text-center">
                      <p className="text-[9px] text-muted-foreground">CA Contribution</p>
                      <p className="font-bold">{student.grades?.caContribution || 0}%</p>
                    </div>
                    <div className="p-2 rounded bg-muted/50 text-center">
                      <p className="text-[9px] text-muted-foreground">Exam Contribution</p>
                      <p className="font-bold">{student.grades?.examContribution || 0}%</p>
                    </div>
                  </div>
                  <div className="p-2 rounded bg-primary/5 border border-primary/20 flex items-center justify-between">
                    <span className="text-xs font-bold text-primary">Final Grade</span>
                    <span className="text-lg font-black text-primary">{student.grades?.finalGrade || 0}%</span>
                  </div>
                </div>
                <Button asChild variant="outline" size="sm" className="w-full text-xs">
                  <Link href={`/teacher/courses/${courseId}/grades?studentId=${student._id}`}>
                    View Full Breakdown
                  </Link>
                </Button>
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      {/* Pagination */}
      {!loading && students.length > 0 && (
        <div className="flex items-center justify-between pt-2">
          <p className="text-sm text-muted-foreground">
            Showing {Math.min((page - 1) * PAGE_SIZE + 1, students.length)}–{Math.min(page * PAGE_SIZE, students.length)} of {students.length} students
          </p>
          <div className="flex items-center gap-2">
            <Button
              variant="outline"
              size="sm"
              onClick={() => setPage(p => Math.max(1, p - 1))}
              disabled={page === 1}
            >
              <ChevronLeft className="h-4 w-4" />
            </Button>
            <span className="text-sm font-medium px-2">
              Page {page} / {totalPages}
            </span>
            <Button
              variant="outline"
              size="sm"
              onClick={() => setPage(p => Math.min(totalPages, p + 1))}
              disabled={page === totalPages}
            >
              <ChevronRight className="h-4 w-4" />
            </Button>
          </div>
        </div>
      )}
    </div>
  )
}
