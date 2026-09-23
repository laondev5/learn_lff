import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { cn } from "@/lib/utils"
import type { LucideIcon } from "lucide-react"
import type { CSSProperties, ReactNode } from "react"

type IllustrationSize = "square_hd" | "square" | "portrait_4_3" | "portrait_16_9" | "landscape_4_3" | "landscape_16_9"

export function buildIllustrationUrl(prompt: string, imageSize: IllustrationSize = "landscape_16_9") {
  return `https://coresg-normal.trae.ai/api/ide/v1/text_to_image?prompt=${encodeURIComponent(prompt)}&image_size=${imageSize}`
}

interface DashboardHeroProps {
  eyebrow: string
  title: string
  description: string
  illustrationPrompt: string
  illustrationAlt: string
  illustrationSrc?: string
  children?: ReactNode
  className?: string
}

export function DashboardHero({
  eyebrow,
  title,
  description,
  illustrationPrompt,
  illustrationAlt,
  illustrationSrc,
  children,
  className,
}: DashboardHeroProps) {
  const illustrationUrl = illustrationSrc ?? buildIllustrationUrl(illustrationPrompt)

  return (
    <div
      className={cn(
        "relative overflow-hidden rounded-[2rem] border border-primary/15 bg-[linear-gradient(135deg,rgba(123,92,255,0.12),rgba(247,181,0,0.12),rgba(255,99,132,0.1))] p-6 shadow-sm",
        className
      )}
    >
      <div className="absolute inset-0 bg-[radial-gradient(circle_at_top_left,rgba(255,255,255,0.95),transparent_45%),radial-gradient(circle_at_bottom_right,rgba(123,92,255,0.12),transparent_35%)]" />
      <div className="relative grid gap-6 lg:grid-cols-[1.2fr_0.9fr] lg:items-center">
        <div className="space-y-4">
          <span className="inline-flex rounded-full border border-primary/20 bg-background/80 px-3 py-1 text-xs font-semibold uppercase tracking-[0.24em] text-primary shadow-sm">
            {eyebrow}
          </span>
          <div className="space-y-2">
            <h1 className="font-heading text-3xl font-bold tracking-tight text-balance sm:text-4xl">
              {title}
            </h1>
            <p className="max-w-2xl text-sm leading-6 text-muted-foreground sm:text-base">
              {description}
            </p>
          </div>
          {children}
        </div>

        <div className="relative">
          <div className="absolute inset-4 rounded-[1.75rem] bg-primary/10 blur-3xl" />
          <div className="relative overflow-hidden rounded-[1.75rem] border border-white/60 bg-white/70 p-2 shadow-lg backdrop-blur">
            {/* External generated illustrations are rendered directly to avoid extra image config. */}
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src={illustrationUrl}
              alt={illustrationAlt}
              className="h-full w-full rounded-[1.25rem] object-cover"
            />
          </div>
        </div>
      </div>
    </div>
  )
}

interface MetricCardProps {
  title: string
  value: string | number
  description: string
  icon: LucideIcon
  tone?: "violet" | "amber" | "rose" | "sky" | "emerald"
}

const toneClasses: Record<NonNullable<MetricCardProps["tone"]>, string> = {
  violet: "from-violet-500/15 to-violet-500/5 text-violet-700 border-violet-200/80",
  amber: "from-amber-400/20 to-amber-300/5 text-amber-700 border-amber-200/80",
  rose: "from-rose-400/20 to-rose-300/5 text-rose-700 border-rose-200/80",
  sky: "from-sky-400/20 to-sky-300/5 text-sky-700 border-sky-200/80",
  emerald: "from-emerald-400/20 to-emerald-300/5 text-emerald-700 border-emerald-200/80",
}

export function MetricCard({
  title,
  value,
  description,
  icon: Icon,
  tone = "violet",
}: MetricCardProps) {
  return (
    <Card className={cn("border bg-gradient-to-br", toneClasses[tone])}>
      <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-3">
        <CardTitle className="text-sm font-medium text-foreground">{title}</CardTitle>
        <div className="rounded-2xl bg-white/80 p-2 shadow-sm">
          <Icon className="h-4 w-4" />
        </div>
      </CardHeader>
      <CardContent>
        <div className="font-heading text-3xl font-bold tracking-tight text-foreground">{value}</div>
        <p className="mt-2 text-xs text-muted-foreground">{description}</p>
      </CardContent>
    </Card>
  )
}

interface BarChartDatum {
  label: string
  value: number
  note?: string
  color?: string
}

interface SimpleBarChartProps {
  title: string
  description?: string
  data: BarChartDatum[]
  emptyText?: string
}

export function SimpleBarChart({
  title,
  description,
  data,
  emptyText = "No data available yet.",
}: SimpleBarChartProps) {
  const maxValue = Math.max(...data.map((item) => item.value), 1)

  return (
    <Card className="border-primary/10">
      <CardHeader>
        <CardTitle className="font-heading text-xl">{title}</CardTitle>
        {description ? <CardDescription>{description}</CardDescription> : null}
      </CardHeader>
      <CardContent className="space-y-4">
        {data.length === 0 ? (
          <p className="text-sm text-muted-foreground">{emptyText}</p>
        ) : (
          data.map((item) => (
            <div key={item.label} className="space-y-2">
              <div className="flex items-end justify-between gap-4">
                <div>
                  <p className="text-sm font-medium text-foreground">{item.label}</p>
                  {item.note ? <p className="text-xs text-muted-foreground">{item.note}</p> : null}
                </div>
                <p className="font-heading text-lg font-semibold text-foreground">{item.value}</p>
              </div>
              <div className="h-3 overflow-hidden rounded-full bg-muted">
                <div
                  className="h-full rounded-full bg-[linear-gradient(90deg,var(--color-chart-1),var(--color-chart-5))]"
                  style={
                    {
                      width: `${Math.max((item.value / maxValue) * 100, item.value > 0 ? 12 : 0)}%`,
                      background: item.color,
                    } as CSSProperties
                  }
                />
              </div>
            </div>
          ))
        )}
      </CardContent>
    </Card>
  )
}

interface ActivityRingProps {
  title: string
  description: string
  value: number
  suffix?: string
}

export function ActivityRing({ title, description, value, suffix = "%" }: ActivityRingProps) {
  const boundedValue = Math.max(0, Math.min(100, value))

  return (
    <Card className="border-primary/10">
      <CardHeader>
        <CardTitle className="font-heading text-xl">{title}</CardTitle>
        <CardDescription>{description}</CardDescription>
      </CardHeader>
      <CardContent className="flex items-center justify-center py-8">
        <div
          className="grid h-40 w-40 place-items-center rounded-full"
          style={{
            background: `conic-gradient(var(--color-chart-1) ${boundedValue}%, rgba(123,92,255,0.12) ${boundedValue}% 100%)`,
          }}
        >
          <div className="grid h-28 w-28 place-items-center rounded-full bg-background text-center shadow-inner">
            <div>
              <p className="font-heading text-3xl font-bold text-foreground">
                {boundedValue}
                {suffix}
              </p>
              <p className="text-xs text-muted-foreground">completion</p>
            </div>
          </div>
        </div>
      </CardContent>
    </Card>
  )
}

interface HighlightListProps {
  title: string
  description?: string
  items: Array<{ label: string; value: string; tone?: string }>
}

export function HighlightList({ title, description, items }: HighlightListProps) {
  return (
    <Card className="border-primary/10">
      <CardHeader>
        <CardTitle className="font-heading text-xl">{title}</CardTitle>
        {description ? <CardDescription>{description}</CardDescription> : null}
      </CardHeader>
      <CardContent className="space-y-3">
        {items.map((item) => (
          <div key={item.label} className="flex items-center justify-between gap-4 rounded-2xl bg-muted/50 px-4 py-3">
            <span className="text-sm font-medium text-foreground">{item.label}</span>
            <span
              className="rounded-full px-3 py-1 text-xs font-semibold"
              style={{
                backgroundColor: item.tone ?? "rgba(123, 92, 255, 0.12)",
                color: "var(--foreground)",
              }}
            >
              {item.value}
            </span>
          </div>
        ))}
      </CardContent>
    </Card>
  )
}
