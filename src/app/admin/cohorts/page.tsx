import { auth } from "@/auth"
import { redirect } from "next/navigation"
import { getCohortApplicants } from "@/actions/cohort.actions"
import { AdminCohortsClient } from "@/components/admin/AdminCohortsClient"
import { CohortManagementClient } from "@/components/shared/CohortManagementClient"
import { Badge } from "@/components/ui/badge"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"

export const dynamic = "force-dynamic"

const statusStyles: Record<string, { label: string; className: string }> = {
  pending: { label: "Pending pastor", className: "border-amber-200 bg-amber-50 text-amber-700" },
  accepted: { label: "Admitted", className: "border-emerald-200 bg-emerald-50 text-emerald-700" },
  rejected: { label: "Declined", className: "border-red-200 bg-red-50 text-red-700" },
}

export default async function AdminCohortsPage() {
  const session = await auth()
  if (session?.user.role !== "admin") redirect("/login")
  const applicants = await getCohortApplicants()

  return (
    <div className="space-y-6">
      <Tabs defaultValue="overview">
        <TabsList className="w-full max-w-md">
          <TabsTrigger value="overview">Overview</TabsTrigger>
          <TabsTrigger value="schedules">Schedules</TabsTrigger>
          <TabsTrigger value="applicants">Applicants</TabsTrigger>
        </TabsList>

        <TabsContent value="overview" className="pt-4">
          <AdminCohortsClient />
        </TabsContent>

        <TabsContent value="schedules" className="pt-4">
          <CohortManagementClient role="admin" showAppeals={false} />
        </TabsContent>

        <TabsContent value="applicants" className="pt-4">
          <Card>
            <CardHeader>
              <CardTitle className="text-base">Cohort applicants</CardTitle>
              <p className="text-sm text-muted-foreground">
                Read-only application and partner response status. Reload this page to see new responses. Admission
                decisions are made through the pastor’s invitation.
              </p>
            </CardHeader>
            <CardContent className="p-0">
              <div className="overflow-x-auto">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Student</TableHead>
                      <TableHead>Course · cohort</TableHead>
                      <TableHead>Status</TableHead>
                      <TableHead>Location</TableHead>
                      <TableHead>Pastor</TableHead>
                      <TableHead>Invitation</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {"error" in applicants ? (
                      <TableRow>
                        <TableCell colSpan={6} className="py-8 text-center text-destructive">{applicants.error}</TableCell>
                      </TableRow>
                    ) : applicants.applicants.length === 0 ? (
                      <TableRow>
                        <TableCell colSpan={6} className="py-10 text-center text-muted-foreground">No cohort applications yet.</TableCell>
                      </TableRow>
                    ) : (
                      applicants.applicants.map((applicant) => {
                        const status = statusStyles[applicant.status] ?? { label: applicant.status, className: "" }
                        return (
                          <TableRow key={applicant.id}>
                            <TableCell className="font-medium">{applicant.studentName}</TableCell>
                            <TableCell>
                              <p className="text-sm">{applicant.courseTitle}</p>
                              <p className="text-xs text-muted-foreground">{applicant.cohort}</p>
                            </TableCell>
                            <TableCell>
                              <Badge variant="outline" className={status.className}>{status.label}</Badge>
                            </TableCell>
                            <TableCell className="text-sm">
                              <p>{applicant.state || "—"}</p>
                              <p className="text-xs text-muted-foreground">{applicant.district || "—"} · {applicant.church || "—"}</p>
                            </TableCell>
                            <TableCell className="text-sm">
                              <p>{applicant.partnerName}</p>
                              <p className="break-all text-xs text-muted-foreground">{applicant.partnerEmail}</p>
                            </TableCell>
                            <TableCell className="text-xs text-muted-foreground">
                              {applicant.emailStatus}
                              {applicant.passwordSetupEmailStatus ? ` · set-password: ${applicant.passwordSetupEmailStatus}` : ""}
                            </TableCell>
                          </TableRow>
                        )
                      })
                    )}
                  </TableBody>
                </Table>
              </div>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  )
}
