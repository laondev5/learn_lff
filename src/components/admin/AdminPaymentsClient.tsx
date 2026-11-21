"use client"

import { useMemo, useState } from "react"
import { Badge } from "@/components/ui/badge"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from "@/components/ui/table"
import type { getAdminPayments } from "@/actions/admin-course.actions"

type Data = Extract<Awaited<ReturnType<typeof getAdminPayments>>, { payments: unknown }>
type Payment = Data["payments"][number]

const statusStyles: Record<string, string> = {
  success: "bg-emerald-50 text-emerald-700 border-emerald-200",
  pending: "bg-amber-50 text-amber-700 border-amber-200",
  failed: "bg-red-50 text-red-700 border-red-200",
}

const formatDate = (value: string | null) =>
  value ? new Date(value).toLocaleString("en-GB", { timeZone: "Africa/Lagos", dateStyle: "medium", timeStyle: "short" }) : "—"

export function AdminPaymentsClient({ summary, payments }: { summary: Data["summary"]; payments: Payment[] }) {
  const [status, setStatus] = useState<"all" | "success" | "pending" | "failed">("all")
  const [query, setQuery] = useState("")

  const filtered = useMemo(() => payments.filter((p) => {
    const matchesStatus = status === "all" || p.status === status
    const needle = query.trim().toLowerCase()
    const matchesQuery = !needle || [p.studentName, p.studentEmail, p.courseTitle, p.reference].some((v) => v.toLowerCase().includes(needle))
    return matchesStatus && matchesQuery
  }), [payments, status, query])

  const cards = [
    { label: "Collected", value: `₦${summary.collected.toLocaleString()}` },
    { label: "Successful payments", value: summary.success.toLocaleString() },
    { label: "Pending", value: summary.pending.toLocaleString() },
    { label: "Failed", value: summary.failed.toLocaleString() },
  ]

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold">Payments</h1>
        <p className="mt-1 text-sm text-muted-foreground">Every checkout attempt, who paid, and whether course access was granted.</p>
      </div>

      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        {cards.map((card) => (
          <Card key={card.label}>
            <CardHeader className="pb-1"><CardTitle className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">{card.label}</CardTitle></CardHeader>
            <CardContent><p className="text-2xl font-bold">{card.value}</p></CardContent>
          </Card>
        ))}
      </div>

      <Card>
        <CardHeader className="gap-3 pb-3 sm:flex-row sm:items-center sm:justify-between">
          <CardTitle className="text-base">Transactions ({filtered.length})</CardTitle>
          <div className="flex flex-wrap items-center gap-2">
            <input
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Search name, email, reference"
              className="w-60 rounded-md border bg-background px-3 py-1.5 text-sm"
              aria-label="Search payments"
            />
            <select
              value={status}
              onChange={(e) => setStatus(e.target.value as typeof status)}
              className="rounded-md border bg-background px-3 py-1.5 text-sm"
              aria-label="Filter by status"
            >
              <option value="all">All statuses</option>
              <option value="success">Successful</option>
              <option value="pending">Pending</option>
              <option value="failed">Failed</option>
            </select>
          </div>
        </CardHeader>
        <CardContent className="p-0">
          <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Student</TableHead>
                  <TableHead>Course</TableHead>
                  <TableHead>Amount</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Access</TableHead>
                  <TableHead>Paid / attempted</TableHead>
                  <TableHead>Reference</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filtered.length === 0 ? (
                  <TableRow><TableCell colSpan={7} className="py-10 text-center text-muted-foreground">No payments match this view.</TableCell></TableRow>
                ) : filtered.map((payment) => (
                  <TableRow key={payment.id}>
                    <TableCell>
                      <p className="font-medium">{payment.studentName}</p>
                      <p className="text-xs text-muted-foreground">{payment.studentEmail}</p>
                    </TableCell>
                    <TableCell className="max-w-56 text-sm">{payment.courseTitle}</TableCell>
                    <TableCell className="text-sm font-medium">{payment.currency} {payment.amount.toLocaleString()}</TableCell>
                    <TableCell>
                      <Badge variant="outline" className={`text-xs capitalize ${statusStyles[payment.status] ?? ""}`}>{payment.status}</Badge>
                      {payment.failureReason && <p className="mt-1 text-[11px] text-muted-foreground">{payment.failureReason.replaceAll("_", " ")}</p>}
                    </TableCell>
                    <TableCell className="text-sm">{payment.enrolled ? "Enrolled" : "Not enrolled"}</TableCell>
                    <TableCell className="text-sm text-muted-foreground">{formatDate(payment.paidAt ?? payment.createdAt)}</TableCell>
                    <TableCell className="text-xs font-mono text-muted-foreground">{payment.reference}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        </CardContent>
      </Card>
    </div>
  )
}
