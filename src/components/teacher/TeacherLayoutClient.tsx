"use client"

import { useState } from "react"
import Link from "next/link"
import { AlertCircle, X } from "lucide-react"
import { TeacherSidebar } from "@/components/teacher/TeacherSidebar"
import { DashboardHeader } from "@/components/shared/DashboardHeader"
import { Sheet, SheetContent } from "@/components/ui/sheet"

interface TeacherLayoutClientProps {
  user: {
    name: string
    email: string
    role: string
    imageUrl?: string | null
  }
  profileComplete: boolean
  children: React.ReactNode
}

export function TeacherLayoutClient({ user, profileComplete, children }: TeacherLayoutClientProps) {
  const [sidebarOpen, setSidebarOpen] = useState(false)
  const [alertDismissed, setAlertDismissed] = useState(false)

  const showAlert = !profileComplete && !alertDismissed

  return (
    <div className="flex h-screen overflow-hidden">
      <div className="hidden lg:flex lg:shrink-0">
        <TeacherSidebar />
      </div>

      <Sheet open={sidebarOpen} onOpenChange={setSidebarOpen}>
        <SheetContent side="left" className="p-0 w-64">
          <TeacherSidebar onClose={() => setSidebarOpen(false)} />
        </SheetContent>
      </Sheet>

      <div className="flex flex-col flex-1 min-w-0 overflow-hidden">
        <DashboardHeader user={user} onMenuClick={() => setSidebarOpen(true)} />

        {showAlert && (
          <div className="flex items-center gap-3 px-4 py-2.5 bg-amber-50 dark:bg-amber-950/40 border-b border-amber-200 dark:border-amber-800 text-amber-800 dark:text-amber-300 text-sm">
            <AlertCircle className="h-4 w-4 shrink-0" />
            <span className="flex-1">
              Your profile is incomplete.{" "}
              <Link href="/teacher/profile" className="font-semibold underline underline-offset-2 hover:opacity-80">
                Complete your profile
              </Link>{" "}
              to provide your country, state, city and ordination.
            </span>
            <button
              onClick={() => setAlertDismissed(true)}
              className="shrink-0 rounded p-0.5 hover:bg-amber-200 dark:hover:bg-amber-800 transition-colors"
              aria-label="Dismiss"
            >
              <X className="h-4 w-4" />
            </button>
          </div>
        )}

        <main className="flex-1 overflow-y-auto p-4 md:p-6 lg:p-8">
          {children}
        </main>
      </div>
    </div>
  )
}
