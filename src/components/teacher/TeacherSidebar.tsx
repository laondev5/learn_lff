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
    <div className="flex flex-col h-full bg-background border-r w-64">
      <div className="flex items-center justify-between h-14 px-4 border-b">
        <Link href="/teacher/dashboard" className="flex items-center gap-2">
          <Image src="/logo.png" alt="LFF LMS" width={28} height={28} className="object-contain" style={{ width: 28, height: "auto" }} unoptimized />
          <span className="font-bold text-primary">LFF LMS</span>
        </Link>
        {onClose && (
          <Button variant="ghost" size="icon" onClick={onClose} className="lg:hidden">
            <X className="h-4 w-4" />
          </Button>
        )}
      </div>

      <div className="px-3 py-2">
        <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider px-2 mb-1">
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
              "flex items-center gap-3 rounded-md px-3 py-2 text-sm font-medium transition-colors",
              pathname.startsWith(href)
                ? "bg-primary text-primary-foreground"
                : "text-muted-foreground hover:bg-accent hover:text-accent-foreground"
            )}
          >
            <Icon className="h-4 w-4 shrink-0" />
            {label}
          </Link>
        ))}
      </nav>

      <Separator />
      <div className="px-4 py-3">
        <p className="text-xs text-muted-foreground">LFF LMS Teacher</p>
      </div>
    </div>
  )
}
