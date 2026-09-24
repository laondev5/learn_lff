"use client"

import Link from "next/link"
import Image from "next/image"
import { usePathname } from "next/navigation"
import { Award, BookOpen, LayoutDashboard, Megaphone, MessageSquare, UserCircle, X } from "lucide-react"
import { cn } from "@/lib/utils"
import { Button } from "@/components/ui/button"
import { Separator } from "@/components/ui/separator"

const navItems = [
  { href: "/student/dashboard", label: "Dashboard", icon: LayoutDashboard },
  { href: "/student/courses", label: "My Courses", icon: BookOpen },
  { href: "/student/announcements", label: "Announcements", icon: Megaphone },
  { href: "/student/chat", label: "Community", icon: MessageSquare },
  { href: "/student/certificates", label: "Certificates", icon: Award },
  { href: "/student/profile", label: "My Profile", icon: UserCircle },
]

interface StudentSidebarProps {
  onClose?: () => void
}

export function StudentSidebar({ onClose }: StudentSidebarProps) {
  const pathname = usePathname()

  return (
    <div className="flex h-full w-64 flex-col border-r border-primary/10 bg-[linear-gradient(180deg,rgba(255,255,255,0.95),rgba(255,248,241,0.96))]">
      <div className="flex h-16 items-center justify-between border-b border-primary/10 px-4">
        <Link href="/student/dashboard" className="flex items-center gap-2">
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
        <div className="rounded-2xl border border-primary/10 bg-[linear-gradient(135deg,rgba(255,195,0,0.18),rgba(255,99,132,0.14),rgba(123,92,255,0.12))] p-4 shadow-sm">
          <p className="text-xs font-semibold uppercase tracking-[0.24em] text-primary/80">
            Student
          </p>
          <p className="mt-2 font-heading text-lg font-semibold text-foreground">
            Learning Hub
          </p>
          <p className="mt-1 text-xs leading-5 text-muted-foreground">
            Stay on top of your progress, certificates, and upcoming class moments.
          </p>
        </div>
      </div>

      <div className="px-3 pb-2">
        <p className="mb-1 px-2 text-xs font-semibold text-muted-foreground uppercase tracking-wider">
          Student
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
            LFF LMS Student
          </p>
          <p className="mt-1 text-xs text-muted-foreground">
            Courses, announcements, certificates, and conversations all together.
          </p>
        </div>
      </div>
    </div>
  )
}
