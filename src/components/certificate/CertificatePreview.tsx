"use client"

import { useRef, type CSSProperties, type PointerEvent as ReactPointerEvent } from "react"
import { cn } from "@/lib/utils"
import {
  DESIGN_HEIGHT,
  DESIGN_WIDTH,
  fontStack,
  resolveText,
  type CertificateBlock,
  type CertificateContent,
  type CertificateLayout,
  type SignatureBlock,
  type TextBlock,
} from "@/lib/certificate-layout"

/** 1 design unit expressed in container-query width units. */
function u(value: number): string {
  return `${value / 10}cqw`
}

function borderLayer(layout: CertificateLayout) {
  const { style, color, accent } = layout.border
  const base = "pointer-events-none absolute"

  if (style === "none") return null
  if (style === "single") {
    return <div className={base} style={{ inset: u(20), border: `${u(1.6)} solid ${color}` }} />
  }
  if (style === "double") {
    return (
      <>
        <div className={base} style={{ inset: u(16), border: `${u(2.6)} solid ${color}` }} />
        <div className={base} style={{ inset: u(24), border: `${u(0.8)} solid ${accent}` }} />
      </>
    )
  }
  if (style === "frame") {
    return (
      <>
        <div className={base} style={{ inset: u(10), border: `${u(6)} solid ${color}` }} />
        <div className={base} style={{ inset: u(26), border: `${u(0.8)} solid ${accent}` }} />
      </>
    )
  }
  if (style === "side-band") {
    return (
      <>
        <div className={base} style={{ top: 0, bottom: 0, left: 0, width: u(260), background: color }} />
        <div className={base} style={{ top: 0, bottom: 0, left: u(260), width: u(4), background: accent }} />
      </>
    )
  }
  if (style === "top-band") {
    return (
      <>
        <div className={base} style={{ top: 0, left: 0, right: 0, height: u(120), background: color }} />
        <div className={base} style={{ top: u(120), left: 0, right: 0, height: u(5), background: accent }} />
      </>
    )
  }

  const arm = 60
  const thickness = 3
  const inset = 18
  const arms: CSSProperties[] = [
    { top: u(inset), left: u(inset), width: u(arm), height: u(thickness) },
    { top: u(inset), left: u(inset), width: u(thickness), height: u(arm) },
    { top: u(inset), right: u(inset), width: u(arm), height: u(thickness) },
    { top: u(inset), right: u(inset), width: u(thickness), height: u(arm) },
    { bottom: u(inset), left: u(inset), width: u(arm), height: u(thickness) },
    { bottom: u(inset), left: u(inset), width: u(thickness), height: u(arm) },
    { bottom: u(inset), right: u(inset), width: u(arm), height: u(thickness) },
    { bottom: u(inset), right: u(inset), width: u(thickness), height: u(arm) },
  ]
  return (
    <>
      {arms.map((style, index) => (
        <div key={index} className={base} style={{ ...style, background: color }} />
      ))}
      <div className={base} style={{ inset: u(inset + 8), border: `${u(0.6)} solid ${accent}` }} />
    </>
  )
}

function textStyle(block: TextBlock): CSSProperties {
  return {
    left: u(block.x),
    top: u(block.y),
    width: u(block.width),
    fontFamily: fontStack(block.fontFamily),
    fontSize: u(block.fontSize),
    fontWeight: block.fontWeight === "bold" ? 700 : 400,
    fontStyle: block.italic ? "italic" : "normal",
    color: block.color,
    textAlign: block.align,
    letterSpacing: block.letterSpacing ? u(block.letterSpacing) : undefined,
    lineHeight: 1.16,
  }
}

function SignatureBlockView({
  block, onPointerDown, selected, interactive,
}: {
  block: SignatureBlock
  onPointerDown?: (event: ReactPointerEvent<HTMLDivElement>) => void
  selected?: boolean
  interactive?: boolean
}) {
  return (
    <div
      className="absolute flex flex-col items-center"
      data-cert-block={interactive ? "" : undefined}
      data-selected={selected ? "true" : undefined}
      onPointerDown={onPointerDown}
      style={{ left: u(block.x), top: u(block.y), width: u(block.width), cursor: interactive ? "grab" : undefined }}
    >
      {block.url ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img src={block.url} alt="" style={{ width: u(block.width * 0.8), height: u(42), objectFit: "contain" }} />
      ) : (
        <div style={{ height: u(42) }} />
      )}
      <div style={{ width: "100%", height: u(1), background: block.color ?? "#333333", marginBottom: u(3) }} />
      {!!block.name && (
        <p style={{ fontSize: u(10), fontWeight: 700, color: block.color ?? "#333333", textAlign: "center", lineHeight: 1.2 }}>
          {block.name}
        </p>
      )}
      <p style={{ fontSize: u(8), color: block.color ?? "#666666", textAlign: "center", lineHeight: 1.2 }}>
        {block.role || "Authorized Signature"}
      </p>
    </div>
  )
}

export interface CertificatePreviewProps {
  layout: CertificateLayout
  content: CertificateContent
  className?: string
  interactive?: boolean
  selectedId?: string | null
  onSelect?: (id: string) => void
  onMove?: (id: string, x: number, y: number) => void
}

/**
 * Renders a certificate layout. All measurements use container-query units, so
 * the same component is pixel-accurate as a thumbnail and as a full editor.
 */
export function CertificatePreview({
  layout, content, className, interactive, selectedId, onSelect, onMove,
}: CertificatePreviewProps) {
  const containerRef = useRef<HTMLDivElement>(null)

  function startDrag(event: ReactPointerEvent<HTMLDivElement>, block: CertificateBlock) {
    if (!interactive || !onMove) return
    event.preventDefault()
    event.stopPropagation()
    onSelect?.(block.id)
    const container = containerRef.current
    if (!container) return

    const pxPerUnit = container.getBoundingClientRect().width / DESIGN_WIDTH
    const originX = event.clientX
    const originY = event.clientY
    const startX = block.x
    const startY = block.y

    function move(moveEvent: PointerEvent) {
      onMove?.(
        block.id,
        startX + (moveEvent.clientX - originX) / pxPerUnit,
        startY + (moveEvent.clientY - originY) / pxPerUnit,
      )
    }
    function up() {
      window.removeEventListener("pointermove", move)
      window.removeEventListener("pointerup", up)
    }
    window.addEventListener("pointermove", move)
    window.addEventListener("pointerup", up)
  }

  return (
    <div
      ref={containerRef}
      className={cn("cert-canvas relative w-full overflow-hidden select-none", className)}
      data-interactive={interactive ? "true" : "false"}
      style={{
        containerType: "inline-size",
        aspectRatio: `${DESIGN_WIDTH} / ${DESIGN_HEIGHT}`,
        background: layout.background,
      }}
      onPointerDown={interactive ? () => onSelect?.("") : undefined}
    >
      {borderLayer(layout)}

      {layout.blocks.map((block) => {
        const selected = selectedId === block.id
        const interactiveStyle = interactive ? { cursor: "grab" as const } : undefined

        if (block.type === "divider") {
          return (
            <div
              key={block.id}
              data-cert-block={interactive ? "" : undefined}
              data-selected={selected ? "true" : undefined}
              onPointerDown={(event) => startDrag(event, block)}
              className="absolute"
              style={{
                left: u(block.x), top: u(block.y), width: u(block.width), height: u(block.thickness), background: block.color,
                ...interactiveStyle,
              }}
            />
          )
        }

        if (block.type === "logo") {
          return (
            <div
              key={block.id}
              data-cert-block={interactive ? "" : undefined}
              data-selected={selected ? "true" : undefined}
              onPointerDown={(event) => startDrag(event, block)}
              className="absolute flex items-center justify-center"
              style={{ left: u(block.x), top: u(block.y), width: u(block.width), height: u(block.height), ...interactiveStyle }}
            >
              {block.url ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img src={block.url} alt="" style={{ width: "100%", height: "100%", objectFit: "contain" }} />
              ) : interactive ? (
                <div
                  className="flex h-full w-full items-center justify-center"
                  style={{ border: `${u(0.8)} dashed #a78bfa`, color: "#7c3aed", fontSize: u(9) }}
                >
                  Logo
                </div>
              ) : null}
            </div>
          )
        }

        if (block.type === "signature") {
          return (
            <SignatureBlockView
              key={block.id}
              block={block}
              selected={selected}
              interactive={interactive}
              onPointerDown={(event) => startDrag(event, block)}
            />
          )
        }

        const value = resolveText(block, content)
        return (
          <div
            key={block.id}
            data-cert-block={interactive ? "" : undefined}
            data-selected={selected ? "true" : undefined}
            onPointerDown={(event) => startDrag(event, block)}
            className="absolute whitespace-pre-wrap"
            style={{ ...textStyle(block), ...interactiveStyle }}
          >
            {value}
          </div>
        )
      })}
    </div>
  )
}
