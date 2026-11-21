import { Document, Page, Text, View, Image, StyleSheet } from "@react-pdf/renderer"

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
}

export function CertificatePDF({
  studentName, courseTitle, title, institutionName, issuedAt, serial, logos, signatures,
}: CertificatePDFProps) {
  const formattedDate = new Date(issuedAt).toLocaleDateString("en-GB", { day: "numeric", month: "long", year: "numeric" })
  const signers = signatures.length > 0 ? signatures.slice(0, 4) : [{ name: "", role: "Authorized Signature", url: null }]

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
