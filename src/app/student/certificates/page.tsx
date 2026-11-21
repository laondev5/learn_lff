import { auth } from "@/auth"
import { connectDB } from "@/lib/mongoose"
import Certificate from "@/models/Certificate.model"
import { getSystemConfig } from "@/actions/system.actions"
import { getCertificateDesign } from "@/lib/certificate"
import { Card, CardContent } from "@/components/ui/card"
import { Award } from "lucide-react"
import { Types } from "mongoose"
import { CertificateCard } from "@/components/student/CertificateCard"

async function getStudentCertificates(studentId: string) {
  await connectDB()
  const certs = await Certificate.find({ student: studentId })
    .populate("course", "title")
    .lean()

  return Promise.all(certs.map(async (c) => {
    const course = c.course as unknown as { _id: Types.ObjectId; title: string }
    return {
      id: c._id.toString(),
      courseTitle: course.title,
      courseId: course._id.toString(),
      issuedAt: c.issuedAt.toISOString(),
      serial: c.serial ?? null,
      pdfUrl: c.pdfUrl ?? null,
    }
  }))
}

export default async function CertificatesPage() {
  const session = await auth()
  const [certificates, config] = await Promise.all([
    getStudentCertificates(session!.user.id),
    getSystemConfig(),
  ])

  const designs = await Promise.all(certificates.map((cert) =>
    getCertificateDesign(cert.courseId, {
      institutionName: config.organizationName,
      logoUrl: config.logoUrl,
      signatureUrl: config.signatureUrl,
    }),
  ))

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold">My Certificates</h1>
        <p className="mt-1 text-sm text-muted-foreground">Download your certificate of completion once you have finished every module and passed the exam.</p>
      </div>

      {certificates.length === 0 ? (
        <Card>
          <CardContent className="py-16 text-center text-muted-foreground">
            <Award className="mx-auto mb-3 h-12 w-12 opacity-40" />
            <p>No certificates yet.</p>
            <p className="mt-1 text-sm">Complete all modules in a course to earn your certificate of completion.</p>
          </CardContent>
        </Card>
      ) : (
        <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
          {certificates.map((cert, index) => (
            <CertificateCard
              key={cert.id}
              cert={cert}
              studentName={session!.user.name ?? "Student"}
              design={designs[index]}
            />
          ))}
        </div>
      )}
    </div>
  )
}
