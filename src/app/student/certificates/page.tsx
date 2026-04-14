import { auth } from "@/auth"
import { connectDB } from "@/lib/mongoose"
import Certificate from "@/models/Certificate.model"
import { getSystemConfig } from "@/actions/system.actions"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Award } from "lucide-react"
import { Types } from "mongoose"
import { CertificateCard } from "@/components/student/CertificateCard"

async function getStudentCertificates(studentId: string) {
  await connectDB()
  const certs = await Certificate.find({ student: studentId })
    .populate("course", "title")
    .lean()

  return certs.map((c) => {
    const course = c.course as unknown as { _id: Types.ObjectId; title: string }
    return {
      id: c._id.toString(),
      courseTitle: course.title,
      courseId: course._id.toString(),
      issuedAt: c.issuedAt.toISOString(),
      pdfUrl: c.pdfUrl ?? null,
    }
  })
}

export default async function CertificatesPage() {
  const session = await auth()
  const [certificates, config] = await Promise.all([
    getStudentCertificates(session!.user.id),
    getSystemConfig(),
  ])

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold">My Certificates</h1>
        <p className="text-muted-foreground text-sm mt-1">Certificates earned from completed courses</p>
      </div>

      {certificates.length === 0 ? (
        <Card>
          <CardContent className="py-16 text-center text-muted-foreground">
            <Award className="h-12 w-12 mx-auto mb-3 opacity-40" />
            <p>No certificates yet.</p>
            <p className="text-sm mt-1">Complete a course and pass the final exam to earn your first certificate.</p>
          </CardContent>
        </Card>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {certificates.map((cert) => (
            <CertificateCard
              key={cert.id}
              cert={cert}
              studentName={session!.user.name ?? "Student"}
              orgName={config.organizationName}
              logoUrl={config.logoUrl}
              signatureUrl={config.signatureUrl}
            />
          ))}
        </div>
      )}
    </div>
  )
}
