"use client"

import { useState } from "react"
import { toast } from "sonner"
import { Award, Download, Loader2 } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardFooter, CardHeader, CardTitle } from "@/components/ui/card"
import { pdf } from "@react-pdf/renderer"
import { CertificatePDF } from "@/components/student/CertificatePDF"
import type { CertificateLayout } from "@/lib/certificate-layout"

export interface CertificateDesignData {
  title: string
  institutionName: string
  logos: string[]
  signatures: { name: string; role: string; url: string | null }[]
  layout?: CertificateLayout | null
}

interface CertData {
  id: string
  courseTitle: string
  courseId: string
  issuedAt: string
  serial: string | null
  pdfUrl: string | null
}

/** react-pdf needs absolute URLs, while uploads are served from relative /api/files paths. */
function absolute(url: string) {
  return /^https?:/i.test(url) ? url : new URL(url, window.location.origin).toString()
}

export function CertificateCard({
  cert,
  studentName,
  design,
}: {
  cert: CertData
  studentName: string
  design: CertificateDesignData
}) {
  const [generating, setGenerating] = useState(false)

  async function handleDownload() {
    setGenerating(true)
    try {
      const blob = await pdf(
        <CertificatePDF
          studentName={studentName}
          courseTitle={cert.courseTitle}
          title={design.title}
          institutionName={design.institutionName}
          issuedAt={cert.issuedAt}
          serial={cert.serial}
          logos={design.logos.map(absolute)}
          signatures={design.signatures.map((s) => ({ ...s, url: s.url ? absolute(s.url) : null }))}
          layout={
            design.layout
              ? {
                  ...design.layout,
                  blocks: design.layout.blocks.map((block) => {
                    if (block.type === "logo") return { ...block, url: block.url ? absolute(block.url) : "" }
                    if (block.type === "signature") return { ...block, url: block.url ? absolute(block.url) : "" }
                    return block
                  }),
                }
              : null
          }
        />,
      ).toBlob()
      const url = URL.createObjectURL(blob)
      const link = document.createElement("a")
      link.href = url
      link.download = `${design.title.replace(/\s+/g, "-")}-${cert.courseTitle.replace(/\s+/g, "-")}.pdf`
      link.click()
      URL.revokeObjectURL(url)
    } catch {
      toast.error("Failed to generate certificate")
    } finally {
      setGenerating(false)
    }
  }

  return (
    <Card className="flex flex-col">
      <CardHeader className="pb-3">
        <div className="flex items-start gap-3">
          <Award className="mt-0.5 h-8 w-8 shrink-0 text-yellow-500" />
          <div>
            <CardTitle className="text-base leading-snug">{cert.courseTitle}</CardTitle>
            <p className="mt-1 text-xs text-muted-foreground">
              {design.title} · issued {new Date(cert.issuedAt).toLocaleDateString("en-GB", { day: "numeric", month: "long", year: "numeric" })}
            </p>
            {cert.serial && <p className="mt-1 text-xs font-mono text-muted-foreground">No. {cert.serial}</p>}
          </div>
        </div>
      </CardHeader>
      <CardContent className="flex-1">
        <p className="text-xs text-muted-foreground">Issued by {design.institutionName}</p>
      </CardContent>
      <CardFooter>
        <Button onClick={handleDownload} disabled={generating} variant="outline" className="w-full">
          {generating ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Download className="mr-2 h-4 w-4" />}
          Download certificate
        </Button>
      </CardFooter>
    </Card>
  )
}
