"use client"

import { useMemo, useState } from "react"
import { Download } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"

export type RosterCohort = {
  id: string
  label: string
  cohort: string
  courseTitle: string
  startDate: string
  endDate: string
  students: {
    id: string
    name: string
    email: string
    state: string
    district: string
    branch: string
    pastorName: string
    pastorEmail: string
    isActive: boolean
    completedModules: number
    examPassed: boolean
    certificateIssued: boolean
    serial: string
  }[]
}

function csvCell(value: string | number | boolean) {
  const text = String(value ?? "")
  return /[",\n]/.test(text) ? `"${text.replaceAll('"', '""')}"` : text
}

export function CohortRosterClient({ cohorts }: { cohorts: RosterCohort[] }) {
  const [selectedId, setSelectedId] = useState(cohorts[0]?.id ?? "")
  const selected = useMemo(() => cohorts.find((c) => c.id === selectedId) ?? null, [cohorts, selectedId])

  function exportCsv() {
    if (!selected) return
    const header = ["Name", "Email", "State", "Church district", "Church branch", "Course", "Cohort", "Pastor", "Pastor email", "Completed modules", "Exam passed", "Certificate issued", "Certificate serial", "Account active"]
    const rows = selected.students.map((s) => [
      s.name, s.email, s.state, s.district, s.branch, selected.courseTitle, selected.cohort,
      s.pastorName, s.pastorEmail, s.completedModules, s.examPassed ? "Yes" : "No", s.certificateIssued ? "Yes" : "No", s.serial, s.isActive ? "Yes" : "No",
    ])
    const csv = [header, ...rows].map((row) => row.map(csvCell).join(",")).join("\r\n")
    // BOM so Excel opens accented names correctly.
    const blob = new Blob(["\uFEFF" + csv], { type: "text/csv;charset=utf-8" })
    const url = URL.createObjectURL(blob)
    const link = document.createElement("a")
    link.href = url
    link.download = `${selected.courseTitle.replace(/\s+/g, "-")}-${selected.cohort.replace(/\s+/g, "-")}-students.csv`
    link.click()
    URL.revokeObjectURL(url)
  }

  if (cohorts.length === 0) {
    return <p className="rounded-xl border p-6 text-sm text-muted-foreground">No cohorts have been scheduled yet.</p>
  }

  return (
    <Card>
      <CardHeader className="gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <CardTitle className="text-base">Cohort roster</CardTitle>
          <p className="mt-1 text-xs text-muted-foreground">Every admitted student in the cohort, exportable to Excel or CSV.</p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <select
            value={selectedId}
            onChange={(e) => setSelectedId(e.target.value)}
            aria-label="Choose a cohort"
            className="max-w-72 rounded-md border bg-background px-3 py-1.5 text-sm"
          >
            {cohorts.map((cohort) => <option key={cohort.id} value={cohort.id}>{cohort.label}</option>)}
          </select>
          <Button variant="outline" size="sm" onClick={exportCsv} disabled={!selected || selected.students.length === 0}>
            <Download className="mr-1.5 h-4 w-4" /> Export CSV
          </Button>
        </div>
      </CardHeader>
      <CardContent className="p-0">
        {selected && (
          <p className="px-6 pb-3 text-sm text-muted-foreground">{selected.courseTitle} · {selected.startDate} – {selected.endDate} · {selected.students.length} student{selected.students.length === 1 ? "" : "s"}</p>
        )}
        <div className="overflow-x-auto">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Student</TableHead>
                <TableHead>State</TableHead>
                <TableHead>District</TableHead>
                <TableHead>Branch</TableHead>
                <TableHead>Pastor</TableHead>
                <TableHead>Modules</TableHead>
                <TableHead>Certificate</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {!selected || selected.students.length === 0 ? (
                <TableRow><TableCell colSpan={7} className="py-10 text-center text-muted-foreground">No admitted students in this cohort yet.</TableCell></TableRow>
              ) : selected.students.map((student) => (
                <TableRow key={student.id}>
                  <TableCell>
                    <p className="font-medium">{student.name}</p>
                    <p className="text-xs text-muted-foreground">{student.email}</p>
                  </TableCell>
                  <TableCell className="text-sm">{student.state || "—"}</TableCell>
                  <TableCell className="text-sm">{student.district || "—"}</TableCell>
                  <TableCell className="text-sm">{student.branch || "—"}</TableCell>
                  <TableCell className="text-sm">
                    <p>{student.pastorName}</p>
                    <p className="text-xs text-muted-foreground">{student.pastorEmail}</p>
                  </TableCell>
                  <TableCell className="text-sm">{student.completedModules}</TableCell>
                  <TableCell className="text-sm">
                    {student.serial ? <span className="font-mono text-xs">{student.serial}</span> : student.certificateIssued ? "Issued" : "—"}
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      </CardContent>
    </Card>
  )
}
