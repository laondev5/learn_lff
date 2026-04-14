"use client"

import { useState } from "react"
import { toast } from "sonner"
import { Award, Download, Loader2 } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardFooter, CardHeader, CardTitle } from "@/components/ui/card"
import { pdf } from "@react-pdf/renderer"
import { CertificatePDF } from "@/components/student/CertificatePDF"

interface CertData {
  id: string
  courseTitle: string
  courseId: string
  issuedAt: string
  pdfUrl: string | null
}

export function CertificateCard({
  cert,
  studentName,
  orgName,
  logoUrl,
  signatureUrl,
}: {
  cert: CertData
  studentName: string
  orgName: string
  logoUrl: string | null
  signatureUrl: string | null
}) {
  const [generating, setGenerating] = useState(false)

  async function handleDownload() {
    setGenerating(true)
    try {
      const doc = (
        <CertificatePDF
          studentName={studentName}
          courseTitle={cert.courseTitle}
          orgName={orgName}
          issuedAt={cert.issuedAt}
          logoUrl={logoUrl}
          signatureUrl={signatureUrl}
        />
      )
      const blob = await pdf(doc).toBlob()
      const url = URL.createObjectURL(blob)
      const a = document.createElement("a")
      a.href = url
      a.download = `Certificate-${cert.courseTitle.replace(/\s+/g, "-")}.pdf`
      a.click()
      URL.revokeObjectURL(url)
    } catch {
      toast.error("Failed to generate certificate")
    }
    setGenerating(false)
  }

  return (
    <Card className="flex flex-col">
      <CardHeader className="pb-3">
        <div className="flex items-start gap-3">
          <Award className="h-8 w-8 text-yellow-500 shrink-0 mt-0.5" />
          <div>
            <CardTitle className="text-base leading-snug">{cert.courseTitle}</CardTitle>
            <p className="text-xs text-muted-foreground mt-1">
              Issued {new Date(cert.issuedAt).toLocaleDateString("en-GB", {
                day: "numeric",
                month: "long",
                year: "numeric",
              })}
            </p>
          </div>
        </div>
      </CardHeader>
      <CardContent className="flex-1" />
      <CardFooter>
        <Button onClick={handleDownload} disabled={generating} variant="outline" className="w-full">
          {generating ? (
            <Loader2 className="mr-2 h-4 w-4 animate-spin" />
          ) : (
            <Download className="mr-2 h-4 w-4" />
          )}
          Download Certificate
        </Button>
      </CardFooter>
    </Card>
  )
}
