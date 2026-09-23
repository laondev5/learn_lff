"use client"

import Link from "next/link"
import Image from "next/image"
import { usePathname } from "next/navigation"
import { BarChart3, BookOpen, LayoutDashboard, UserCircle, X } from "lucide-react"
import { cn } from "@/lib/utils"
import { Button } from "@/components/ui/button"
import { Separator } from "@/components/ui/separator"

const navItems = [
  { href: "/teacher/dashboard", label: "Dashboard", icon: LayoutDashboard },
  { href: "/teacher/courses", label: "My Courses", icon: BookOpen },
  { href: "/teacher/analytics", label: "Analytics", icon: BarChart3 },
  { href: "/teacher/profile", label: "My Profile", icon: UserCircle },
]

interface TeacherSidebarProps {
  onClose?: () => void
}

export function TeacherSidebar({ onClose }: TeacherSidebarProps) {
  const pathname = usePathname()

  return (
    <div className="flex h-full w-64 flex-col border-r border-primary/10 bg-[linear-gradient(180deg,rgba(255,255,255,0.95),rgba(241,250,255,0.96))]">
      <div className="flex h-16 items-center justify-between border-b border-primary/10 px-4">
        <Link href="/teacher/dashboard" className="flex items-center gap-2">
          <Image src="/logo.png" alt="LFF LMS" width={28} height={28} className="object-contain" style={{ width: 28, height: "auto" }} unoptimized />
          <span className="font-heading font-bold text-primary">LFF LMS</span>
        </Link>
        {onClose && (
          <Button variant="ghost" size="icon" onClick={onClose} className="lg:hidden">
            <X className="h-4 w-4" />
          </Button>
        )}
      </div>

      <div className="px-4 py-4">
        <div className="rounded-2xl border border-primary/10 bg-[linear-gradient(135deg,rgba(56,189,248,0.14),rgba(123,92,255,0.14),rgba(255,195,0,0.14))] p-4 shadow-sm">
          <p className="text-xs font-semibold uppercase tracking-[0.24em] text-primary/80">
            Teacher
          </p>
          <p className="mt-2 font-heading text-lg font-semibold text-foreground">
            Teaching Studio
          </p>
          <p className="mt-1 text-xs leading-5 text-muted-foreground">
            Track course growth, student momentum, and your upcoming live sessions.
          </p>
        </div>
      </div>

      <div className="px-3 pb-2">
        <p className="mb-1 px-2 text-xs font-semibold text-muted-foreground uppercase tracking-wider">
          Teacher
        </p>
      </div>

      <nav className="flex-1 px-3 space-y-0.5">
        {navItems.map(({ href, label, icon: Icon }) => (
          <Link
            key={href}
            href={href}
            onClick={onClose}
            className={cn(
              "flex items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-medium transition-all",
              pathname.startsWith(href)
                ? "bg-primary text-primary-foreground shadow-sm"
                : "text-muted-foreground hover:bg-accent hover:text-accent-foreground"
            )}
          >
            <Icon className="h-4 w-4 shrink-0" />
            {label}
          </Link>
        ))}
      </nav>

      <Separator />
      <div className="px-4 py-4">
        <div className="rounded-2xl bg-muted/70 px-4 py-3">
          <p className="text-xs font-semibold uppercase tracking-[0.2em] text-muted-foreground">
            LFF LMS Teacher
          </p>
          <p className="mt-1 text-xs text-muted-foreground">
            Insights, live class tools, and course management in one workspace.
          </p>
        </div>
      </div>
    </div>
  )
}
