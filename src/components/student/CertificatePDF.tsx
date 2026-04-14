import {
  Document,
  Page,
  Text,
  View,
  Image,
  StyleSheet,
  Font,
} from "@react-pdf/renderer"

// Register a clean font (using built-in Helvetica)
const styles = StyleSheet.create({
  page: {
    backgroundColor: "#ffffff",
    padding: 60,
    fontFamily: "Helvetica",
    position: "relative",
  },
  border: {
    position: "absolute",
    top: 20,
    left: 20,
    right: 20,
    bottom: 20,
    borderWidth: 3,
    borderColor: "#1e3a5f",
    borderStyle: "solid",
  },
  innerBorder: {
    position: "absolute",
    top: 26,
    left: 26,
    right: 26,
    bottom: 26,
    borderWidth: 1,
    borderColor: "#c9a84c",
    borderStyle: "solid",
  },
  content: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: 40,
  },
  logo: {
    width: 160,
    height: 60,
    objectFit: "contain",
    marginBottom: 24,
  },
  orgName: {
    fontSize: 13,
    color: "#1e3a5f",
    letterSpacing: 3,
    textTransform: "uppercase",
    marginBottom: 8,
    fontFamily: "Helvetica-Bold",
  },
  certOfCompletion: {
    fontSize: 10,
    color: "#888888",
    letterSpacing: 2,
    textTransform: "uppercase",
    marginBottom: 32,
  },
  presentedTo: {
    fontSize: 11,
    color: "#666666",
    marginBottom: 8,
  },
  studentName: {
    fontSize: 32,
    color: "#1e3a5f",
    fontFamily: "Helvetica-Bold",
    marginBottom: 12,
    textAlign: "center",
  },
  nameLine: {
    width: 300,
    height: 1,
    backgroundColor: "#c9a84c",
    marginBottom: 24,
  },
  completedText: {
    fontSize: 11,
    color: "#666666",
    marginBottom: 8,
    textAlign: "center",
  },
  courseTitle: {
    fontSize: 20,
    color: "#1e3a5f",
    fontFamily: "Helvetica-Bold",
    textAlign: "center",
    marginBottom: 32,
  },
  footer: {
    width: "100%",
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "flex-end",
    marginTop: 16,
  },
  signatureBlock: {
    alignItems: "center",
    width: 160,
  },
  signatureImage: {
    width: 120,
    height: 50,
    objectFit: "contain",
    marginBottom: 4,
  },
  signatureLine: {
    width: 140,
    height: 1,
    backgroundColor: "#333333",
    marginBottom: 4,
  },
  signatureLabel: {
    fontSize: 9,
    color: "#666666",
    textAlign: "center",
  },
  dateBlock: {
    alignItems: "center",
    width: 160,
  },
  dateText: {
    fontSize: 12,
    color: "#333333",
    fontFamily: "Helvetica-Bold",
    marginBottom: 4,
  },
  dateLabel: {
    fontSize: 9,
    color: "#666666",
  },
  sealText: {
    fontSize: 9,
    color: "#c9a84c",
    textAlign: "center",
    width: 80,
    letterSpacing: 1,
  },
})

interface CertificatePDFProps {
  studentName: string
  courseTitle: string
  orgName: string
  issuedAt: string
  logoUrl: string | null
  signatureUrl: string | null
}

export function CertificatePDF({
  studentName,
  courseTitle,
  orgName,
  issuedAt,
  logoUrl,
  signatureUrl,
}: CertificatePDFProps) {
  const formattedDate = new Date(issuedAt).toLocaleDateString("en-GB", {
    day: "numeric",
    month: "long",
    year: "numeric",
  })

  return (
    <Document>
      <Page size="A4" orientation="landscape" style={styles.page}>
        {/* Decorative borders */}
        <View style={styles.border} />
        <View style={styles.innerBorder} />

        <View style={styles.content}>
          {/* Logo */}
          {logoUrl && (
            <Image src={logoUrl} style={styles.logo} />
          )}

          {/* Org name */}
          <Text style={styles.orgName}>{orgName}</Text>
          <Text style={styles.certOfCompletion}>Certificate of Completion</Text>

          {/* Student */}
          <Text style={styles.presentedTo}>This is to certify that</Text>
          <Text style={styles.studentName}>{studentName}</Text>
          <View style={styles.nameLine} />

          {/* Course */}
          <Text style={styles.completedText}>has successfully completed the course</Text>
          <Text style={styles.courseTitle}>{courseTitle}</Text>

          {/* Footer */}
          <View style={styles.footer}>
            <View style={styles.signatureBlock}>
              {signatureUrl ? (
                <Image src={signatureUrl} style={styles.signatureImage} />
              ) : (
                <View style={{ height: 54 }} />
              )}
              <View style={styles.signatureLine} />
              <Text style={styles.signatureLabel}>Authorized Signature</Text>
            </View>

            <View style={styles.sealText}>
              <Text>✦ CERTIFIED ✦</Text>
            </View>

            <View style={styles.dateBlock}>
              <Text style={styles.dateText}>{formattedDate}</Text>
              <View style={styles.signatureLine} />
              <Text style={styles.dateLabel}>Date of Completion</Text>
            </View>
          </View>
        </View>
      </Page>
    </Document>
  )
}
