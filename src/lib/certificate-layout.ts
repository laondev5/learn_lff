/**
 * Certificate layout engine.
 *
 * Every certificate is designed on a fixed 1000 × 707 canvas (A4 landscape at
 * 1000px wide). Blocks store absolute positions in that space, so the same
 * layout renders identically in the HTML designer and in the react-pdf export
 * (which simply scales by 842/1000 points).
 *
 * This module is imported by client components, so it must stay free of
 * server-only imports.
 */

export const DESIGN_WIDTH = 1000
export const DESIGN_HEIGHT = 707

export type CertificateTextField =
  | "institution"
  | "title"
  | "presentedTo"
  | "studentName"
  | "completedText"
  | "courseTitle"
  | "serial"
  | "date"
  | "custom"

export type TextAlign = "left" | "center" | "right"
export type FontFamily = "serif" | "sans"

export type TextBlock = {
  id: string
  type: "text"
  field: CertificateTextField
  /** Used when field is "custom". */
  text?: string
  x: number
  y: number
  width: number
  fontSize: number
  fontWeight: "normal" | "bold"
  italic?: boolean
  color: string
  align: TextAlign
  letterSpacing?: number
  fontFamily: FontFamily
}

export type LogoBlock = {
  id: string
  type: "logo"
  url: string
  x: number
  y: number
  width: number
  height: number
}

export type SignatureBlock = {
  id: string
  type: "signature"
  url: string
  name: string
  role: string
  x: number
  y: number
  width: number
  color?: string
}

export type DividerBlock = {
  id: string
  type: "divider"
  x: number
  y: number
  width: number
  thickness: number
  color: string
}

export type CertificateBlock = TextBlock | LogoBlock | SignatureBlock | DividerBlock

export type CertificateBorderStyle =
  | "none"
  | "single"
  | "double"
  | "frame"
  | "corner"
  | "side-band"
  | "top-band"

export type CertificateLayout = {
  version: 1
  width: number
  height: number
  background: string
  border: { style: CertificateBorderStyle; color: string; accent: string }
  blocks: CertificateBlock[]
}

export type CertificateContent = {
  institutionName: string
  title: string
  studentName: string
  courseTitle: string
  serial: string
  date: string
}

const FALLBACK_TEXT: Record<Exclude<CertificateTextField, "custom">, string> = {
  institution: "Living Faith Foundation",
  title: "Certificate of Completion",
  presentedTo: "This is to certify that",
  studentName: "Student Name",
  completedText: "has successfully completed the course",
  courseTitle: "Course Title",
  serial: "",
  date: "",
}

/** Resolve a text block against live certificate content. */
export function resolveText(block: TextBlock, content: CertificateContent): string {
  switch (block.field) {
    case "custom":
      return block.text ?? ""
    case "presentedTo":
      return "This is to certify that"
    case "completedText":
      return "has successfully completed the course"
    case "serial":
      return content.serial ? `Certificate No. ${content.serial}` : ""
    case "date":
      return content.date ? `Issued ${content.date}` : ""
    case "institution":
      return content.institutionName || FALLBACK_TEXT.institution
    case "title":
      return content.title || FALLBACK_TEXT.title
    case "studentName":
      return content.studentName || FALLBACK_TEXT.studentName
    case "courseTitle":
      return content.courseTitle || FALLBACK_TEXT.courseTitle
  }
}

export function fontStack(family: FontFamily): string {
  return family === "serif"
    ? 'Georgia, "Times New Roman", Times, serif'
    : 'ui-sans-serif, system-ui, -apple-system, "Segoe UI", Helvetica, Arial, sans-serif'
}

export function newBlockId(): string {
  if (typeof crypto !== "undefined" && "randomUUID" in crypto) return crypto.randomUUID().slice(0, 8)
  return Math.random().toString(36).slice(2, 10)
}

export function clamp(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, value))
}

// ─── Validation ──────────────────────────────────────────────────────────────

function num(value: unknown, fallback: number, min: number, max: number): number {
  const parsed = typeof value === "number" ? value : Number(value)
  return Number.isFinite(parsed) ? clamp(parsed, min, max) : fallback
}

function str(value: unknown, fallback: string, max = 300): string {
  return typeof value === "string" ? value.slice(0, max) : fallback
}

const TEXT_FIELDS: CertificateTextField[] = [
  "institution", "title", "presentedTo", "studentName", "completedText", "courseTitle", "serial", "date", "custom",
]
const BORDER_STYLES: CertificateBorderStyle[] = ["none", "single", "double", "frame", "corner", "side-band", "top-band"]

/**
 * Normalises any stored/imported layout into a safe, renderable layout.
 * Returns null when the value is not a usable layout.
 */
export function sanitizeLayout(input: unknown): CertificateLayout | null {
  if (!input || typeof input !== "object") return null
  const raw = input as Record<string, unknown>
  if (!Array.isArray(raw.blocks) || raw.blocks.length === 0) return null

  const borderRaw = (raw.border ?? {}) as Record<string, unknown>
  const borderStyle = BORDER_STYLES.includes(borderRaw.style as CertificateBorderStyle)
    ? (borderRaw.style as CertificateBorderStyle)
    : "none"

  const blocks: CertificateBlock[] = []
  for (const item of raw.blocks.slice(0, 60)) {
    if (!item || typeof item !== "object") continue
    const block = item as Record<string, unknown>
    const id = str(block.id, newBlockId(), 40) || newBlockId()

    if (block.type === "text") {
      const field = TEXT_FIELDS.includes(block.field as CertificateTextField)
        ? (block.field as CertificateTextField)
        : "custom"
      blocks.push({
        id,
        type: "text",
        field,
        text: str(block.text, "", 400),
        x: num(block.x, 50, 0, DESIGN_WIDTH),
        y: num(block.y, 50, 0, DESIGN_HEIGHT),
        width: num(block.width, 400, 20, DESIGN_WIDTH),
        fontSize: num(block.fontSize, 18, 6, 120),
        fontWeight: block.fontWeight === "bold" ? "bold" : "normal",
        italic: block.italic === true,
        color: str(block.color, "#1e3a5f", 30),
        align: block.align === "left" || block.align === "right" ? block.align : "center",
        letterSpacing: num(block.letterSpacing, 0, 0, 20),
        fontFamily: block.fontFamily === "sans" ? "sans" : "serif",
      })
      continue
    }

    if (block.type === "logo") {
      blocks.push({
        id,
        type: "logo",
        url: str(block.url, "", 1000),
        x: num(block.x, 50, 0, DESIGN_WIDTH),
        y: num(block.y, 50, 0, DESIGN_HEIGHT),
        width: num(block.width, 120, 20, DESIGN_WIDTH),
        height: num(block.height, 60, 20, DESIGN_HEIGHT),
      })
      continue
    }

    if (block.type === "signature") {
      blocks.push({
        id,
        type: "signature",
        url: str(block.url, "", 1000),
        name: str(block.name, "", 120),
        role: str(block.role, "", 120),
        x: num(block.x, 50, 0, DESIGN_WIDTH),
        y: num(block.y, 400, 0, DESIGN_HEIGHT),
        width: num(block.width, 220, 60, DESIGN_WIDTH),
        color: str(block.color, "#333333", 30),
      })
      continue
    }

    if (block.type === "divider") {
      blocks.push({
        id,
        type: "divider",
        x: num(block.x, 50, 0, DESIGN_WIDTH),
        y: num(block.y, 50, 0, DESIGN_HEIGHT),
        width: num(block.width, 200, 10, DESIGN_WIDTH),
        thickness: num(block.thickness, 2, 1, 20),
        color: str(block.color, "#c9a84c", 30),
      })
    }
  }

  if (blocks.length === 0) return null

  return {
    version: 1,
    width: DESIGN_WIDTH,
    height: DESIGN_HEIGHT,
    background: str(raw.background, "#ffffff", 30),
    border: {
      style: borderStyle,
      color: str(borderRaw.color, "#1e3a5f", 30),
      accent: str(borderRaw.accent, "#c9a84c", 30),
    },
    blocks,
  }
}

// ─── Editing helpers ─────────────────────────────────────────────────────────

export function updateBlock(layout: CertificateLayout, id: string, patch: Partial<CertificateBlock>): CertificateLayout {
  return {
    ...layout,
    blocks: layout.blocks.map((block) =>
      block.id === id ? ({ ...block, ...patch } as CertificateBlock) : block,
    ),
  }
}

export function removeBlock(layout: CertificateLayout, id: string): CertificateLayout {
  return { ...layout, blocks: layout.blocks.filter((block) => block.id !== id) }
}

export function moveBlock(layout: CertificateLayout, id: string, x: number, y: number): CertificateLayout {
  return updateBlock(layout, id, {
    x: clamp(Math.round(x), 0, DESIGN_WIDTH - 20),
    y: clamp(Math.round(y), 0, DESIGN_HEIGHT - 10),
  } as Partial<CertificateBlock>)
}

/** A blank layout used when a course has never been designed. */
export const DEFAULT_LAYOUT: CertificateLayout = {
  version: 1,
  width: DESIGN_WIDTH,
  height: DESIGN_HEIGHT,
  background: "#ffffff",
  border: { style: "double", color: "#1e3a5f", accent: "#c9a84c" },
  blocks: [
    { id: "d-logo-1", type: "logo", url: "", x: 370, y: 52, width: 110, height: 52 },
    { id: "d-logo-2", type: "logo", url: "", x: 520, y: 52, width: 110, height: 52 },
    { id: "d-institution", type: "text", field: "institution", x: 100, y: 126, width: 800, fontSize: 15, fontWeight: "bold", color: "#1e3a5f", align: "center", letterSpacing: 4, fontFamily: "serif" },
    { id: "d-title", type: "text", field: "title", x: 50, y: 158, width: 900, fontSize: 42, fontWeight: "bold", color: "#1e3a5f", align: "center", fontFamily: "serif" },
    { id: "d-presented", type: "text", field: "presentedTo", x: 150, y: 228, width: 700, fontSize: 15, fontWeight: "normal", color: "#6b7280", align: "center", fontFamily: "serif" },
    { id: "d-name", type: "text", field: "studentName", x: 100, y: 256, width: 800, fontSize: 48, fontWeight: "bold", color: "#1e3a5f", align: "center", fontFamily: "serif" },
    { id: "d-rule", type: "divider", x: 340, y: 322, width: 320, thickness: 2, color: "#c9a84c" },
    { id: "d-completed", type: "text", field: "completedText", x: 150, y: 342, width: 700, fontSize: 15, fontWeight: "normal", color: "#6b7280", align: "center", fontFamily: "serif" },
    { id: "d-course", type: "text", field: "courseTitle", x: 100, y: 372, width: 800, fontSize: 26, fontWeight: "bold", color: "#1e3a5f", align: "center", fontFamily: "serif" },
    { id: "d-sig-1", type: "signature", url: "", name: "", role: "Authorized Signature", x: 180, y: 520, width: 240, color: "#333333" },
    { id: "d-sig-2", type: "signature", url: "", name: "", role: "Authorized Signature", x: 580, y: 520, width: 240, color: "#333333" },
    { id: "d-serial", type: "text", field: "serial", x: 60, y: 650, width: 320, fontSize: 11, fontWeight: "normal", color: "#6b7280", align: "left", fontFamily: "sans" },
    { id: "d-date", type: "text", field: "date", x: 620, y: 650, width: 320, fontSize: 11, fontWeight: "normal", color: "#6b7280", align: "right", fontFamily: "sans" },
  ],
}
