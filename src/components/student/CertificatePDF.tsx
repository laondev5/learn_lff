import { Document, Page, Text, View, Image, StyleSheet } from "@react-pdf/renderer"
import {
  DESIGN_HEIGHT,
  DESIGN_WIDTH,
  resolveText,
  type CertificateContent,
  type CertificateLayout,
  type SignatureBlock,
  type TextBlock,
} from "@/lib/certificate-layout"

const styles = StyleSheet.create({
  page: { backgroundColor: "#ffffff", padding: 46, fontFamily: "Helvetica", position: "relative" },
  border: { position: "absolute", top: 18, left: 18, right: 18, bottom: 18, borderWidth: 3, borderColor: "#1e3a5f" },
  innerBorder: { position: "absolute", top: 24, left: 24, right: 24, bottom: 24, borderWidth: 1, borderColor: "#c9a84c" },
  content: { flex: 1, alignItems: "center", justifyContent: "space-between", paddingHorizontal: 34, paddingVertical: 10 },
  logoRow: { flexDirection: "row", justifyContent: "center", alignItems: "center", gap: 18, height: 54, marginTop: 4 },
  logo: { height: 48, maxWidth: 130, objectFit: "contain" },
  header: { alignItems: "center" },
  institution: { fontSize: 12, color: "#1e3a5f", letterSpacing: 2.5, textTransform: "uppercase", fontFamily: "Helvetica-Bold", marginBottom: 6, textAlign: "center" },
  title: { fontSize: 26, color: "#1e3a5f", fontFamily: "Helvetica-Bold", textAlign: "center", marginBottom: 6 },
  presentedTo: { fontSize: 11, color: "#666666", marginBottom: 6 },
  studentName: { fontSize: 30, color: "#1e3a5f", fontFamily: "Helvetica-Bold", textAlign: "center" },
  nameLine: { width: 300, height: 1, backgroundColor: "#c9a84c", marginTop: 6 },
  completedText: { fontSize: 11, color: "#666666", marginTop: 14, textAlign: "center" },
  courseTitle: { fontSize: 18, color: "#1e3a5f", fontFamily: "Helvetica-Bold", textAlign: "center", marginTop: 4 },
  footer: { width: "100%", flexDirection: "row", justifyContent: "space-around", alignItems: "flex-end", marginTop: 8 },
  signatureBlock: { alignItems: "center", width: 150 },
  signatureImage: { width: 110, height: 40, objectFit: "contain", marginBottom: 2 },
  signatureSpacer: { height: 42 },
  signatureLine: { width: 135, height: 1, backgroundColor: "#333333", marginBottom: 4 },
  signatureName: { fontSize: 10, color: "#333333", fontFamily: "Helvetica-Bold", textAlign: "center" },
  signatureRole: { fontSize: 8, color: "#666666", textAlign: "center" },
  metaRow: { width: "100%", flexDirection: "row", justifyContent: "space-between", marginTop: 10 },
  metaText: { fontSize: 8, color: "#666666", letterSpacing: 0.5 },
})

export interface CertificatePDFProps {
  studentName: string
  courseTitle: string
  title: string
  institutionName: string
  issuedAt: string
  serial: string | null
  logos: string[]
  signatures: { name: string; role: string; url: string | null }[]
  layout?: CertificateLayout | null
}

/** A4 landscape in PDF points, matched to the 1000 × 707 design canvas. */
const SCALE = 842 / DESIGN_WIDTH

function pdfFont(block: TextBlock): string {
  if (block.fontFamily === "sans") {
    if (block.fontWeight === "bold") return block.italic ? "Helvetica-BoldOblique" : "Helvetica-Bold"
    return block.italic ? "Helvetica-Oblique" : "Helvetica"
  }
  if (block.fontWeight === "bold") return block.italic ? "Times-BoldItalic" : "Times-Bold"
  return block.italic ? "Times-Italic" : "Times-Roman"
}

function LayoutBorder({ layout }: { layout: CertificateLayout }) {
  const { style, color, accent } = layout.border
  if (style === "none") return null
  if (style === "single") {
    return <View style={{ position: "absolute", top: 20, left: 20, right: 20, bottom: 20, borderWidth: 1.5, borderColor: color }} />
  }
  if (style === "double") {
    return (
      <>
        <View style={{ position: "absolute", top: 16, left: 16, right: 16, bottom: 16, borderWidth: 2.5, borderColor: color }} />
        <View style={{ position: "absolute", top: 24, left: 24, right: 24, bottom: 24, borderWidth: 0.8, borderColor: accent }} />
      </>
    )
  }
  if (style === "frame") {
    return (
      <>
        <View style={{ position: "absolute", top: 10, left: 10, right: 10, bottom: 10, borderWidth: 6, borderColor: color }} />
        <View style={{ position: "absolute", top: 26, left: 26, right: 26, bottom: 26, borderWidth: 0.8, borderColor: accent }} />
      </>
    )
  }
  if (style === "side-band") {
    return (
      <>
        <View style={{ position: "absolute", top: 0, left: 0, bottom: 0, width: 260, backgroundColor: color }} />
        <View style={{ position: "absolute", top: 0, left: 260, bottom: 0, width: 4, backgroundColor: accent }} />
      </>
    )
  }
  if (style === "top-band") {
    return (
      <>
        <View style={{ position: "absolute", top: 0, left: 0, right: 0, height: 120, backgroundColor: color }} />
        <View style={{ position: "absolute", top: 120, left: 0, right: 0, height: 5, backgroundColor: accent }} />
      </>
    )
  }
  // corner flourishes
  const arm = 60
  const thickness = 3
  const inset = 18
  return (
    <>
      <View style={{ position: "absolute", top: inset, left: inset, width: arm, height: thickness, backgroundColor: color }} />
      <View style={{ position: "absolute", top: inset, left: inset, width: thickness, height: arm, backgroundColor: color }} />
      <View style={{ position: "absolute", top: inset, right: inset, width: arm, height: thickness, backgroundColor: color }} />
      <View style={{ position: "absolute", top: inset, right: inset, width: thickness, height: arm, backgroundColor: color }} />
      <View style={{ position: "absolute", bottom: inset, left: inset, width: arm, height: thickness, backgroundColor: color }} />
      <View style={{ position: "absolute", bottom: inset, left: inset, width: thickness, height: arm, backgroundColor: color }} />
      <View style={{ position: "absolute", bottom: inset, right: inset, width: arm, height: thickness, backgroundColor: color }} />
      <View style={{ position: "absolute", bottom: inset, right: inset, width: thickness, height: arm, backgroundColor: color }} />
      <View style={{ position: "absolute", top: inset + 8, left: inset + 8, right: inset + 8, bottom: inset + 8, borderWidth: 0.6, borderColor: accent }} />
    </>
  )
}

function SignatureView({ block }: { block: SignatureBlock }) {
  return (
    <View style={{ position: "absolute", left: block.x * SCALE, top: block.y * SCALE, width: block.width * SCALE, alignItems: "center" }}>
      {block.url ? (
        <Image src={block.url} style={{ width: block.width * SCALE * 0.8, height: 42 * SCALE, objectFit: "contain", marginBottom: 2 }} />
      ) : (
        <View style={{ height: 42 * SCALE }} />
      )}
      <View style={{ width: "100%", height: 1, backgroundColor: block.color ?? "#333333", marginBottom: 3 }} />
      {!!block.name && (
        <Text style={{ fontSize: 10 * SCALE, fontFamily: "Helvetica-Bold", color: block.color ?? "#333333", textAlign: "center" }}>
          {block.name}
        </Text>
      )}
      <Text style={{ fontSize: 8 * SCALE, color: block.color ?? "#666666", textAlign: "center" }}>
        {block.role || "Authorized Signature"}
      </Text>
    </View>
  )
}

function LayoutCertificate({ layout, content }: { layout: CertificateLayout; content: CertificateContent }) {
  return (
    <Page size="A4" orientation="landscape" style={{ position: "relative", backgroundColor: layout.background, fontFamily: "Helvetica" }}>
      <LayoutBorder layout={layout} />
      {layout.blocks.map((block) => {
        if (block.type === "divider") {
          return (
            <View
              key={block.id}
              style={{
                position: "absolute",
                left: block.x * SCALE,
                top: block.y * SCALE,
                width: block.width * SCALE,
                height: Math.max(1, block.thickness * SCALE),
                backgroundColor: block.color,
              }}
            />
          )
        }
        if (block.type === "logo") {
          if (!block.url) return null
          return (
            <Image
              key={block.id}
              src={block.url}
              style={{ position: "absolute", left: block.x * SCALE, top: block.y * SCALE, width: block.width * SCALE, height: block.height * SCALE, objectFit: "contain" }}
            />
          )
        }
        if (block.type === "signature") return <SignatureView key={block.id} block={block} />
        const value = resolveText(block, content)
        if (!value) return null
        return (
          <View key={block.id} style={{ position: "absolute", left: block.x * SCALE, top: block.y * SCALE, width: block.width * SCALE }}>
            <Text
              style={{
                fontFamily: pdfFont(block),
                fontSize: block.fontSize * SCALE,
                color: block.color,
                textAlign: block.align,
                letterSpacing: (block.letterSpacing ?? 0) * SCALE,
              }}
            >
              {value}
            </Text>
          </View>
        )
      })}
    </Page>
  )
}

export function CertificatePDF({
  studentName, courseTitle, title, institutionName, issuedAt, serial, logos, signatures, layout,
}: CertificatePDFProps) {
  const formattedDate = new Date(issuedAt).toLocaleDateString("en-GB", { day: "numeric", month: "long", year: "numeric" })
  const signers = signatures.length > 0 ? signatures.slice(0, 4) : [{ name: "", role: "Authorized Signature", url: null }]

  if (layout && layout.blocks.length > 0) {
    return (
      <Document>
        <LayoutCertificate
          layout={layout}
          content={{ institutionName, title, studentName, courseTitle, serial: serial ?? "", date: formattedDate }}
        />
      </Document>
    )
  }

  return (
    <Document>
      <Page size="A4" orientation="landscape" style={styles.page}>
        <View style={styles.border} />
        <View style={styles.innerBorder} />

        <View style={styles.content}>
          <View style={styles.logoRow}>
            {logos.slice(0, 4).map((url, index) => <Image key={`${url}-${index}`} src={url} style={styles.logo} />)}
          </View>

          <View style={styles.header}>
            <Text style={styles.institution}>{institutionName}</Text>
            <Text style={styles.title}>{title}</Text>
            <Text style={styles.presentedTo}>This is to certify that</Text>
            <Text style={styles.studentName}>{studentName}</Text>
            <View style={styles.nameLine} />
            <Text style={styles.completedText}>has successfully completed the course</Text>
            <Text style={styles.courseTitle}>{courseTitle}</Text>
          </View>

          <View style={styles.footer}>
            {signers.map((signature, index) => (
              <View key={index} style={styles.signatureBlock}>
                {signature.url ? <Image src={signature.url} style={styles.signatureImage} /> : <View style={styles.signatureSpacer} />}
                <View style={styles.signatureLine} />
                {!!signature.name && <Text style={styles.signatureName}>{signature.name}</Text>}
                <Text style={styles.signatureRole}>{signature.role || "Authorized Signature"}</Text>
              </View>
            ))}
          </View>

          <View style={styles.metaRow}>
            <Text style={styles.metaText}>{serial ? `Certificate No. ${serial}` : ""}</Text>
            <Text style={styles.metaText}>Issued {formattedDate}</Text>
          </View>
        </View>
      </Page>
    </Document>
  )
}
