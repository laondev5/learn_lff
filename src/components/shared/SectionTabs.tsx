"use client"

import { useEffect, useState } from "react"
import { cn } from "@/lib/utils"

export interface SectionTab {
  key: string
  label: string
  /**
   * A rendered icon element, e.g. `<BookOpen className="h-4 w-4" />`. Must be an element,
   * not the component itself: server components can't pass functions to this client component.
   */
  icon?: React.ReactNode
  count?: number
  content: React.ReactNode
}

/**
 * Underlined, Udemy-style tab strip. The active tab is mirrored to the URL hash
 * (e.g. #qa) so a tab can be linked to directly and survives a refresh.
 */
export function SectionTabs({
  tabs,
  value,
  onValueChange,
  className,
  stickyOffsetClass,
}: {
  tabs: SectionTab[]
  value?: string
  onValueChange?: (key: string) => void
  className?: string
  /** When set, the tab bar sticks to the top of the scroll area (e.g. "top-0"). */
  stickyOffsetClass?: string
}) {
  const [internal, setInternal] = useState(tabs[0]?.key)
  const active = value ?? internal

  useEffect(() => {
    const fromHash = window.location.hash.replace("#", "")
    if (fromHash && tabs.some((t) => t.key === fromHash)) select(fromHash)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  function select(key: string) {
    if (value === undefined) setInternal(key)
    onValueChange?.(key)
    history.replaceState(null, "", `#${key}`)
  }

  const current = tabs.find((t) => t.key === active) ?? tabs[0]

  return (
    <div className={className}>
      <div
        role="tablist"
        className={cn(
          "flex gap-1 overflow-x-auto overflow-y-hidden border-b [scrollbar-width:none] [&::-webkit-scrollbar]:hidden",
          stickyOffsetClass && ["sticky z-20 bg-background/95 backdrop-blur", stickyOffsetClass]
        )}
      >
        {tabs.map((tab) => {
          const selected = tab.key === current?.key
          return (
            <button
              key={tab.key}
              type="button"
              role="tab"
              aria-selected={selected}
              onClick={() => select(tab.key)}
              className={cn(
                "relative flex shrink-0 items-center gap-2 px-4 py-3 text-sm font-semibold transition-colors",
                selected ? "text-foreground" : "text-muted-foreground hover:text-foreground"
              )}
            >
              {tab.icon}
              {tab.label}
              {tab.count !== undefined && (
                <span className={cn(
                  "rounded-full px-1.5 py-0.5 text-[11px] leading-none",
                  selected ? "bg-primary text-primary-foreground" : "bg-muted text-muted-foreground"
                )}>
                  {tab.count}
                </span>
              )}
              <span className={cn(
                "absolute inset-x-2 bottom-0 h-0.5 rounded-full transition-colors",
                selected ? "bg-foreground" : "bg-transparent"
              )} />
            </button>
          )
        })}
      </div>
      <div key={current?.key} role="tabpanel" className="pt-6 animate-in fade-in-0 duration-200">
        {current?.content}
      </div>
    </div>
  )
}
