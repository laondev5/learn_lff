"use client"

import { Check } from "lucide-react"
import type { LucideIcon } from "lucide-react"
import { cn } from "@/lib/utils"

export interface StepItem {
  label: string
  description?: string
  icon?: LucideIcon
  /** Marks the step as finished (shows a check) regardless of the current step. */
  complete?: boolean
  optional?: boolean
}

/**
 * Horizontal numbered stepper. On small screens it collapses to
 * "Step X of Y" plus a progress bar so it never overflows.
 */
export function Stepper({
  steps,
  current,
  onStepClick,
  className,
}: {
  steps: StepItem[]
  current: number
  onStepClick?: (index: number) => void
  className?: string
}) {
  const active = steps[current]

  return (
    <div className={cn("w-full", className)}>
      {/* Compact (mobile) */}
      <div className="sm:hidden space-y-2">
        <div className="flex items-center justify-between text-xs">
          <span className="font-medium text-primary">
            Step {current + 1} of {steps.length}
          </span>
          <span className="text-muted-foreground">{active?.label}</span>
        </div>
        <div className="h-1.5 w-full rounded-full bg-muted overflow-hidden">
          <div
            className="h-full rounded-full bg-primary transition-all duration-500"
            style={{ width: `${((current + 1) / steps.length) * 100}%` }}
          />
        </div>
      </div>

      {/* Full (sm and up) */}
      <ol className="hidden sm:flex items-start w-full">
        {steps.map((step, i) => {
          const isCurrent = i === current
          const isDone = step.complete ?? i < current
          const clickable = !!onStepClick
          const Icon = step.icon

          return (
            <li key={step.label} className={cn("flex items-start", i < steps.length - 1 && "flex-1")}>
              <button
                type="button"
                disabled={!clickable}
                onClick={() => onStepClick?.(i)}
                className={cn(
                  "group flex flex-col items-center gap-1.5 text-center min-w-18 outline-none",
                  clickable ? "cursor-pointer" : "cursor-default"
                )}
                aria-current={isCurrent ? "step" : undefined}
              >
                <span
                  className={cn(
                    "flex h-9 w-9 items-center justify-center rounded-full border-2 text-sm font-semibold transition-all duration-300",
                    isDone && !isCurrent && "border-primary bg-primary text-primary-foreground",
                    isCurrent && "border-primary bg-primary/10 text-primary ring-4 ring-primary/15 scale-110",
                    !isDone && !isCurrent && "border-border bg-background text-muted-foreground",
                    clickable && !isCurrent && "group-hover:border-primary/60 group-focus-visible:ring-2 group-focus-visible:ring-primary/40"
                  )}
                >
                  {isDone && !isCurrent ? (
                    <Check className="h-4 w-4" />
                  ) : Icon ? (
                    <Icon className="h-4 w-4" />
                  ) : (
                    i + 1
                  )}
                </span>
                <span
                  className={cn(
                    "text-xs font-medium leading-tight",
                    isCurrent ? "text-foreground" : "text-muted-foreground"
                  )}
                >
                  {step.label}
                </span>
                {step.optional && (
                  <span className="text-[10px] leading-none text-muted-foreground/80">Optional</span>
                )}
              </button>
              {i < steps.length - 1 && (
                <div className="flex-1 pt-4.5 px-1">
                  <div className="h-0.5 w-full rounded-full bg-border overflow-hidden">
                    <div
                      className={cn(
                        "h-full bg-primary transition-all duration-500",
                        isDone ? "w-full" : "w-0"
                      )}
                    />
                  </div>
                </div>
              )}
            </li>
          )
        })}
      </ol>
    </div>
  )
}

/** Friendly hint box shown under a step heading. */
export function StepHint({ children, className }: { children: React.ReactNode; className?: string }) {
  return (
    <p className={cn("rounded-lg bg-muted/60 px-3 py-2 text-xs text-muted-foreground leading-relaxed", className)}>
      {children}
    </p>
  )
}

/** Checkbox card for choosing whether new content is published straight away. */
export function VisibilityToggle({
  checked, onChange, disabled, noun,
}: {
  checked: boolean
  onChange: (v: boolean) => void
  disabled?: boolean
  noun: string
}) {
  return (
    <label className={cn(
      "flex items-start gap-3 rounded-lg border p-3 cursor-pointer transition-colors",
      checked ? "border-primary/40 bg-primary/5" : "hover:bg-muted/50",
      disabled && "opacity-60 cursor-not-allowed"
    )}>
      <input
        type="checkbox"
        className="mt-0.5 h-4 w-4 accent-primary"
        checked={checked}
        disabled={disabled}
        onChange={(e) => onChange(e.target.checked)}
      />
      <span className="text-sm">
        <span className="font-medium">Visible to students</span>
        <span className="block text-xs text-muted-foreground">
          {checked
            ? `Students will see this ${noun} once the course is published.`
            : `Saved as a draft. You can publish this ${noun} later.`}
        </span>
      </span>
    </label>
  )
}
