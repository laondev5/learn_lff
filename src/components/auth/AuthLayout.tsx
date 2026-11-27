import Image from "next/image"
import { Award, BookOpen, Users } from "lucide-react"
import { cn } from "@/lib/utils"

const HIGHLIGHTS = [
  { icon: BookOpen, label: "Structured courses and modules" },
  { icon: Award, label: "Certificates on completion" },
  { icon: Users, label: "Cohorts, mentors and community" },
]

export function AuthLayout({
  children,
  wide = false,
}: {
  children: React.ReactNode
  wide?: boolean
}) {
  return (
    <div
      className={cn(
        "grid min-h-screen",
        wide ? "lg:grid-cols-[0.8fr_1.2fr]" : "lg:grid-cols-2"
      )}
    >
      <div className="relative hidden overflow-hidden bg-primary p-10 lg:sticky lg:top-0 lg:flex lg:h-screen lg:flex-col lg:justify-between xl:p-14">
        <div
          aria-hidden
          className="pointer-events-none absolute -right-24 -top-24 h-96 w-96 rounded-full bg-white/10 blur-3xl"
        />
        <div
          aria-hidden
          className="pointer-events-none absolute -bottom-32 -left-20 h-96 w-96 rounded-full bg-black/20 blur-3xl"
        />

        <div className="relative flex items-center gap-3">
          <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-white/15 ring-1 ring-white/25 backdrop-blur">
            <Image
              src="/logo.png"
              alt="LFF LMS"
              width={40}
              height={40}
              className="object-contain"
              priority
              unoptimized
            />
          </div>
          <div>
            <p className="text-base font-semibold tracking-tight text-primary-foreground">
              LFF LMS
            </p>
            <p className="text-xs text-primary-foreground/70">
              Learning Management System
            </p>
          </div>
        </div>

        <div className="relative max-w-md">
          <h2 className="text-3xl font-semibold leading-tight tracking-tight text-primary-foreground xl:text-4xl">
            Empowering learners, one lesson at a time.
          </h2>
          <p className="mt-4 text-sm leading-relaxed text-primary-foreground/75">
            Pick up where you left off, track your progress, and earn your
            certificate when you complete your cohort.
          </p>

          <ul className="mt-10 space-y-4">
            {HIGHLIGHTS.map(({ icon: Icon, label }) => (
              <li key={label} className="flex items-center gap-3">
                <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-white/15 ring-1 ring-white/20">
                  <Icon className="h-4 w-4 text-primary-foreground" />
                </span>
                <span className="text-sm text-primary-foreground/85">{label}</span>
              </li>
            ))}
          </ul>
        </div>

        <p className="relative text-xs text-primary-foreground/60">
          &copy; LFF. All rights reserved.
        </p>
      </div>

      <div className="flex items-center justify-center px-5 py-12 sm:px-8">
        <div className={cn("w-full", wide ? "max-w-2xl" : "max-w-md")}>
          <div className="mb-10 flex flex-col items-center lg:hidden">
            <Image
              src="/logo.png"
              alt="LFF LMS"
              width={72}
              height={72}
              className="mb-3 object-contain"
              style={{ width: 72, height: "auto" }}
              priority
              unoptimized
            />
            <p className="text-xs text-muted-foreground">
              Learning Management System
            </p>
          </div>
          {children}
        </div>
      </div>
    </div>
  )
}
