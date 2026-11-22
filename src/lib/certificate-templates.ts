import {
  DEFAULT_LAYOUT,
  DESIGN_HEIGHT,
  DESIGN_WIDTH,
  type CertificateBorderStyle,
  type CertificateLayout,
  type CertificateTextField,
  type DividerBlock,
  type FontFamily,
  type LogoBlock,
  type SignatureBlock,
  type TextAlign,
  type TextBlock,
} from "@/lib/certificate-layout"

export type CertificateTemplate = {
  id: string
  name: string
  description: string
  /** Two colours used for the gallery swatch. */
  swatch: [string, string]
  layout: CertificateLayout
}

type TextOptions = {
  size: number
  weight?: "normal" | "bold"
  color: string
  align?: TextAlign
  family?: FontFamily
  spacing?: number
  italic?: boolean
}

function text(id: string, field: CertificateTextField, x: number, y: number, width: number, options: TextOptions): TextBlock {
  return {
    id,
    type: "text",
    field,
    x,
    y,
    width,
    fontSize: options.size,
    fontWeight: options.weight ?? "normal",
    color: options.color,
    align: options.align ?? "center",
    fontFamily: options.family ?? "serif",
    letterSpacing: options.spacing ?? 0,
    italic: options.italic ?? false,
  }
}

function logo(id: string, x: number, y: number, width: number, height: number): LogoBlock {
  return { id, type: "logo", url: "", x, y, width, height }
}

function signature(id: string, x: number, y: number, width: number, color = "#333333", role = "Authorized Signature"): SignatureBlock {
  return { id, type: "signature", url: "", name: "", role, x, y, width, color }
}

function divider(id: string, x: number, y: number, width: number, thickness: number, color: string): DividerBlock {
  return { id, type: "divider", x, y, width, thickness, color }
}

function layout(
  background: string,
  style: CertificateBorderStyle,
  color: string,
  accent: string,
  blocks: CertificateLayout["blocks"],
): CertificateLayout {
  return { version: 1, width: DESIGN_WIDTH, height: DESIGN_HEIGHT, background, border: { style, color, accent }, blocks }
}

export const CERTIFICATE_TEMPLATES: CertificateTemplate[] = [
  {
    id: "classic-navy-gold",
    name: "Classic Navy & Gold",
    description: "Formal serif type inside a navy double rule with gold accents. The safe, institutional default.",
    swatch: ["#1e3a5f", "#c9a84c"],
    layout: layout("#ffffff", "double", "#1e3a5f", "#c9a84c", [
      logo("t1-logo-1", 300, 54, 110, 50),
      logo("t1-logo-2", 445, 54, 110, 50),
      logo("t1-logo-3", 590, 54, 110, 50),
      text("t1-institution", "institution", 100, 128, 800, { size: 15, weight: "bold", color: "#1e3a5f", spacing: 5 }),
      text("t1-title", "title", 50, 160, 900, { size: 42, weight: "bold", color: "#1e3a5f" }),
      text("t1-presented", "presentedTo", 150, 230, 700, { size: 15, color: "#6b7280" }),
      text("t1-name", "studentName", 100, 258, 800, { size: 48, weight: "bold", color: "#1e3a5f" }),
      divider("t1-rule", 340, 324, 320, 2, "#c9a84c"),
      text("t1-completed", "completedText", 150, 344, 700, { size: 15, color: "#6b7280" }),
      text("t1-course", "courseTitle", 100, 374, 800, { size: 26, weight: "bold", color: "#1e3a5f" }),
      signature("t1-sig-1", 180, 520, 240),
      signature("t1-sig-2", 580, 520, 240),
      text("t1-serial", "serial", 60, 650, 320, { size: 11, color: "#6b7280", align: "left", family: "sans" }),
      text("t1-date", "date", 620, 650, 320, { size: 11, color: "#6b7280", align: "right", family: "sans" }),
    ]),
  },
  {
    id: "modern-minimal",
    name: "Modern Minimal",
    description: "Left-aligned sans-serif on warm off-white with a single violet accent rule. Clean and contemporary.",
    swatch: ["#111827", "#7c3aed"],
    layout: layout("#fafaf9", "none", "#111827", "#7c3aed", [
      logo("t2-logo-1", 690, 78, 85, 40),
      logo("t2-logo-2", 795, 78, 85, 40),
      logo("t2-logo-3", 900, 78, 85, 40),
      text("t2-institution", "institution", 80, 88, 560, { size: 13, weight: "bold", color: "#111827", align: "left", family: "sans", spacing: 3 }),
      text("t2-title", "title", 80, 120, 580, { size: 40, weight: "bold", color: "#111827", align: "left", family: "sans" }),
      divider("t2-rule", 80, 182, 90, 4, "#7c3aed"),
      text("t2-presented", "presentedTo", 80, 212, 600, { size: 14, color: "#6b7280", align: "left", family: "sans" }),
      text("t2-name", "studentName", 80, 238, 780, { size: 46, weight: "bold", color: "#111827", align: "left", family: "sans" }),
      text("t2-completed", "completedText", 80, 308, 620, { size: 14, color: "#6b7280", align: "left", family: "sans" }),
      text("t2-course", "courseTitle", 80, 334, 780, { size: 24, weight: "bold", color: "#7c3aed", align: "left", family: "sans" }),
      signature("t2-sig-1", 80, 520, 220),
      signature("t2-sig-2", 340, 520, 220),
      text("t2-serial", "serial", 80, 650, 400, { size: 11, color: "#6b7280", align: "left", family: "sans" }),
      text("t2-date", "date", 600, 650, 320, { size: 11, color: "#6b7280", align: "right", family: "sans" }),
    ]),
  },
  {
    id: "executive-emerald",
    name: "Executive Emerald",
    description: "Deep emerald serif on a soft ivory sheet, framed by a thick outer rule and antique gold seal line.",
    swatch: ["#065f46", "#b8860b"],
    layout: layout("#fbfdfb", "frame", "#065f46", "#b8860b", [
      logo("t3-logo-1", 380, 62, 100, 48),
      logo("t3-logo-2", 520, 62, 100, 48),
      text("t3-institution", "institution", 100, 132, 800, { size: 14, weight: "bold", color: "#065f46", spacing: 5 }),
      text("t3-title", "title", 50, 164, 900, { size: 40, weight: "bold", color: "#065f46" }),
      text("t3-presented", "presentedTo", 150, 234, 700, { size: 15, color: "#4b5563" }),
      text("t3-name", "studentName", 100, 260, 800, { size: 46, weight: "bold", color: "#0f172a" }),
      divider("t3-rule", 390, 322, 220, 3, "#b8860b"),
      text("t3-completed", "completedText", 150, 342, 700, { size: 15, color: "#4b5563" }),
      text("t3-course", "courseTitle", 100, 370, 800, { size: 24, weight: "bold", color: "#065f46" }),
      signature("t3-sig-1", 210, 516, 230),
      signature("t3-sig-2", 560, 516, 230),
      text("t3-serial", "serial", 70, 648, 320, { size: 11, color: "#4b5563", align: "left", family: "sans" }),
      text("t3-date", "date", 610, 648, 320, { size: 11, color: "#4b5563", align: "right", family: "sans" }),
    ]),
  },
  {
    id: "royal-burgundy",
    name: "Royal Burgundy",
    description: "Burgundy serif with gold corner flourishes on warm parchment. Traditional graduation feel.",
    swatch: ["#7f1d1d", "#c9a227"],
    layout: layout("#fffbf7", "corner", "#7f1d1d", "#c9a227", [
      logo("t4-logo-1", 300, 52, 110, 50),
      logo("t4-logo-2", 445, 52, 110, 50),
      logo("t4-logo-3", 590, 52, 110, 50),
      text("t4-institution", "institution", 100, 124, 800, { size: 14, weight: "bold", color: "#7f1d1d", spacing: 6 }),
      text("t4-title", "title", 50, 154, 900, { size: 44, weight: "bold", color: "#7f1d1d" }),
      text("t4-presented", "presentedTo", 150, 228, 700, { size: 16, color: "#6b4a4a", italic: true }),
      text("t4-name", "studentName", 100, 254, 800, { size: 50, weight: "bold", color: "#3f1d1d" }),
      divider("t4-rule", 350, 320, 300, 2, "#c9a227"),
      text("t4-completed", "completedText", 150, 340, 700, { size: 15, color: "#6b4a4a" }),
      text("t4-course", "courseTitle", 100, 368, 800, { size: 26, weight: "bold", color: "#7f1d1d" }),
      signature("t4-sig-1", 180, 518, 240),
      signature("t4-sig-2", 580, 518, 240),
      text("t4-serial", "serial", 70, 650, 320, { size: 11, color: "#6b4a4a", align: "left", family: "sans" }),
      text("t4-date", "date", 610, 650, 320, { size: 11, color: "#6b4a4a", align: "right", family: "sans" }),
    ]),
  },
  {
    id: "contemporary-split",
    name: "Contemporary Split",
    description: "Full-height charcoal band carrying the logos, with content and an amber accent on the right.",
    swatch: ["#0f172a", "#f59e0b"],
    layout: layout("#ffffff", "side-band", "#0f172a", "#f59e0b", [
      logo("t5-logo-1", 55, 96, 150, 64),
      logo("t5-logo-2", 55, 180, 150, 64),
      logo("t5-logo-3", 55, 264, 150, 64),
      text("t5-institution", "institution", 320, 108, 600, { size: 13, weight: "bold", color: "#0f172a", align: "left", family: "sans", spacing: 3 }),
      text("t5-title", "title", 320, 138, 620, { size: 38, weight: "bold", color: "#0f172a", align: "left", family: "sans" }),
      divider("t5-rule", 320, 200, 70, 5, "#f59e0b"),
      text("t5-presented", "presentedTo", 320, 228, 600, { size: 14, color: "#6b7280", align: "left", family: "sans" }),
      text("t5-name", "studentName", 320, 252, 640, { size: 44, weight: "bold", color: "#0f172a", align: "left", family: "sans" }),
      text("t5-completed", "completedText", 320, 318, 600, { size: 14, color: "#6b7280", align: "left", family: "sans" }),
      text("t5-course", "courseTitle", 320, 342, 640, { size: 22, weight: "bold", color: "#b45309", align: "left", family: "sans" }),
      signature("t5-sig-1", 320, 520, 210),
      signature("t5-sig-2", 560, 520, 210),
      text("t5-serial", "serial", 320, 650, 320, { size: 11, color: "#6b7280", align: "left", family: "sans" }),
      text("t5-date", "date", 700, 650, 220, { size: 11, color: "#6b7280", align: "right", family: "sans" }),
    ]),
  },
  {
    id: "academic-crest",
    name: "Academic Crest",
    description: "Three logo slots form a crest above a wide serif title. Formal university register, three signatories.",
    swatch: ["#1f2937", "#9ca3af"],
    layout: layout("#fcfcfa", "double", "#1f2937", "#9ca3af", [
      logo("t6-logo-1", 360, 48, 70, 70),
      logo("t6-logo-2", 455, 42, 90, 90),
      logo("t6-logo-3", 570, 48, 70, 70),
      text("t6-institution", "institution", 100, 152, 800, { size: 13, weight: "bold", color: "#1f2937", spacing: 6 }),
      text("t6-title", "title", 50, 178, 900, { size: 38, weight: "bold", color: "#1f2937" }),
      text("t6-presented", "presentedTo", 150, 242, 700, { size: 15, color: "#4b5563", italic: true }),
      text("t6-name", "studentName", 100, 266, 800, { size: 46, weight: "bold", color: "#111827" }),
      divider("t6-rule", 320, 330, 360, 1, "#9ca3af"),
      text("t6-completed", "completedText", 150, 350, 700, { size: 15, color: "#4b5563" }),
      text("t6-course", "courseTitle", 100, 376, 800, { size: 24, weight: "bold", color: "#1f2937" }),
      signature("t6-sig-1", 140, 512, 200),
      signature("t6-sig-2", 400, 512, 200),
      signature("t6-sig-3", 660, 512, 200),
      text("t6-serial", "serial", 70, 650, 320, { size: 10, color: "#4b5563", align: "left", family: "sans" }),
      text("t6-date", "date", 610, 650, 320, { size: 10, color: "#4b5563", align: "right", family: "sans" }),
    ]),
  },
  {
    id: "gold-on-charcoal",
    name: "Gold on Charcoal",
    description: "Dark charcoal sheet with champagne-gold type and a fine gold frame. Premium executive finish.",
    swatch: ["#111418", "#c9a227"],
    layout: layout("#111418", "frame", "#c9a227", "#c9a227", [
      logo("t7-logo-1", 390, 62, 100, 48),
      logo("t7-logo-2", 520, 62, 100, 48),
      text("t7-institution", "institution", 100, 132, 800, { size: 14, weight: "bold", color: "#c9a227", spacing: 6 }),
      text("t7-title", "title", 50, 164, 900, { size: 40, weight: "bold", color: "#f5e6c8" }),
      text("t7-presented", "presentedTo", 150, 234, 700, { size: 15, color: "#a8a29e" }),
      text("t7-name", "studentName", 100, 260, 800, { size: 46, weight: "bold", color: "#ffffff" }),
      divider("t7-rule", 380, 322, 240, 2, "#c9a227"),
      text("t7-completed", "completedText", 150, 342, 700, { size: 15, color: "#a8a29e" }),
      text("t7-course", "courseTitle", 100, 370, 800, { size: 24, weight: "bold", color: "#c9a227" }),
      signature("t7-sig-1", 200, 516, 230, "#e7e5e4"),
      signature("t7-sig-2", 570, 516, 230, "#e7e5e4"),
      text("t7-serial", "serial", 70, 648, 320, { size: 11, color: "#a8a29e", align: "left", family: "sans" }),
      text("t7-date", "date", 610, 648, 320, { size: 11, color: "#a8a29e", align: "right", family: "sans" }),
    ]),
  },
  {
    id: "blueprint-teal",
    name: "Blueprint Teal",
    description: "Teal geometric corner marks, tight sans type and a sky-blue underline. Modern professional services look.",
    swatch: ["#0f766e", "#0ea5e9"],
    layout: layout("#f8fdfd", "corner", "#0f766e", "#0ea5e9", [
      logo("t8-logo-1", 700, 80, 85, 40),
      logo("t8-logo-2", 800, 80, 85, 40),
      text("t8-institution", "institution", 110, 106, 560, { size: 13, weight: "bold", color: "#0f766e", align: "left", family: "sans", spacing: 3 }),
      text("t8-title", "title", 110, 136, 620, { size: 40, weight: "bold", color: "#0f766e", align: "left", family: "sans" }),
      divider("t8-rule", 110, 198, 110, 4, "#0ea5e9"),
      text("t8-presented", "presentedTo", 110, 226, 600, { size: 14, color: "#64748b", align: "left", family: "sans" }),
      text("t8-name", "studentName", 110, 250, 700, { size: 46, weight: "bold", color: "#0f172a", align: "left", family: "sans" }),
      text("t8-completed", "completedText", 110, 316, 600, { size: 14, color: "#64748b", align: "left", family: "sans" }),
      text("t8-course", "courseTitle", 110, 340, 700, { size: 23, weight: "bold", color: "#0369a1", align: "left", family: "sans" }),
      signature("t8-sig-1", 110, 518, 220),
      signature("t8-sig-2", 380, 518, 220),
      text("t8-serial", "serial", 110, 648, 340, { size: 11, color: "#64748b", align: "left", family: "sans" }),
      text("t8-date", "date", 620, 648, 280, { size: 11, color: "#64748b", align: "right", family: "sans" }),
    ]),
  },
  {
    id: "heritage-parchment",
    name: "Heritage Parchment",
    description: "Warm parchment sheet, brown serif and a heavy outer frame. Timeless, print-friendly heritage style.",
    swatch: ["#8b5e34", "#b08d57"],
    layout: layout("#fbf3e4", "frame", "#8b5e34", "#b08d57", [
      logo("t9-logo-1", 370, 58, 110, 52),
      logo("t9-logo-2", 520, 58, 110, 52),
      text("t9-institution", "institution", 100, 134, 800, { size: 14, weight: "bold", color: "#8b5e34", spacing: 5 }),
      text("t9-title", "title", 50, 166, 900, { size: 42, weight: "bold", color: "#5b3a1e" }),
      text("t9-presented", "presentedTo", 150, 236, 700, { size: 16, color: "#7a5c3e", italic: true }),
      text("t9-name", "studentName", 100, 262, 800, { size: 48, weight: "bold", color: "#3f2a16" }),
      divider("t9-rule", 360, 326, 280, 2, "#b08d57"),
      text("t9-completed", "completedText", 150, 346, 700, { size: 15, color: "#7a5c3e" }),
      text("t9-course", "courseTitle", 100, 372, 800, { size: 25, weight: "bold", color: "#5b3a1e" }),
      signature("t9-sig-1", 190, 518, 230, "#4b3621"),
      signature("t9-sig-2", 580, 518, 230, "#4b3621"),
      text("t9-serial", "serial", 80, 646, 320, { size: 11, color: "#7a5c3e", align: "left", family: "sans" }),
      text("t9-date", "date", 600, 646, 320, { size: 11, color: "#7a5c3e", align: "right", family: "sans" }),
    ]),
  },
  {
    id: "bold-gradient",
    name: "Bold Gradient",
    description: "Full-width violet header band with logos, oversized bold type and an amber highlight rule.",
    swatch: ["#7c3aed", "#f59e0b"],
    layout: layout("#fdf4ff", "top-band", "#7c3aed", "#f59e0b", [
      logo("t10-logo-1", 300, 30, 110, 60),
      logo("t10-logo-2", 445, 30, 110, 60),
      logo("t10-logo-3", 590, 30, 110, 60),
      text("t10-institution", "institution", 100, 152, 800, { size: 14, weight: "bold", color: "#6d28d9", spacing: 5, family: "sans" }),
      text("t10-title", "title", 50, 186, 900, { size: 46, weight: "bold", color: "#4c1d95", family: "sans" }),
      divider("t10-rule", 440, 252, 120, 6, "#f59e0b"),
      text("t10-presented", "presentedTo", 150, 276, 700, { size: 15, color: "#6b7280", family: "sans" }),
      text("t10-name", "studentName", 100, 300, 800, { size: 46, weight: "bold", color: "#1f2937", family: "sans" }),
      text("t10-completed", "completedText", 150, 362, 700, { size: 15, color: "#6b7280", family: "sans" }),
      text("t10-course", "courseTitle", 100, 386, 800, { size: 24, weight: "bold", color: "#7c3aed", family: "sans" }),
      signature("t10-sig-1", 200, 528, 230),
      signature("t10-sig-2", 570, 528, 230),
      text("t10-serial", "serial", 70, 656, 320, { size: 11, color: "#6b7280", align: "left", family: "sans" }),
      text("t10-date", "date", 610, 656, 320, { size: 11, color: "#6b7280", align: "right", family: "sans" }),
    ]),
  },
]

export function getTemplate(id: string): CertificateTemplate | undefined {
  return CERTIFICATE_TEMPLATES.find((template) => template.id === id)
}

export type TemplateAsset = { url: string; alt?: string }
export type TemplateSignature = { name: string; role: string; url: string }

/**
 * Applies a template to the course's existing logos and signatures. Assets fill
 * the template's slots in order; any leftovers are appended below the frame so
 * nothing the admin already uploaded is silently dropped.
 */
export function applyTemplate(
  template: CertificateTemplate,
  logos: TemplateAsset[],
  signatures: TemplateSignature[],
): CertificateLayout {
  const layout = JSON.parse(JSON.stringify(template.layout)) as CertificateLayout
  let logoIndex = 0
  let signatureIndex = 0

  for (const block of layout.blocks) {
    if (block.type === "logo") {
      const asset = logos[logoIndex++]
      block.url = asset?.url ?? ""
    } else if (block.type === "signature") {
      const entry = signatures[signatureIndex++]
      block.name = entry?.name ?? ""
      block.role = entry?.role || block.role || "Authorized Signature"
      block.url = entry?.url ?? ""
    }
  }

  logos.slice(logoIndex).forEach((asset, index) => {
    layout.blocks.push({
      id: `${template.id}-extra-logo-${index}`,
      type: "logo",
      url: asset.url,
      x: 40 + index * 90,
      y: 620,
      width: 80,
      height: 40,
    })
  })

  signatures.slice(signatureIndex).forEach((entry, index) => {
    layout.blocks.push({
      id: `${template.id}-extra-sig-${index}`,
      type: "signature",
      url: entry.url,
      name: entry.name,
      role: entry.role || "Authorized Signature",
      x: 60 + index * 240,
      y: 560,
      width: 200,
    })
  })

  return layout
}

export { DEFAULT_LAYOUT }
